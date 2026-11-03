<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'MidweekSchedule.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'WeekendSchedule.php';

/** Keeps the stored schedule consistent with the meeting settings. Operates on the loaded state array. */
final class ScheduleSync
{
    public static function toTimer(array $item, string $meeting): array
    {
        return [
            'talkId' => $item['talkId'],
            'meeting' => $meeting,
            'talkKey' => $item['talkKey'],
            'talkTitle' => $item['talkTitle'],
            'meetingSectionNameInternal' => $item['meetingSectionNameInternal'],
            'meetingSectionNameLocalised' => $item['meetingSectionNameInternal'],
            'originalDurationSecs' => $item['originalDurationSecs'],
            'modifiedDurationSecs' => null,
            'adaptedDurationSecs' => null,
            'actualDurationSecs' => $item['originalDurationSecs'],
            'completedTimeSecs' => null,
            'countUp' => false,
            'closingSecs' => $item['closingSecs'],
            'startTime' => null,
            'endTime' => null,
        ];
    }

    public static function hasMeeting(array $state, string $meeting): bool
    {
        foreach ($state['timerInfo'] as $timer) {
            if ($timer['meeting'] === $meeting) {
                return true;
            }
        }
        return false;
    }

    // The weekend schedule is never imported; it is created on first use.
    public static function ensureWeekend(array &$state): void
    {
        if (self::hasMeeting($state, WeekendSchedule::MEETING)) {
            return;
        }
        foreach (WeekendSchedule::build($state['settings']['circuitVisit']) as $item) {
            $state['timerInfo'][] = self::toTimer($item, WeekendSchedule::MEETING);
        }
    }

    public static function applyCircuitVisit(array &$state): void
    {
        $isCircuitVisit = $state['settings']['circuitVisit'];
        self::syncMidweek($state, $isCircuitVisit);
        self::syncWeekend($state, $isCircuitVisit);
    }

    // The congregation Bible study is replaced by the circuit overseer's service talk, which follows the concluding comments.
    private static function syncMidweek(array &$state, bool $isCircuitVisit): void
    {
        $fromId = $isCircuitVisit ? 4000 : 5000;
        $toId = $isCircuitVisit ? 5000 : 4000;
        $index = self::indexOf($state, $fromId);
        if ($index === null) {
            return;
        }

        foreach (MidweekSchedule::build($isCircuitVisit) as $item) {
            if ($item['talkId'] === $toId) {
                $state['timerInfo'][$index] = self::toTimer($item, MidweekSchedule::MEETING);
            }
        }

        $concluding = self::indexOf($state, 6000);
        if ($concluding !== null && ($isCircuitVisit ? $concluding > $index : $concluding < $index)) {
            [$state['timerInfo'][$index], $state['timerInfo'][$concluding]] =
                [$state['timerInfo'][$concluding], $state['timerInfo'][$index]];
        }
    }

    private static function syncWeekend(array &$state, bool $isCircuitVisit): void
    {
        $wanted = [];
        foreach (WeekendSchedule::build($isCircuitVisit) as $item) {
            $wanted[$item['talkId']] = $item;
        }

        $kept = [];
        foreach ($state['timerInfo'] as $timer) {
            if ($timer['meeting'] !== WeekendSchedule::MEETING) {
                $kept[] = $timer;
                continue;
            }
            if (!isset($wanted[$timer['talkId']])) {
                continue;
            }
            $item = $wanted[$timer['talkId']];
            if ($timer['originalDurationSecs'] !== $item['originalDurationSecs']) {
                $timer['originalDurationSecs'] = $item['originalDurationSecs'];
                $timer['modifiedDurationSecs'] = null;
                $timer['actualDurationSecs'] = $item['originalDurationSecs'];
            }
            $kept[] = $timer;
            unset($wanted[$timer['talkId']]);
        }
        foreach ($wanted as $item) {
            $kept[] = self::toTimer($item, WeekendSchedule::MEETING);
        }
        $state['timerInfo'] = $kept;
    }

    private static function indexOf(array $state, int $talkId): ?int
    {
        foreach ($state['timerInfo'] as $index => $timer) {
            if ($timer['talkId'] === $talkId) {
                return $index;
            }
        }
        return null;
    }
}
