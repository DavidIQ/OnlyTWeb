import { Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslationKey } from '../i18n/i18n';
import { ProgressList, ProgressRow } from './progress-list';
import { MeetingKind, Translated } from './shared';

@Component({
  selector: 'section[app-report-panel]',
  imports: [FormsModule, ProgressList],
  template: `
<h2>{{ t('report.title') }}</h2>
<div class="report-from">
  <span class="report-label">{{ t('report.from') }}</span>
  <span class="report-from-address">{{ from() }}</span>
</div>
<div class="report-from">
  <span class="report-label">{{ t('report.subject') }}</span>
  <span class="report-from-address">{{ subject() }}</span>
</div>
<label class="setup-field">
  <span>{{ t('report.recipients') }}</span>
  <span class="input-with-clear">
    <input type="text" name="recipients" autocomplete="email" [ngModel]="recipients()" (ngModelChange)="recipients.set($event)" [attr.aria-invalid]="!!error()" />
    @if (recipients()) {
      <button class="clear-button" type="button" [attr.aria-label]="t('report.clear')" (click)="recipientsCleared.emit()">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>
      </button>
    }
  </span>
  <span class="field-hint">{{ t('report.hint') }}</span>
</label>
<div class="progress-page report-preview" #reportPreview>
  <h1>{{ reportTitle() }}</h1>
  <ol app-progress-list [rows]="rows()" [meeting]="meeting()"></ol>
</div>
<div class="settings-actions">
  @if (error(); as key) {
    <p class="setup-error settings-error" role="alert">{{ t(key) }}</p>
  }
  <button class="text-button" type="button" (click)="cancelled.emit()">{{ t('common.cancel') }}</button>
  <button class="start-button" type="button" (click)="sendRequested.emit(reportPreview)" [disabled]="sending()">{{ sending() ? t('report.sending') : t('report.send') }}</button>
</div>
`,
  host: { class: 'settings-card report-card' },
})
export class ReportPanel extends Translated {
  readonly from = input.required<string>();
  readonly subject = input.required<string>();
  readonly recipients = model.required<string>();
  readonly error = input<TranslationKey | ''>('');
  readonly sending = input(false);
  readonly meeting = input.required<MeetingKind>();
  readonly rows = input.required<ProgressRow[]>();
  readonly reportTitle = input.required<string>();
  readonly cancelled = output<void>();
  readonly recipientsCleared = output<void>();
  readonly sendRequested = output<HTMLElement>();
}
