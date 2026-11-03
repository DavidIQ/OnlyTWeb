import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslationKey } from '../i18n';
import { ProgressList, ProgressRow } from './progress-list';
import { MeetingKind, Translated, meetingTitleKey } from './shared';

@Component({
  selector: 'section[app-report-panel]',
  imports: [FormsModule, ProgressList],
  templateUrl: './report-panel.html',
  host: { class: 'settings-card report-card' },
})
export class ReportPanel extends Translated {
  readonly from = input.required<string>();
  readonly recipients = model.required<string>();
  readonly error = input<TranslationKey | ''>('');
  readonly sending = input(false);
  readonly meeting = input.required<MeetingKind>();
  readonly rows = input.required<ProgressRow[]>();
  readonly cancelled = output<void>();
  readonly sendRequested = output<HTMLElement>();

  protected readonly meetingTitleKey = meetingTitleKey;
}
