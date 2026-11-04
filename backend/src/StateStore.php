<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'ScheduleSync.php';

final class StateStore
{
    private PDO $database;

    public function __construct()
    {
        $storageDirectory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
        if (!is_dir($storageDirectory) && !mkdir($storageDirectory, 0770, true) && !is_dir($storageDirectory)) {
            throw new RuntimeException('Could not create the SQLite storage directory.');
        }

        $databasePath = $storageDirectory . DIRECTORY_SEPARATOR . 'onlyt.sqlite';
        $this->database = new PDO('sqlite:' . $databasePath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $this->database->exec('PRAGMA busy_timeout = 5000');
        $this->database->exec('PRAGMA journal_mode = WAL');
        $this->initializeSchema();
    }

    /** @return string[] */
    public function reportRecipients(): array
    {
        return $this->database->query('SELECT email FROM report_recipients ORDER BY sort_order')->fetchAll(PDO::FETCH_COLUMN);
    }

    /** @param string[] $recipients */
    public function saveReportRecipients(array $recipients): void
    {
        $this->database->beginTransaction();
        try {
            $this->database->exec('DELETE FROM report_recipients');
            $insert = $this->database->prepare('INSERT INTO report_recipients (email, sort_order) VALUES (:email, :sort_order)');
            foreach (array_values($recipients) as $order => $email) {
                $insert->execute(['email' => $email, 'sort_order' => $order]);
            }
            $this->database->commit();
        } catch (Throwable $exception) {
            $this->database->rollBack();
            throw $exception;
        }
    }

    public function transact(callable $operation): mixed
    {
        $this->database->beginTransaction();
        try {
            $this->database->exec('UPDATE timer_status SET id = id WHERE id = 1');
            $state = $this->loadState();
            ScheduleSync::ensureWeekend($state);
            $result = $operation($state);
            $this->saveState($state);
            $this->database->commit();
            return $result;
        } catch (Throwable $exception) {
            if ($this->database->inTransaction()) {
                $this->database->rollBack();
            }
            throw $exception;
        }
    }

    private function initializeSchema(): void
    {
        $columns = array_column($this->database->query('PRAGMA table_info(timer_info)')->fetchAll(), 'name');
        if ($columns !== [] && !in_array('meeting', $columns, true)) {
            // Pre-import databases only held placeholder data.
            $this->database->exec('DROP TABLE timer_info');
        }

        $this->database->exec(
            'CREATE TABLE IF NOT EXISTS timer_info (
                talk_id INTEGER PRIMARY KEY,
                meeting TEXT NOT NULL,
                talk_key TEXT NOT NULL,
                talk_title TEXT NOT NULL,
                section_internal TEXT NOT NULL,
                original_duration_secs INTEGER NOT NULL,
                modified_duration_secs INTEGER NULL,
                completed_time_secs INTEGER NULL,
                count_up INTEGER NOT NULL,
                closing_secs INTEGER NOT NULL,
                sort_order INTEGER NOT NULL
            )'
        );
        $timerColumns = array_column($this->database->query('PRAGMA table_info(timer_info)')->fetchAll(), 'name');
        foreach (['start_time', 'end_time', 'adapted_duration_secs'] as $column) {
            if (!in_array($column, $timerColumns, true)) {
                $this->database->exec("ALTER TABLE timer_info ADD COLUMN $column REAL NULL");
            }
        }
        $this->database->exec("UPDATE timer_info SET section_internal = 'CircuitOverseer' WHERE talk_id IN (5000, 7002)");
        $this->database->exec(
            'CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                count_up_by_default INTEGER NOT NULL,
                allow_count_up_toggle INTEGER NOT NULL
            )'
        );
        $settingsColumns = array_column($this->database->query('PRAGMA table_info(app_settings)')->fetchAll(), 'name');
        $addedSettings = [
            'circuit_visit' => 'INTEGER NOT NULL DEFAULT 0',
            'midweek_start' => "TEXT NOT NULL DEFAULT '19:00'",
            'midweek_end' => "TEXT NOT NULL DEFAULT '20:45'",
            'weekend_day' => 'INTEGER NOT NULL DEFAULT 0',
            'weekend_start' => "TEXT NOT NULL DEFAULT '10:00'",
            'weekend_end' => "TEXT NOT NULL DEFAULT '11:45'",
            'adaptive_mode' => "TEXT NOT NULL DEFAULT 'none'",
            'report_language' => "TEXT NOT NULL DEFAULT 'en'",
        ];
        foreach ($addedSettings as $column => $definition) {
            if (!in_array($column, $settingsColumns, true)) {
                $this->database->exec("ALTER TABLE app_settings ADD COLUMN $column $definition");
            }
        }
        $this->database->exec(
            'CREATE TABLE IF NOT EXISTS report_recipients (
                email TEXT PRIMARY KEY,
                sort_order INTEGER NOT NULL
            )'
        );
        $this->database->exec(
            'CREATE TABLE IF NOT EXISTS timer_status (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                talk_id INTEGER NULL,
                target_seconds INTEGER NOT NULL,
                is_running INTEGER NOT NULL,
                started_at REAL NULL,
                elapsed_seconds INTEGER NOT NULL,
                closing_secs INTEGER NOT NULL
            )'
        );

        $this->database->exec(
            'INSERT OR IGNORE INTO app_settings (id, count_up_by_default, allow_count_up_toggle)
             VALUES (1, 0, 1)'
        );
        $this->database->exec(
            'INSERT OR IGNORE INTO timer_status (id, target_seconds, is_running, elapsed_seconds, closing_secs)
             VALUES (1, 0, 0, 0, 30)'
        );
    }

    private function loadState(): array
    {
        $settings = $this->database->query('SELECT * FROM app_settings WHERE id = 1')->fetch();
        $status = $this->database->query('SELECT * FROM timer_status WHERE id = 1')->fetch();
        $timers = $this->database->query('SELECT * FROM timer_info ORDER BY sort_order')->fetchAll();

        if ($settings === false || $status === false) {
            throw new RuntimeException('The SQLite database is missing required application state.');
        }

        return [
            'settings' => [
                'countUpByDefault' => (bool)$settings['count_up_by_default'],
                'allowCountUpToggle' => (bool)$settings['allow_count_up_toggle'],
                'circuitVisit' => (bool)$settings['circuit_visit'],
                'reportLanguage' => $settings['report_language'],
                'midweekStart' => $settings['midweek_start'],
                'midweekEnd' => $settings['midweek_end'],
                'weekendDay' => (int)$settings['weekend_day'],
                'weekendStart' => $settings['weekend_start'],
                'weekendEnd' => $settings['weekend_end'],
                'adaptiveMode' => $settings['adaptive_mode'],
            ],
            'status' => [
                'talkId' => $status['talk_id'] === null ? null : (int)$status['talk_id'],
                'targetSeconds' => (int)$status['target_seconds'],
                'isRunning' => (bool)$status['is_running'],
                'startedAt' => $status['started_at'] === null ? null : (float)$status['started_at'],
                'elapsedSeconds' => (int)$status['elapsed_seconds'],
                'closingSecs' => (int)$status['closing_secs'],
            ],
            'timerInfo' => array_map(static fn(array $timer): array => [
                'talkId' => (int)$timer['talk_id'],
                'meeting' => $timer['meeting'],
                'talkKey' => $timer['talk_key'],
                'talkTitle' => $timer['talk_title'],
                'meetingSectionNameInternal' => $timer['section_internal'],
                'meetingSectionNameLocalised' => $timer['section_internal'],
                'originalDurationSecs' => (int)$timer['original_duration_secs'],
                'modifiedDurationSecs' => $timer['modified_duration_secs'] === null
                    ? null
                    : (int)$timer['modified_duration_secs'],
                'adaptedDurationSecs' => $timer['adapted_duration_secs'] === null
                    ? null
                    : (int)$timer['adapted_duration_secs'],
                'actualDurationSecs' => $timer['adapted_duration_secs'] !== null
                    ? (int)$timer['adapted_duration_secs']
                    : ($timer['modified_duration_secs'] === null
                        ? (int)$timer['original_duration_secs']
                        : (int)$timer['modified_duration_secs']),
                'completedTimeSecs' => $timer['completed_time_secs'] === null
                    ? null
                    : (int)$timer['completed_time_secs'],
                'countUp' => (bool)$timer['count_up'],
                'startTime' => $timer['start_time'] === null ? null : (float)$timer['start_time'],
                'endTime' => $timer['end_time'] === null ? null : (float)$timer['end_time'],
                'closingSecs' => (int)$timer['closing_secs'],
            ], $timers),
        ];
    }

    private function saveState(array $state): void
    {
        $settings = $this->database->prepare(
            'UPDATE app_settings
             SET count_up_by_default = :count_up, allow_count_up_toggle = :allow_toggle,
                 circuit_visit = :circuit_visit, midweek_start = :midweek_start, midweek_end = :midweek_end,
                 weekend_day = :weekend_day, weekend_start = :weekend_start, weekend_end = :weekend_end,
                 adaptive_mode = :adaptive_mode, report_language = :report_language
             WHERE id = 1'
        );
        $settings->execute([
            'count_up' => (int)$state['settings']['countUpByDefault'],
            'allow_toggle' => (int)$state['settings']['allowCountUpToggle'],
            'circuit_visit' => (int)$state['settings']['circuitVisit'],
            'midweek_start' => $state['settings']['midweekStart'],
            'midweek_end' => $state['settings']['midweekEnd'],
            'weekend_day' => $state['settings']['weekendDay'],
            'weekend_start' => $state['settings']['weekendStart'],
            'weekend_end' => $state['settings']['weekendEnd'],
            'adaptive_mode' => $state['settings']['adaptiveMode'],
            'report_language' => $state['settings']['reportLanguage'],
        ]);

        $status = $this->database->prepare(
            'UPDATE timer_status
             SET talk_id = :talk_id, target_seconds = :target_seconds, is_running = :is_running,
                 started_at = :started_at, elapsed_seconds = :elapsed_seconds, closing_secs = :closing_secs
             WHERE id = 1'
        );
        $status->execute([
            'talk_id' => $state['status']['talkId'],
            'target_seconds' => $state['status']['targetSeconds'],
            'is_running' => (int)$state['status']['isRunning'],
            'started_at' => $state['status']['startedAt'],
            'elapsed_seconds' => $state['status']['elapsedSeconds'],
            'closing_secs' => $state['status']['closingSecs'],
        ]);

        $timer = $this->database->prepare(
            'INSERT INTO timer_info (
                talk_id, meeting, talk_key, talk_title, section_internal, original_duration_secs,
                modified_duration_secs, completed_time_secs, count_up, closing_secs, sort_order,
                start_time, end_time, adapted_duration_secs
             ) VALUES (
                :talk_id, :meeting, :talk_key, :talk_title, :section_internal, :original_duration_secs,
                :modified_duration_secs, :completed_time_secs, :count_up, :closing_secs, :sort_order,
                :start_time, :end_time, :adapted_duration_secs
             )
             ON CONFLICT(talk_id) DO UPDATE SET
                meeting = excluded.meeting,
                talk_key = excluded.talk_key,
                talk_title = excluded.talk_title,
                section_internal = excluded.section_internal,
                original_duration_secs = excluded.original_duration_secs,
                modified_duration_secs = excluded.modified_duration_secs,
                completed_time_secs = excluded.completed_time_secs,
                count_up = excluded.count_up,
                closing_secs = excluded.closing_secs,
                sort_order = excluded.sort_order,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                adapted_duration_secs = excluded.adapted_duration_secs'
        );
        $keptIds = [];
        foreach ($state['timerInfo'] as $order => $item) {
            $timer->execute([
                'talk_id' => $item['talkId'],
                'meeting' => $item['meeting'],
                'talk_key' => $item['talkKey'],
                'talk_title' => $item['talkTitle'],
                'section_internal' => $item['meetingSectionNameInternal'],
                'original_duration_secs' => $item['originalDurationSecs'],
                'modified_duration_secs' => $item['modifiedDurationSecs'],
                'completed_time_secs' => $item['completedTimeSecs'],
                'count_up' => (int)$item['countUp'],
                'closing_secs' => $item['closingSecs'],
                'sort_order' => $order,
                'start_time' => $item['startTime'],
                'end_time' => $item['endTime'],
                'adapted_duration_secs' => $item['adaptedDurationSecs'],
            ]);
            $keptIds[] = $item['talkId'];
        }

        $storedIds = $this->database->query('SELECT talk_id FROM timer_info')->fetchAll(PDO::FETCH_COLUMN);
        $delete = $this->database->prepare('DELETE FROM timer_info WHERE talk_id = :talk_id');
        foreach (array_diff(array_map('intval', $storedIds), $keptIds) as $talkId) {
            $delete->execute(['talk_id' => $talkId]);
        }
    }
}
