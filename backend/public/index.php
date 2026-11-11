<?php
declare(strict_types=1);

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'StateStore.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'MidweekSchedule.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'MeetingFeed.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'Auth.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'AdaptiveMode.php';
require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'ReportMailer.php';

// Polling responses are repetitive JSON, so compress them when the client accepts it.
if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    ob_start('ob_gzhandler');
}

final class ApiException extends RuntimeException
{
    public function __construct(
        public readonly int $httpStatus,
        string $message,
        public readonly string $errorCode = 'request_failed',
    ) {
        parent::__construct($message);
    }
}

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    exit;
}

function requestBody(): array
{
    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || trim($rawBody) === '') {
        return [];
    }

    try {
        $body = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new ApiException(400, 'Request body must be valid JSON.');
    }
    if (!is_array($body)) {
        throw new ApiException(400, 'Request body must be a JSON object.');
    }
    return $body;
}

function currentStatus(array $status): array
{
    $elapsedSeconds = $status['elapsedSeconds'];
    if ($status['isRunning'] && $status['startedAt'] !== null) {
        $elapsedSeconds += max(0, (int)floor(microtime(true) - $status['startedAt']));
    }

    $hours = intdiv($elapsedSeconds, 3600);
    $minutes = intdiv($elapsedSeconds % 3600, 60);
    $seconds = $elapsedSeconds % 60;

    return [
        'talkId' => $status['talkId'],
        'targetSeconds' => $status['targetSeconds'],
        'isRunning' => $status['isRunning'],
        'timeElapsed' => sprintf('%02d:%02d:%02d', $hours, $minutes, $seconds),
        'elapsedSeconds' => $elapsedSeconds,
        // Sub-second precision lets the client keep its local count aligned with the server clock between polls.
        'elapsedPrecise' => $status['isRunning'] && $status['startedAt'] !== null
            ? round($status['elapsedSeconds'] + max(0.0, microtime(true) - $status['startedAt']), 3)
            : $elapsedSeconds,
        'closingSecs' => $status['closingSecs'],
    ];
}

function timersResponse(array $state, ?int $talkId = null): array
{
    $timerInfo = $state['timerInfo'];
    if ($talkId !== null) {
        $timerInfo = array_values(array_filter(
            $timerInfo,
            static fn(array $timer): bool => $timer['talkId'] === $talkId
        ));
        if ($timerInfo === []) {
            throw new ApiException(404, 'The requested timer does not exist.', 'timer_not_found');
        }
    }

    return [
        'status' => currentStatus($state['status']),
        'timerInfo' => $timerInfo,
    ];
}

function resetTimerRecords(array &$state): void
{
    foreach ($state['timerInfo'] as &$timer) {
        $timer['completedTimeSecs'] = null;
        $timer['startTime'] = null;
        $timer['endTime'] = null;
        if ($timer['adaptedDurationSecs'] !== null) {
            $timer['adaptedDurationSecs'] = null;
            $timer['actualDurationSecs'] = $timer['modifiedDurationSecs'] ?? $timer['originalDurationSecs'];
        }
    }
    unset($timer);
}

function resetExpiredTimerState(array &$state): bool
{
    $firstStart = null;
    foreach ($state['timerInfo'] as $timer) {
        if ($timer['startTime'] !== null && ($firstStart === null || $timer['startTime'] < $firstStart)) {
            $firstStart = $timer['startTime'];
        }
    }
    if ($firstStart === null || date('Y-m-d', (int)$firstStart) >= date('Y-m-d')) {
        return false;
    }

    resetTimerRecords($state);
    if ($state['status']['isRunning']) {
        $state['status'] = [
            'talkId' => null,
            'targetSeconds' => 0,
            'isRunning' => false,
            'startedAt' => null,
            'elapsedSeconds' => 0,
            'closingSecs' => 30,
        ];
    }
    $state['settings']['circuitVisit'] = false;
    ScheduleSync::applyCircuitVisit($state);
    return true;
}

function midweekImportIsDue(array $state): bool
{
    if (!ScheduleSync::hasMeeting($state, MidweekSchedule::MEETING)) {
        return false;
    }
    $importedAt = $state['midweekImportedAt'];
    return $importedAt === null || (int)date('oW', (int)$importedAt) < (int)date('oW');
}

