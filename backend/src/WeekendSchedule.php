<?php
declare(strict_types=1);

/**
 * The default weekend meeting. With a circuit overseer visit the Watchtower Study is shortened
 * to 30 minutes to make room for the circuit overseer's concluding talk.
 */
final class WeekendSchedule
{
    public const MEETING = 'weekend';

    public static function build(bool $isCircuitVisit): array
    {
        $items = [
            self::item(7000, 'publicTalk', 'Public Talk', 'Public', 30),
            self::item(7001, 'watchtower', 'Watchtower Study', 'Watchtower', $isCircuitVisit ? 30 : 60),
        ];

        if ($isCircuitVisit) {
            $items[] = self::item(7002, 'concludingCo', 'Concluding Talk', 'CircuitOverseer', 30);
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
            'closingSecs' => 60,
        ];
    }
}
