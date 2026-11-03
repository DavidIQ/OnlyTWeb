import { Component, input } from '@angular/core';
import { LanguagePicker } from './language-picker';
import { ProgressList, ProgressRow } from './progress-list';
import { MeetingKind, Translated, meetingTitleKey } from './shared';

@Component({
  selector: 'main[app-progress-page]',
  imports: [LanguagePicker, ProgressList],
  template: `
<header class="progress-header">
  <h1>{{ t(meetingTitleKey(meeting())) }}</h1>
  <div class="progress-actions">
    <a href="/display">{{ t('progress.back') }}</a>
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

  protected readonly meetingTitleKey = meetingTitleKey;
}