function importMidweekSchedule(array &$state, bool $isCircuitVisit, ?array $feedMeeting): void
{
    $state['timerInfo'] = array_values(array_filter(
        $state['timerInfo'],
        static fn(array $item): bool => $item['meeting'] !== MidweekSchedule::MEETING
    ));
    $state['settings']['circuitVisit'] = $isCircuitVisit;
    foreach (MidweekSchedule::build($isCircuitVisit, $feedMeeting) as $item) {
        $state['timerInfo'][] = ScheduleSync::toTimer($item, MidweekSchedule::MEETING);
    }
    ScheduleSync::applyCircuitVisit($state);
    $state['midweekImportedAt'] = microtime(true);
}

function &findTimer(array &$state, int $talkId): array
{
    foreach ($state['timerInfo'] as &$timer) {
        if ($timer['talkId'] === $talkId) {
            return $timer;
        }
    }
    throw new ApiException(404, 'The requested timer does not exist.', 'timer_not_found');
}

function circuitVisitOption(array $source): bool
{
    $circuit = $source['isCircuitVisit'] ?? false;
    if (is_string($circuit)) {
        $circuit = filter_var($circuit, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    }
    if (!is_bool($circuit)) {
        throw new ApiException(422, 'isCircuitVisit must be a boolean.', 'invalid_value');
    }
    return $circuit;
}

function validTime(mixed $value, string $field): string
{
    if (!is_string($value) || preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value) !== 1) {
        throw new ApiException(422, "$field must be a time in HH:MM format.", 'invalid_value');
    }
    return $value;
}

