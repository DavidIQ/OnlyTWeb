import { Component, input, output } from '@angular/core';
import { TimerInfo } from '../services/api.service';
import { LanguageCode } from '../i18n/i18n';
import { MeetingKind, Translated, formatTimer, meetingTitleKey } from './shared';

@Component({
  selector: 'aside[app-schedule-card]',
  template: `
<div class="schedule-heading">
  <div>
    <h2>{{ i18n.tFor(language(), meetingTitleKey(meeting())) }}</h2>
    <p class="schedule-times">{{ meetingTimes() }}</p>
  </div>
  <span class="schedule-count">{{ timers().length }} {{ timers().length === 1 ? t('schedule.item') : t('schedule.items') }}</span>
</div>

<ol class="schedule-list">
  @for (talk of timers(); track trackTalk($index, talk); let index = $index) {
    <li class="schedule-row">
      <button
        class="schedule-item"
        type="button"
        [class.current]="selectedTalkId() === talk.talkId"
        [class.completed]="talk.completedTimeSecs !== null"
        [disabled]="running()"
        (click)="talkSelected.emit(talk.talkId)"
      >
        <span class="schedule-index">{{ (index + 1).toString().padStart(2, '0') }}</span>
        <span class="schedule-content">
          <span class="schedule-title">{{ i18n.talkTitleFor(language(), talk) }}</span>
          <span class="schedule-section">{{ i18n.sectionNameFor(language(), talk.meetingSectionNameInternal) }}</span>
        </span>
        <span class="schedule-duration">
          {{ formatTimer(talk.actualDurationSecs) }}
          @if (talk.completedTimeSecs !== null) {
            <span class="completion-marker" [attr.aria-label]="t('schedule.completed')">✓</span>
          }
        </span>
      </button>
      @if (talk.meeting === 'midweek') {
        <button
          class="remove-button"
          type="button"
          [disabled]="running()"
          [attr.aria-label]="t('schedule.remove')"
          [title]="t('schedule.remove')"
          (click)="talkRemoved.emit(talk)"
        >×</button>
      }
    </li>
  }
</ol>

<div class="schedule-actions">
  @if (meeting() === 'midweek') {
    <button class="reset-all-button" type="button" [disabled]="running()" (click)="reimportRequested.emit()">{{ t('schedule.reimport') }}</button>
  } @else {
    <span></span>
  }
  <button class="reset-all-button" type="button" [disabled]="running()" (click)="resetRequested.emit()">{{ t('schedule.resetAll') }}</button>
</div>

<div class="schedule-footer">
  <span class="footer-dot"></span>
  <span>{{ t('schedule.footer') }}</span>
</div>
`,
  host: { class: 'schedule-card' },
})
export class ScheduleCard extends Translated {
  readonly language = input.required<LanguageCode>();
  readonly meeting = input.required<MeetingKind>();
  readonly meetingTimes = input.required<string>();
  readonly timers = input.required<TimerInfo[]>();
  readonly selectedTalkId = input<number | null>(null);
  readonly running = input.required<boolean>();
  readonly talkSelected = output<number>();
  readonly talkRemoved = output<TimerInfo>();
  readonly resetRequested = output<void>();
  readonly reimportRequested = output<void>();

  protected readonly formatTimer = formatTimer;
  protected readonly meetingTitleKey = meetingTitleKey;

  protected trackTalk(_index: number, talk: TimerInfo): number {
    return talk.talkId;
  }
}
