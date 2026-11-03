<?php
declare(strict_types=1);

final class Auth
{
    private const COOKIE = 'onlyt_session';
    private const SESSION_SECONDS = 43200;
    private const MAX_FAILURES = 5;
    private const LOCKOUT_SECONDS = 60;

    private static function pin(): string
    {
        $config = require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config.php';
        $pin = is_array($config) ? ($config['pin'] ?? null) : null;
        if (!is_string($pin) || preg_match('/^\d{4}$/', $pin) !== 1) {
            throw new ApiException(500, 'The server PIN must be configured as 4 digits.', 'pin_not_configured');
        }
        return $pin;
    }

    // Tokens are bound to the PIN, so changing it signs everyone out.
    private static function sign(int $expires): string
    {
        return hash_hmac('sha256', (string)$expires, hash('sha256', 'onlyt|' . self::pin()));
    }

    public static function isAuthenticated(): bool
    {
        $token = $_COOKIE[self::COOKIE] ?? '';
        if (!is_string($token) || substr_count($token, '.') !== 1) {
            return false;
        }
        [$expires, $signature] = explode('.', $token);
        return ctype_digit($expires)
            && (int)$expires > time()
            && hash_equals(self::sign((int)$expires), $signature);
    }

    public static function require(): void
    {
        if (!self::isAuthenticated()) {
            throw new ApiException(401, 'A PIN is required.', 'auth_required');
        }
    }

    public static function login(string $submitted): void
    {
        $file = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'auth_attempts.json';
        if (!is_dir(dirname($file)) && !mkdir(dirname($file), 0770, true) && !is_dir(dirname($file))) {
            throw new RuntimeException('Could not create the storage directory.');
        }
        $handle = fopen($file, 'c+');
        if ($handle === false) {
            throw new RuntimeException('Could not open the PIN attempt log.');
        }
        try {
            flock($handle, LOCK_EX);
            $data = json_decode((string)stream_get_contents($handle), true);
            $failures = is_array($data) ? (int)($data['failures'] ?? 0) : 0;
            $lockedUntil = is_array($data) ? (int)($data['lockedUntil'] ?? 0) : 0;

            if ($lockedUntil > time()) {
                throw new ApiException(429, 'Too many attempts. Try again shortly.', 'pin_locked');
            }

            if (hash_equals(self::pin(), $submitted)) {
                $failures = 0;
                $lockedUntil = 0;
            } else {
                $failures++;
                if ($failures >= self::MAX_FAILURES) {
                    $lockedUntil = time() + self::LOCKOUT_SECONDS;
                    $failures = 0;
                }
            }
            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode(['failures' => $failures, 'lockedUntil' => $lockedUntil]));

            if ($failures > 0 || $lockedUntil > time()) {
                throw new ApiException(401, 'Incorrect PIN.', 'invalid_pin');
            }
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }

        $expires = time() + self::SESSION_SECONDS;
        setcookie(self::COOKIE, $expires . '.' . self::sign($expires), [
            'expires' => $expires,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Strict',
            'secure' => !empty($_SERVER['HTTPS']),
        ]);
    }

    public static function logout(): void
    {
        setcookie(self::COOKIE, '', ['expires' => 1, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
    }
}
