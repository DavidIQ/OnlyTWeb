import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsData, TimerInfo } from '../services/api.service';
import { LanguageCode } from '../i18n/i18n';
import { Translated, formatTimer } from './shared';

@Component({
  selector: 'section[app-timer-column]',
  imports: [FormsModule],
  template: `
<article class="timer-card" [class.running]="running()" [class.overtime]="overtime()" [class.closing]="closing()">
  <div class="timer-card-top circuit-toggle">
    <label class="setup-check">
      <input
        type="checkbox"
        [ngModel]="settings()?.circuitVisit ?? false"
        [disabled]="running()"
        (ngModelChange)="circuitVisitChange.emit($event)"
      />
      {{ t('setup.circuitVisit') }}
    </label>
  </div>
  <div class="timer-card-top">
    <label class="eyebrow" for="talk-select">{{ i18n.tFor(language(), running() ? 'timer.nowTiming' : 'timer.selectSegment') }}</label>
  </div>

  <select
    id="talk-select"
    class="talk-select"
    [ngModel]="selectedTalkId()"
    (ngModelChange)="talkSelected.emit($event)"
    [disabled]="running() || !timers().length"
  >
    @for (talk of timers(); track trackTalk($index, talk)) {
      <option [ngValue]="talk.talkId">{{ i18n.talkTitleFor(language(), talk) }}</option>
    }
  </select>

  <div class="timer-face" aria-live="polite">
    <span class="timer-value">{{ formatTimer(displayedSeconds()) }}</span>
    <span class="timer-caption">
      {{ i18n.tFor(language(), overtime() ? 'timer.overtime' : selectedTalk()?.countUp ? 'timer.elapsed' : 'timer.remaining') }}
    </span>
  </div>

  <div
    class="progress-track"
    role="progressbar"
    [attr.aria-valuenow]="progressPercent()"
    aria-valuemin="0"
    aria-valuemax="100"
    [attr.aria-label]="formatTimer(elapsedSeconds()) + ' ' + i18n.tFor(language(), 'timer.elapsedLabel')"
  >
    <div class="progress-fill" [style.width.%]="progressPercent()"></div>
  </div>

  <div class="timer-details">
    <span>{{ i18n.tFor(language(), 'timer.planned') }} <strong>{{ formatTimer(durationSeconds()) }}</strong></span>
    <span>{{ selectedTalk() ? i18n.sectionNameFor(language(), selectedTalk()!.meetingSectionNameInternal) : i18n.tFor(language(), 'timer.meetingTimer') }}</span>
  </div>

  <div class="primary-controls">
    @if (running()) {
      <button class="stop-button" type="button" (click)="stopRequested.emit()">
        <span class="control-square"></span> {{ t('timer.stop') }}
      </button>
    } @else {
      <button
        class="start-button"
        type="button"
        (click)="startRequested.emit()"
        [disabled]="selectedTalkId() === null || loading()"
      >
        <span class="control-play"></span> {{ t('timer.start') }}
      </button>
    }
  </div>

  <div class="quick-controls">
    <div class="quick-group">
      <span class="quick-label">{{ t('timer.adjust') }}</span>
      <button type="button" (click)="adjustRequested.emit(-300)" [disabled]="running() || !selectedTalk()" [attr.aria-label]="t('timer.subtract5m')">−5m</button>
      <button type="button" (click)="adjustRequested.emit(-15)" [disabled]="running() || !selectedTalk()" [attr.aria-label]="t('timer.subtract15s')">−15s</button>
      <button type="button" (click)="adjustRequested.emit(15)" [disabled]="running() || !selectedTalk()" [attr.aria-label]="t('timer.add15s')">+15s</button>
      <button type="button" (click)="adjustRequested.emit(300)" [disabled]="running() || !selectedTalk()" [attr.aria-label]="t('timer.add5m')">+5m</button>
    </div>
    <div class="toggle-controls">
      @if (settings()?.allowCountUpToggle) {
        <button
          type="button"
          class="toggle-button"
          [class.selected]="selectedTalk()?.countUp"
          [disabled]="running() || !selectedTalk()"
          (click)="countUpToggled.emit()"
        >
          {{ selectedTalk()?.countUp ? t('timer.countUp') : t('timer.countDown') }}
        </button>
      }
    </div>
  </div>
</article>

<div class="feature-row">
  <button class="feature-card feature-button" type="button" (click)="reportRequested.emit()">
    <span class="feature-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
    </span>
    <div>
      <p class="feature-title">{{ t('feature.emailReport') }}</p>
      <p class="feature-copy">{{ t('feature.emailReportCopy') }}</p>
    </div>
  </button>
  <article class="feature-card">
    <span class="feature-icon">◷</span>
    <div>
      <p class="feature-title">{{ t('feature.timerMode') }}</p>
      <p class="feature-copy">{{ selectedTalk()?.countUp ? t('feature.countsUp') : t('feature.countsDown') }}</p>
    </div>
  </article>
</div>
`,
  host: { class: 'timer-column' },
})
export class TimerColumn extends Translated {
  readonly language = input.required<LanguageCode>();
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
