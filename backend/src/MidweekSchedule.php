<?php
declare(strict_types=1);

/**
 * The mid-week meeting structure, mirroring the automatic schedule of the OnlyT desktop app.
 * Talk ids match the desktop app's TalkTypesAutoMode values.
 */
final class MidweekSchedule
{
    public const MEETING = 'midweek';
    private const DEFAULT_MINISTRY_ITEMS = 3;
    private const MAX_MINISTRY_ITEMS = 4;
    // Talk types used by the OnlyT meeting feed.
    private const FEED_MINISTRY_1 = 100;
    private const FEED_LIVING_1 = 300;
    private const FEED_LIVING_2 = 301;

    private static function feedMinutes(?array $feedMeeting, int $talkType): ?int
    {
        foreach ($feedMeeting['talks'] ?? [] as $talk) {
            if (is_array($talk) && ($talk['talkType'] ?? null) === $talkType) {
                $minutes = $talk['minutes'] ?? null;
                return is_int($minutes) && $minutes > 0 ? $minutes : null;
            }
        }
        return null;
    }

    // Parts can be removed after importing. Durations come from the feed entry for the week when one is given;
    // otherwise (or if it has no ministry parts) three 3-minute ministry parts are used.
    public static function build(bool $isCircuitVisit, ?array $feedMeeting = null): array
    {
        $items = [
            self::item(1000, 'opening', 'Opening Comments', 'Treasures', 1),
            self::item(1001, 'treasures', 'Treasures Talk', 'Treasures', 10),
            self::item(1002, 'digging', 'Spiritual Gems', 'Treasures', 10),
            self::item(1003, 'reading', 'Bible Reading', 'Treasures', 4),
        ];

        $ministry = [];
        for ($n = 1; $n <= self::MAX_MINISTRY_ITEMS; $n++) {
            $minutes = self::feedMinutes($feedMeeting, self::FEED_MINISTRY_1 + $n - 1);
            if ($minutes !== null) {
                $ministry[] = $minutes;
            }
        }
        if ($ministry === []) {
            $ministry = array_fill(0, self::DEFAULT_MINISTRY_ITEMS, 3);
        }
        foreach ($ministry as $index => $minutes) {
            $n = $index + 1;
            $items[] = self::item(1999 + $n, "ministry$n", "Ministry - Item $n", 'Ministry', $minutes);
        }

        $items[] = self::item(3000, 'living1', 'Living - Part 1', 'Living', self::feedMinutes($feedMeeting, self::FEED_LIVING_1) ?? 15);
        $living2 = self::feedMinutes($feedMeeting, self::FEED_LIVING_2);
        if ($living2 !== null) {
            $items[] = self::item(3001, 'living2', 'Living - Part 2', 'Living', $living2);
        }

        if ($isCircuitVisit) {
            $items[] = self::item(6000, 'concluding', 'Concluding Comments', 'Living', 3);
            $items[] = self::item(5000, 'service', 'Service Talk', 'CircuitOverseer', 30);
        } else {
            $items[] = self::item(4000, 'congStudy', 'Congregation Bible Study', 'Living', 30);
            $items[] = self::item(6000, 'concluding', 'Concluding Comments', 'Living', 3);
        }

        return $items;
    }

    private static function item(int $talkId, string $key, string $title, string $section, int $minutes): array
    {
        return [
            'talkId' => $talkId,
            'talkKey' => $key,
            'talkTitle' => $title,
            'meetingSectionNameInternal' => $section,
            'originalDurationSecs' => $minutes * 60,
            'closingSecs' => $minutes <= 5 ? 30 : 60,
        ];
    }
}
