import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LANGUAGES, LanguageCode } from '../i18n/i18n';
import { ProgressList, ProgressRow } from './progress-list';
import { MeetingKind, Translated, meetingTitleKey } from './shared';

@Component({
  selector: 'main[app-progress-page]',
  imports: [FormsModule, ProgressList],
  template: `
@if (reconnecting()) {
  <div class="reconnecting-message" role="status" aria-live="polite">
    {{ i18n.tFor(language(), 'connection.reconnecting') }}<span aria-hidden="true">{{ dots() }}</span>
  </div>
}

<div class="progress-display-link">
  <a href="display">{{ i18n.tFor(language(), 'progress.back') }}</a>
</div>

<header class="progress-header">
  <h1>{{ i18n.tFor(language(), meetingTitleKey(meeting())) }}</h1>
  <div class="progress-actions">
    <label class="language-picker">
      <span class="visually-hidden">{{ i18n.tFor(language(), 'language.label') }}</span>
      <select [ngModel]="language()" (ngModelChange)="languageChange.emit($event)" [attr.aria-label]="i18n.tFor(language(), 'language.label')">
        @for (option of languages; track option.code) {
          <option [value]="option.code">{{ option.name }}</option>
        }
      </select>
    </label>
  </div>
</header>

<ol app-progress-list [rows]="rows()" [meeting]="meeting()"></ol>
`,
  host: { class: 'progress-page' },
})
export class ProgressPage extends Translated {
  readonly meeting = input.required<MeetingKind>();
  readonly language = input.required<LanguageCode>();
  readonly rows = input.required<ProgressRow[]>();
  readonly reconnecting = input(false);
  readonly dots = input.required<string>();
  readonly languageChange = output<LanguageCode>();

  protected readonly languages = LANGUAGES;
  protected readonly meetingTitleKey = meetingTitleKey;
}
