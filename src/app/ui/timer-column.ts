import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsData, TimerInfo } from '../api.service';
import { Translated, formatTimer } from './shared';

@Component({
  selector: 'section[app-timer-column]',
  imports: [FormsModule],
  templateUrl: './timer-column.html',
  host: { class: 'timer-column' },
})
export class TimerColumn extends Translated {
  readonly timers = input.required<TimerInfo[]>();
  readonly selectedTalk = input<TimerInfo | undefined>();
  readonly selectedTalkId = input<number | null>(null);
  readonly settings = input<SettingsData | null>(null);
  readonly loading = input(false);
  readonly running = input.required<boolean>();
  readonly overtime = input.required<boolean>();
  readonly closing = input.required<boolean>();
  readonly displayedSeconds = input.required<number>();
  readonly elapsedSeconds = input.required<number>();
  readonly durationSeconds = input.required<number>();
  readonly progressPercent = input.required<number>();

  readonly talkSelected = output<number>();
  readonly circuitVisitChange = output<boolean>();
  readonly startRequested = output<void>();
  readonly stopRequested = output<void>();
  readonly adjustRequested = output<number>();
  readonly countUpToggled = output<void>();
  readonly reportRequested = output<void>();

  protected readonly formatTimer = formatTimer;

  protected trackTalk(_index: number, talk: TimerInfo): number {
    return talk.talkId;
  }
}