function handleRequest(): never
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if (!is_string($path)) {
        throw new ApiException(400, 'Invalid request path.');
    }
    // Drop any folder the app is hosted in (for example /onlyt/api/v1/... becomes /api/v1/...).
    $path = preg_replace('#^.*?(?=/api(?:/|$))#', '', $path) ?? $path;
    $path = rtrim($path, '/') ?: '/';

    if ($method === 'OPTIONS') {
        http_response_code(204);
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, ApiCode');
        header('Access-Control-Max-Age: 600');
        exit;
    }

    if ($path === '/api/v1/auth') {
        if ($method === 'GET') {
            respond(['authenticated' => Auth::isAuthenticated()]);
        }
        if ($method === 'POST') {
            $pin = requestBody()['pin'] ?? null;
            if (!is_string($pin) || preg_match('/^\d{4}$/', $pin) !== 1) {
                throw new ApiException(422, 'The PIN must be 4 digits.', 'invalid_pin');
            }
            Auth::login($pin);
            respond(['authenticated' => true]);
        }
        if ($method === 'DELETE') {
            Auth::logout();
            respond(['authenticated' => false]);
        }
        throw new ApiException(405, 'Method not allowed.');
    }

    // The display and progress pages only read timers and settings, so reads stay public.
    if ($method !== 'GET' || in_array($path, ['/api/v1/schedule/midweek', '/api/v1/report'], true)) {
        Auth::require();
    }

    $store = new StateStore($method === 'GET');
    if ($path === '/api') {
        if ($method !== 'GET') {
            throw new ApiException(405, 'Method not allowed.');
        }
        respond(['lowVersion' => 1, 'highVersion' => 4]);
    }

    if ($path === '/api/v1/datetime' && $method === 'GET') {
        $now = getdate();
        respond([
            'year' => $now['year'],
            'month' => $now['mon'],
            'day' => $now['mday'],
            'hour' => $now['hours'],
            'min' => $now['minutes'],
            'second' => $now['seconds'],
        ]);
    }

    if ($path === '/api/v1/system' && $method === 'GET') {
        respond([
            'machineName' => gethostname() ?: 'web-server',
            'accountName' => get_current_user(),
            'onlyTVersion' => 'web',
            'apiVersion' => ['lowVersion' => 1, 'highVersion' => 4],
            'culture' => ['name' => 'en-US', 'isoCode2' => 'en', 'isoCode3' => 'eng'],
            'workingSet' => memory_get_usage(true),
            'sessionId' => 'web',
            'apiEnabled' => true,
            'apiThrottled' => false,
            'apiCodeRequired' => false,
        ]);
    }

    if ($path === '/api/v1/settings') {
        if ($method === 'GET') {
            respond($store->read(static fn(array $state): array => $state['settings']));
        }
        if ($method === 'PUT') {
            $body = requestBody();
            respond($store->transact(static function (array &$state) use ($body): array {
                foreach (['countUpByDefault', 'allowCountUpToggle'] as $key) {
                    if (array_key_exists($key, $body)) {
                        if (!is_bool($body[$key])) {
                            throw new ApiException(422, "$key must be a boolean.", 'invalid_value');
                        }
                        $state['settings'][$key] = $body[$key];
                    }
                }

                foreach (['midweekStart', 'midweekEnd', 'weekendStart', 'weekendEnd'] as $key) {
                    if (array_key_exists($key, $body)) {
                        $state['settings'][$key] = validTime($body[$key], $key);
                    }
                }
                if (array_key_exists('weekendDay', $body)) {
                    if (!is_int($body['weekendDay']) || $body['weekendDay'] < 0 || $body['weekendDay'] > 6) {
                        throw new ApiException(422, 'weekendDay must be an integer from 0 (Sunday) to 6.', 'invalid_value');
                    }
                    $state['settings']['weekendDay'] = $body['weekendDay'];
                }
                if (array_key_exists('congregationLanguage', $body)) {
                    if (!in_array($body['congregationLanguage'], ['en', 'es', 'pt', 'fr', 'it'], true)) {
                        throw new ApiException(422, 'congregationLanguage must be en, es, pt, fr or it.', 'invalid_value');
                    }
                    $state['settings']['congregationLanguage'] = $body['congregationLanguage'];
                }
                if (array_key_exists('adaptiveMode', $body)) {
                    if (!in_array($body['adaptiveMode'], AdaptiveMode::MODES, true)) {
                        throw new ApiException(422, 'adaptiveMode must be none, oneWay or twoWay.', 'invalid_value');
                    }
                    $state['settings']['adaptiveMode'] = $body['adaptiveMode'];
                    if ($body['adaptiveMode'] === AdaptiveMode::NONE) {
                        foreach ($state['timerInfo'] as &$timer) {
                            if ($timer['adaptedDurationSecs'] !== null) {
                                $timer['adaptedDurationSecs'] = null;
                                $timer['actualDurationSecs'] = $timer['modifiedDurationSecs'] ?? $timer['originalDurationSecs'];
                            }
                        }
                        unset($timer);
                    }
                }
                $settings = $state['settings'];
                if ($settings['midweekEnd'] <= $settings['midweekStart'] || $settings['weekendEnd'] <= $settings['weekendStart']) {
                    throw new ApiException(422, 'A meeting must end after it starts.', 'invalid_time_range');
                }

                if (array_key_exists('circuitVisit', $body)) {
                    if (!is_bool($body['circuitVisit'])) {
                        throw new ApiException(422, 'circuitVisit must be a boolean.', 'invalid_value');
                    }
                    if ($body['circuitVisit'] !== $state['settings']['circuitVisit']) {
                        if ($state['status']['isRunning']) {
                            throw new ApiException(409, 'The schedule cannot change while a timer is running.', 'timer_running_edit');
                        }
                        $state['settings']['circuitVisit'] = $body['circuitVisit'];
                        ScheduleSync::applyCircuitVisit($state);
                    }
                }
                return $state['settings'];
            }));
        }
        throw new ApiException(405, 'Method not allowed.');
    }

    if ($path === '/api/v1/report') {
        if ($method !== 'GET') {
            throw new ApiException(405, 'Method not allowed.');
        }
        respond(['from' => ReportMailer::senderAddress(), 'recipients' => $store->reportRecipients()]);
    }

    if ($path === '/api/v1/report/recipients') {
        if ($method !== 'DELETE') {
            throw new ApiException(405, 'Method not allowed.');
        }
        $store->saveReportRecipients([]);
        respond(['success' => true]);
    }

    if ($path === '/api/v1/report/email') {
        if ($method !== 'POST') {
            throw new ApiException(405, 'Method not allowed.');
        }
        $body = requestBody();
        $recipients = ReportMailer::validRecipients($body['recipients'] ?? null);
        $subject = is_string($body['subject'] ?? null) ? $body['subject'] : '';
        $html = is_string($body['html'] ?? null) ? $body['html'] : '';
        $images = is_array($body['images'] ?? null) ? $body['images'] : [];
        ReportMailer::send($recipients, $subject, $html, $images);
        $store->saveReportRecipients($recipients);
        respond(['success' => true, 'recipients' => $recipients]);
    }

    if ($path === '/api/v1/schedule/midweek') {
        if ($method === 'GET') {
            respond(['items' => MidweekSchedule::build(circuitVisitOption($_GET), MeetingFeed::currentMeeting())]);
        }
        if ($method === 'POST') {
            $body = requestBody();
            $isCircuitVisit = circuitVisitOption($body);
            $replace = ($body['replace'] ?? false) === true;
            $feedMeeting = MeetingFeed::currentMeeting(true);
            $imported = $store->transact(static function (array &$state) use ($isCircuitVisit, $feedMeeting, $replace): bool {
                if (!$replace && ScheduleSync::hasMeeting($state, MidweekSchedule::MEETING)) {
                    return false;
                }
                if ($replace && $state['status']['isRunning']) {
                    throw new ApiException(409, 'The schedule cannot be re-imported while a timer is running.', 'timer_running_edit');
                }
                importMidweekSchedule($state, $isCircuitVisit, $feedMeeting);
                return true;
            });
            respond(['success' => true, 'imported' => $imported], $imported ? 201 : 200);
        }
        throw new ApiException(405, 'Method not allowed.');
    }

    if (preg_match('#^/api/v1/schedule/talks/(\d+)$#', $path, $matches) === 1) {
        if ($method !== 'DELETE') {
            throw new ApiException(405, 'Method not allowed.');
        }
        $talkId = (int)$matches[1];
        respond($store->transact(static function (array &$state) use ($talkId): array {
            if ($state['status']['isRunning']) {
                throw new ApiException(409, 'A part cannot be removed while a timer is running.', 'timer_running_edit');
            }
            $timer = findTimer($state, $talkId);
            if ($timer['meeting'] !== MidweekSchedule::MEETING) {
                throw new ApiException(422, 'Only mid-week parts can be removed.', 'delete_not_allowed');
            }
            $remaining = array_filter(
                $state['timerInfo'],
                static fn(array $item): bool => $item['meeting'] === MidweekSchedule::MEETING
            );
            if (count($remaining) <= 1) {
                throw new ApiException(422, 'The last mid-week part cannot be removed.', 'last_part');
            }
            $state['timerInfo'] = array_values(array_filter(
                $state['timerInfo'],
                static fn(array $item): bool => $item['talkId'] !== $talkId
            ));
            return ['success' => true];
        }));
    }

    if ($path === '/api/v1/timers') {
        if ($method !== 'GET') {
            throw new ApiException(405, 'Method not allowed.');
        }
        respond($store->read(static fn(array $state): array => timersResponse($state)));
    }

    if ($path === '/api/v1/timers/reset') {
        if ($method !== 'POST') {
            throw new ApiException(405, 'Method not allowed.');
        }
        respond($store->transact(static function (array &$state): array {
            if ($state['status']['isRunning']) {
                throw new ApiException(409, 'Timers cannot be reset while a timer is running.', 'timer_running_edit');
            }
            resetTimerRecords($state);
            return ['success' => true];
        }));
    }

    if ($path === '/api/v1/operator/maintenance') {
        if ($method !== 'POST') {
            throw new ApiException(405, 'Method not allowed.');
        }
        $maintenance = $store->transact(static function (array &$state): array {
            $reset = resetExpiredTimerState($state);
            $importDue = midweekImportIsDue($state);
            return [
                'reset' => $reset,
                'importDue' => $importDue,
                'pending' => $importDue && $state['status']['isRunning'],
            ];
        });
        if (!$maintenance['importDue'] || $maintenance['pending']) {
            respond([
                'reset' => $maintenance['reset'],
                'imported' => false,
                'pending' => $maintenance['pending'],
            ]);
        }

        $feedMeeting = MeetingFeed::currentMeeting(true);
        $result = $store->transact(static function (array &$state) use ($feedMeeting, $maintenance): array {
            $reset = resetExpiredTimerState($state) || $maintenance['reset'];
            if (!midweekImportIsDue($state) || $state['status']['isRunning']) {
                return [
                    'reset' => $reset,
                    'imported' => false,
                    'pending' => midweekImportIsDue($state) && $state['status']['isRunning'],
                ];
            }

            $state['settings']['circuitVisit'] = false;
            importMidweekSchedule($state, false, $feedMeeting);
            return ['reset' => $reset, 'imported' => true, 'pending' => false];
        });
        respond($result);
    }

    if (preg_match('#^/api/v1/timers/(\d+)$#', $path, $matches) === 1) {
        $talkId = (int)$matches[1];
        if ($method === 'GET') {
            respond($store->read(
                static fn(array $state): array => timersResponse($state, $talkId)
            ));
        }
        if ($method === 'PUT') {
            $body = requestBody();
            respond($store->transact(static function (array &$state) use ($talkId, $body): array {
                if ($state['status']['isRunning']) {
                    throw new ApiException(409, 'A timer cannot be edited while a timer is running.', 'timer_running_edit');
                }
                $timer = &findTimer($state, $talkId);
                $hasChanges = false;

                if (array_key_exists('actualDurationSecs', $body)) {
                    $duration = $body['actualDurationSecs'];
                    if (!is_int($duration) || $duration < 0 || $duration > 86400) {
                        throw new ApiException(422, 'actualDurationSecs must be an integer from 0 to 86400.', 'invalid_value');
                    }
                    $timer['modifiedDurationSecs'] = $duration === $timer['originalDurationSecs']
                        ? null
                        : $duration;
                    $timer['actualDurationSecs'] = $duration;
                    $timer['adaptedDurationSecs'] = null;
                    $hasChanges = true;
                }

                foreach (['countUp'] as $key) {
                    if (array_key_exists($key, $body)) {
                        if (!is_bool($body[$key])) {
                            throw new ApiException(422, "$key must be a boolean.");
                        }
                        $timer[$key] = $body[$key];
                        $hasChanges = true;
                    }
                }

                if (!$hasChanges) {
                    throw new ApiException(422, 'Provide at least one supported timer field.', 'invalid_value');
                }
                return $timer;
            }));
        }
        if ($method === 'POST') {
            respond($store->transact(static function (array &$state) use ($talkId): array {
                $timer = findTimer($state, $talkId);
                if ($state['status']['isRunning']) {
                    throw new ApiException(409, 'Stop the running timer before starting another.', 'timer_already_running');
                }
                $startedAt = microtime(true);
                $started = &findTimer($state, $talkId);
                $started['startTime'] = $startedAt;
                $started['endTime'] = null;
                $adapted = AdaptiveMode::calculate($state, $talkId, $startedAt);
                if ($adapted !== null) {
                    $started['adaptedDurationSecs'] = $adapted;
                    $started['actualDurationSecs'] = $adapted;
                    $timer = $started;
                }
                unset($started);
                $state['status'] = [
                    'talkId' => $talkId,
                    'targetSeconds' => $timer['actualDurationSecs'],
                    'isRunning' => true,
                    'startedAt' => $startedAt,
                    'elapsedSeconds' => 0,
                    'closingSecs' => $timer['closingSecs'],
                ];
                return [
                    'success' => true,
                    'status' => currentStatus($state['status']),
                ];
            }));
        }
        if ($method === 'DELETE') {
            respond($store->transact(static function (array &$state) use ($talkId): array {
                if (!$state['status']['isRunning'] || $state['status']['talkId'] !== $talkId) {
                    throw new ApiException(409, 'The requested timer is not running.', 'timer_not_running');
                }
                $elapsed = currentStatus($state['status'])['elapsedSeconds'];
                $timer = &findTimer($state, $talkId);
                $timer['completedTimeSecs'] = $elapsed;
                $timer['endTime'] = microtime(true);
                $state['status'] = [
                    'talkId' => null,
                    'targetSeconds' => $state['status']['targetSeconds'],
                    'isRunning' => false,
                    'startedAt' => null,
                    'elapsedSeconds' => 0,
                    'closingSecs' => $state['status']['closingSecs'],
                ];
                return [
                    'success' => true,
                    'status' => currentStatus($state['status']),
                ];
            }));
        }
        throw new ApiException(405, 'Method not allowed.');
    }

    throw new ApiException(404, 'API endpoint not found.');
}

try {
    handleRequest();
} catch (ApiException $exception) {
    respond(['error' => $exception->getMessage(), 'code' => $exception->errorCode], $exception->httpStatus);
} catch (Throwable $exception) {
    error_log((string)$exception);
    respond(['error' => 'The API could not complete the request.'], 500);
}
