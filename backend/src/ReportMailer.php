<?php
declare(strict_types=1);

/** Sends the meeting progress report as an HTML email through PHP's standard mail() function. */
final class ReportMailer
{
    private const MAX_RECIPIENTS = 20;
    private const MAX_HTML_BYTES = 1048576;
    private const MAX_IMAGES = 20;
    private const MAX_IMAGE_BYTES = 262144;

    public static function senderAddress(): string
    {
        $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? ''));
        $host = preg_replace('/:\d+$/', '', $host) ?? '';
        if (preg_match('/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/', $host) !== 1) {
            $host = 'localhost';
        }
        return 'MeetingReport@' . $host;
    }

    /** @return string[] */
    public static function validRecipients(mixed $value): array
    {
        if (!is_array($value) || $value === [] || count($value) > self::MAX_RECIPIENTS) {
            throw new ApiException(422, 'Provide between 1 and ' . self::MAX_RECIPIENTS . ' recipients.', 'invalid_recipients');
        }
        $result = [];
        foreach ($value as $address) {
            if (!is_string($address) || strlen($address) > 254
                || filter_var($address, FILTER_VALIDATE_EMAIL) === false) {
                throw new ApiException(422, 'Every recipient must be a valid email address.', 'invalid_recipients');
            }
            $result[strtolower($address)] = $address;
        }
        return array_values($result);
    }

    /**
     * @param string[] $recipients
     * @param array<int, array{cid: string, data: string}> $images
     */
    public static function send(array $recipients, string $subject, string $html, array $images): void
    {
        if ($html === '' || strlen($html) > self::MAX_HTML_BYTES) {
            throw new ApiException(422, 'The report is empty or too large.', 'invalid_report');
        }
        if (count($images) > self::MAX_IMAGES) {
            throw new ApiException(422, 'Too many images in the report.', 'invalid_report');
        }

        $parts = [];
        foreach ($images as $image) {
            $cid = $image['cid'] ?? null;
            $data = $image['data'] ?? null;
            if (!is_string($cid) || preg_match('/^[a-z0-9]{1,40}$/', $cid) !== 1 || !is_string($data)) {
                throw new ApiException(422, 'Invalid report image.', 'invalid_report');
            }
            $binary = base64_decode($data, true);
            if ($binary === false || $binary === '' || strlen($binary) > self::MAX_IMAGE_BYTES
                || !str_starts_with($binary, "\x89PNG\r\n\x1a\n")) {
                throw new ApiException(422, 'Invalid report image.', 'invalid_report');
            }
            $parts[] = [$cid, $binary];
        }

        $html = self::sanitise($html);
        $subject = trim(preg_replace('/[\r\n]+/', ' ', $subject) ?? '');
        if ($subject === '') {
            $subject = 'Meeting report';
        }

        $boundary = 'onlyt-' . bin2hex(random_bytes(12));
        $body = "--$boundary\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html));
        foreach ($parts as [$cid, $binary]) {
            $body .= "--$boundary\r\n"
                . "Content-Type: image/png; name=\"$cid.png\"\r\n"
                . "Content-Transfer-Encoding: base64\r\n"
                . "Content-ID: <$cid>\r\n"
                . "Content-Disposition: inline; filename=\"$cid.png\"\r\n\r\n"
                . chunk_split(base64_encode($binary));
        }
        $body .= "--$boundary--\r\n";

        $headers = [
            'From' => self::senderAddress(),
            'MIME-Version' => '1.0',
            'Content-Type' => "multipart/related; boundary=\"$boundary\"",
        ];

        $sent = @mail(
            implode(', ', $recipients),
            '=?UTF-8?B?' . base64_encode($subject) . '?=',
            $body,
            $headers
        );
        if (!$sent) {
            throw new ApiException(502, 'The server could not send the email.', 'mail_failed');
        }
    }

    // The HTML comes from the browser, so strip anything active or remote before it is mailed.
    private static function sanitise(string $html): string
    {
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $xpath = new DOMXPath($document);
        $blocked = ['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base', 'style', 'input', 'button'];
        foreach ($blocked as $tag) {
            foreach (iterator_to_array($document->getElementsByTagName($tag)) as $node) {
                $node->parentNode?->removeChild($node);
            }
        }
        foreach ($xpath->query('//*') ?: [] as $element) {
            foreach (iterator_to_array($element->attributes ?? []) as $attribute) {
                $name = strtolower($attribute->name);
                $value = strtolower(trim($attribute->value));
                $isScriptUrl = in_array($name, ['href', 'src', 'xlink:href'], true)
                    && preg_match('/^(javascript|data|vbscript):/', preg_replace('/\s+/', '', $value) ?? '') === 1;
                $isRemoteImage = $element->nodeName === 'img' && $name === 'src' && !str_starts_with($value, 'cid:');
                if (str_starts_with($name, 'on') || $isScriptUrl || $isRemoteImage) {
                    $element->removeAttributeNode($attribute);
                }
            }
        }

        $output = $document->saveHTML();
        return str_replace('<?xml encoding="UTF-8">', '', $output === false ? '' : $output);
    }
}
