import { Component, input } from '@angular/core';
import { LanguagePicker } from './language-picker';
import { ProgressList, ProgressRow } from './progress-list';
import { MeetingKind, Translated, meetingTitleKey } from './shared';

@Component({
  selector: 'main[app-progress-page]',
  imports: [LanguagePicker, ProgressList],
  templateUrl: './progress-page.html',
  host: { class: 'progress-page' },
})
export class ProgressPage extends Translated {
  readonly meeting = input.required<MeetingKind>();
  readonly rows = input.required<ProgressRow[]>();

  protected readonly meetingTitleKey = meetingTitleKey;
}
