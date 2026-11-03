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

    // Parts can be removed after importing, so the ministry part count is not an option.
    public static function build(bool $isCircuitVisit): array
    {
        $items = [
            self::item(1000, 'opening', 'Opening Comments', 'Treasures', 1),
            self::item(1001, 'treasures', 'Treasures Talk', 'Treasures', 10),
            self::item(1002, 'digging', 'Spiritual Gems', 'Treasures', 10),
            self::item(1003, 'reading', 'Bible Reading', 'Treasures', 4),
        ];

        for ($n = 1; $n <= self::DEFAULT_MINISTRY_ITEMS; $n++) {
            $items[] = self::item(1999 + $n, "ministry$n", "Ministry - Item $n", 'Ministry', 3);
        }

        $items[] = self::item(3000, 'living1', 'Living - Part 1', 'Living', 15);

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
