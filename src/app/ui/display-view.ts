import { Component, input } from '@angular/core';
import { Translated, formatTimer } from './shared';

@Component({
  selector: 'main[app-display-view]',
  template: `
<div class="display-time" aria-live="off">
  <div class="display-clock">
    @if (!running()) {
      <div class="display-date">{{ clockDate() }}</div>
    }
    <div>{{ running() ? formatTimer(seconds()) : clockText() }}</div>
    @if (!running() && clockPeriod()) {
      <div class="display-period">{{ clockPeriod() }}</div>
    }
  </div>
</div>
@if (reconnecting()) {
  <div class="reconnecting-message" role="status" aria-live="polite">
    {{ t('connection.reconnecting') }}<span aria-hidden="true">{{ dots() }}</span>
  </div>
}
<a class="display-progress-link" href="progress">{{ t('progress.link') }}</a>
`,
  host: {
    class: 'display-mode',
    '[class.running]': 'running()',
    '[class.overtime]': 'overtime()',
    '[class.closing]': 'closing()',
  },
})
export class DisplayView extends Translated {
  readonly running = input.required<boolean>();
  readonly overtime = input.required<boolean>();
  readonly closing = input.required<boolean>();
  readonly seconds = input.required<number>();
  readonly clockText = input.required<string>();
  readonly clockPeriod = input.required<string>();
  readonly clockDate = input.required<string>();
  readonly reconnecting = input(false);
  readonly dots = input.required<string>();

  protected readonly formatTimer = formatTimer;
}
