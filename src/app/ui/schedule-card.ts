import { Component, input, output } from '@angular/core';
import { TimerInfo } from '../services/api.service';
import { MeetingKind, Translated, formatTimer, meetingTitleKey } from './shared';

@Component({
  selector: 'aside[app-schedule-card]',
  templateUrl: './schedule-card.html',
  host: { class: 'schedule-card' },
})
export class ScheduleCard extends Translated {
  readonly meeting = input.required<MeetingKind>();
  readonly meetingTimes = input.required<string>();
  readonly timers = input.required<TimerInfo[]>();
  readonly selectedTalkId = input<number | null>(null);
  readonly running = input.required<boolean>();
  readonly talkSelected = output<number>();
  readonly talkRemoved = output<TimerInfo>();

  protected readonly formatTimer = formatTimer;
  protected readonly meetingTitleKey = meetingTitleKey;

  protected trackTalk(_index: number, talk: TimerInfo): number {
    return talk.talkId;
  }
}
