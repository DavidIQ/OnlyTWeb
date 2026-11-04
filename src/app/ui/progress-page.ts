import { Component, input } from '@angular/core';
import { LanguagePicker } from './language-picker';
import { ProgressList, ProgressRow } from './progress-list';
import { MeetingKind, Translated, meetingTitleKey } from './shared';

@Component({
  selector: 'main[app-progress-page]',
  imports: [LanguagePicker, ProgressList],
  template: `
@if (reconnecting()) {
  <div class="reconnecting-message" role="status" aria-live="polite">
    {{ t('connection.reconnecting') }}<span aria-hidden="true">{{ dots() }}</span>
  </div>
}

<div class="progress-display-link">
  <a href="display">{{ t('progress.back') }}</a>
</div>

<header class="progress-header">
  <h1>{{ t(meetingTitleKey(meeting())) }}</h1>
  <div class="progress-actions">
    <label app-language-picker [persist]="false"></label>
  </div>
</header>

<ol app-progress-list [rows]="rows()" [meeting]="meeting()"></ol>
`,
  host: { class: 'progress-page' },
})
export class ProgressPage extends Translated {
  readonly meeting = input.required<MeetingKind>();
  readonly rows = input.required<ProgressRow[]>();
  readonly reconnecting = input(false);
  readonly dots = input.required<string>();

  protected readonly meetingTitleKey = meetingTitleKey;
}
