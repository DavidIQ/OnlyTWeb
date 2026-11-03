<?php
declare(strict_types=1);

/**
 * Port of the Windows app's adaptive timer. When a talk starts early or late, the difference is spread over
 * the remaining adaptable talks so the meeting still finishes at its planned end.
 */
final class AdaptiveMode
{
    public const NONE = 'none';
    public const ONE_WAY = 'oneWay';
    public const TWO_WAY = 'twoWay';
    public const MODES = [self::NONE, self::ONE_WAY, self::TWO_WAY];

    private const MIN_DEVIATION_SECS = 15;
    private const MAX_DEVIATION_SECS = 900;
    private const FIRST_ITEM_OFFSET_SECS = 300;

    // Seconds between the end of the previous item and the start of this one (changeover, counsel, songs).
    private const GAP_BEFORE = [
        1001 => 20, 1002 => 20, 1003 => 20,
        2000 => 80, 2001 => 80, 2002 => 80,
        3000 => 200, 4000 => 20,
        7001 => 300,
    ];
    private const ADAPTABLE = [2000, 2001, 2002, 3000, 4000, 5000, 6000, 7001, 7002];

    /** Returns the adapted duration in seconds for the talk about to start, or null if no adaptation applies. */
    public static function calculate(array $state, int $talkId, float $now): ?int
    {
        $mode = $state['settings']['adaptiveMode'];
        if ($mode === self::NONE || !in_array($talkId, self::ADAPTABLE, true)) {
            return null;
        }

        $current = null;
        foreach ($state['timerInfo'] as $timer) {
            if ($timer['talkId'] === $talkId) {
                $current = $timer;
                break;
            }
        }
        if ($current === null) {
            return null;
        }

        $meeting = $current['meeting'];
        $items = array_values(array_filter(
            $state['timerInfo'],
            static fn(array $timer): bool => $timer['meeting'] === $meeting
        ));

        // Planned start offset of every item, from cumulative original durations and the usual gaps.
        $offsets = [];
        $offset = self::FIRST_ITEM_OFFSET_SECS;
        foreach ($items as $index => $item) {
            if ($index > 0) {
                $offset += self::GAP_BEFORE[$item['talkId']] ?? 0;
            }
            $offsets[$index] = $offset;
            $offset += $item['originalDurationSecs'];
        }
        $plannedEndOffset = $offset;

        $startKey = $meeting === WeekendSchedule::MEETING ? 'weekendStart' : 'midweekStart';
        $meetingStart = strtotime('today ' . $state['settings'][$startKey]);
        if ($meetingStart === false) {
            return null;
        }
        $totalRemaining = $meetingStart + $plannedEndOffset - $now;

        $firstIndex = null;
        foreach ($items as $index => $item) {
            if ($item['talkId'] === $talkId) {
                $firstIndex = $index;
                break;
            }
        }
        if ($firstIndex === null) {
            return null;
        }

        $requiredRemaining = 0;
        $adaptableRemaining = 0;
        $count = count($items);
        for ($index = $firstIndex; $index < $count; $index++) {
            $planned = self::planned($items[$index]);
            $requiredRemaining += $planned;
            if ($index + 1 < $count) {
                $requiredRemaining += $offsets[$index + 1] - ($offsets[$index] + $items[$index]['originalDurationSecs']);
            }
            if (in_array($items[$index]['talkId'], self::ADAPTABLE, true)) {
                $adaptableRemaining += $planned;
            }
        }

        $deviation = $totalRemaining - $requiredRemaining;
        if (abs($deviation) <= self::MIN_DEVIATION_SECS || abs($deviation) > self::MAX_DEVIATION_SECS) {
            return null;
        }
        if ($mode === self::ONE_WAY && $totalRemaining >= $requiredRemaining) {
            return null;
        }
        if ($adaptableRemaining <= 0) {
            return null;
        }

        $planned = self::planned($current);
        $adapted = $planned + (int)round($deviation * ($planned / $adaptableRemaining));
        return max(0, $adapted);
    }

    private static function planned(array $timer): int
    {
        return $timer['modifiedDurationSecs'] ?? $timer['originalDurationSecs'];
    }
}
