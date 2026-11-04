<?php
declare(strict_types=1);

/**
 * Reads the OnlyT meeting feed, which supplies the ministry and living part durations for each week.
 * The feed is cached locally and only downloaded when the cache is old or lacks the current week.
 */
final class MeetingFeed
{
    private const MAX_CACHE_AGE_SECS = 20 * 86400;
    private const DEFAULT_URL = 'https://soundbox.blob.core.windows.net/meeting-feeds/feed.json';

    /** The feed entry for the Monday of the current week, or null when it is unavailable. */
    public static function currentMeeting(bool $forceRefresh = false): ?array
    {
        $monday = date('Y-m-d', strtotime('-' . (((int)date('N')) - 1) . ' days'));
        $cache = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'meeting_feed.json';

        $meetings = self::readCache($cache);
        $meeting = self::find($meetings, $monday);
        if (!$forceRefresh && $meeting !== null && time() - (int)filemtime($cache) <= self::MAX_CACHE_AGE_SECS) {
            return $meeting;
        }

        $content = self::download(self::feedUrl());
        $downloaded = $content === null ? null : json_decode($content, true);
        if (is_array($downloaded)) {
            if (is_dir(dirname($cache)) || mkdir(dirname($cache), 0770, true)) {
                @file_put_contents($cache, $content, LOCK_EX);
            }
            return self::find($downloaded, $monday);
        }

        // The download failed, so a stale cache is still better than the built-in defaults.
        return $meeting;
    }

    private static function feedUrl(): string
    {
        $config = require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config.php';
        $url = is_array($config) ? ($config['feedUrl'] ?? null) : null;
        return is_string($url) && $url !== '' ? $url : self::DEFAULT_URL;
    }

    private static function readCache(string $path): array
    {
        $json = is_file($path) ? @file_get_contents($path) : false;
        $data = $json === false ? null : json_decode($json, true);
        return is_array($data) ? $data : [];
    }

    private static function find(array $meetings, string $monday): ?array
    {
        foreach ($meetings as $meeting) {
            if (is_array($meeting) && is_string($meeting['date'] ?? null) && substr($meeting['date'], 0, 10) === $monday) {
                return $meeting;
            }
        }
        return null;
    }

    private static function download(string $url): ?string
    {
        if (function_exists('curl_init')) {
            $curl = curl_init($url);
            curl_setopt_array($curl, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_USERAGENT => 'OnlyTWeb',
            ]);
            $content = curl_exec($curl);
            $ok = $content !== false && curl_getinfo($curl, CURLINFO_RESPONSE_CODE) === 200;
            curl_close($curl);
            return $ok ? (string)$content : null;
        }

        $context = stream_context_create(['http' => ['timeout' => 10, 'user_agent' => 'OnlyTWeb']]);
        $content = @file_get_contents($url, false, $context);
        return $content === false ? null : $content;
    }
}
