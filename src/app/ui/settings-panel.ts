import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MeetingSettingsChanges } from '../services/api.service';
import { LANGUAGES, TranslationKey } from '../i18n/i18n';
import { Translated } from './shared';

@Component({
  selector: 'section[app-settings-panel]',
  imports: [FormsModule],
  template: `
<h2>{{ t('settings.title') }}</h2>
@let d = draft();
<div class="settings-grid">
  <fieldset>
    <legend>{{ t('settings.midweek') }}</legend>
    <label class="setup-field">
      <span>{{ t('settings.start') }}</span>
      <input type="time" [(ngModel)]="d.midweekStart" />
    </label>
    <label class="setup-field">
      <span>{{ t('settings.end') }}</span>
      <input type="time" [(ngModel)]="d.midweekEnd" />
    </label>
  </fieldset>
  <fieldset>
    <legend>{{ t('settings.weekend') }}</legend>
    <label class="setup-field">
      <span>{{ t('settings.day') }}</span>
      <select [(ngModel)]="d.weekendDay">
        @for (day of weekdayOptions; track day.value) {
          <option [ngValue]="day.value">{{ day.name }}</option>
        }
      </select>
    </label>
    <label class="setup-field">
      <span>{{ t('settings.start') }}</span>
      <input type="time" [(ngModel)]="d.weekendStart" />
    </label>
    <label class="setup-field">
      <span>{{ t('settings.end') }}</span>
      <input type="time" [(ngModel)]="d.weekendEnd" />
    </label>
  </fieldset>
  <fieldset>
    <legend>{{ t('settings.adaptive') }}</legend>
    <label class="setup-field">
      <select [(ngModel)]="d.adaptiveMode">
        <option value="none">{{ t('settings.adaptive.none') }}</option>
        <option value="oneWay">{{ t('settings.adaptive.oneWay') }}</option>
        <option value="twoWay">{{ t('settings.adaptive.twoWay') }}</option>
      </select>
    </label>
  </fieldset>
  <fieldset>
    <legend>{{ t('settings.congregationLanguage') }}</legend>
    <label class="setup-field">
      <select [(ngModel)]="d.congregationLanguage">
        @for (language of languages; track language.code) {
          <option [value]="language.code">{{ language.name }}</option>
        }
      </select>
    </label>
  </fieldset>
</div>
<div class="settings-actions">
  @if (error(); as key) {
    <p class="setup-error settings-error" role="alert">{{ t(key) }}</p>
  }
  <button class="text-button" type="button" (click)="cancelled.emit()">{{ t('common.cancel') }}</button>
  <button class="start-button" type="button" (click)="saved.emit()" [disabled]="saving()">{{ t('common.save') }}</button>
</div>
`,
  host: { class: 'settings-card' },
})
export class SettingsPanel extends Translated {
  readonly draft = input.required<MeetingSettingsChanges>();
  readonly error = input<TranslationKey | ''>('');
  readonly saving = input(false);
  readonly cancelled = output<void>();
  readonly saved = output<void>();
  protected readonly languages = LANGUAGES;

  // A getter rather than computed(): the language is not a signal.
  protected get weekdayOptions(): { value: number; name: string }[] {
    const formatter = new Intl.DateTimeFormat(this.i18n.language, { weekday: 'long' });
    // 2024-01-07 was a Sunday, matching Date.getDay() numbering.
    return Array.from({ length: 7 }, (_, value) => ({
      value,
      name: formatter.format(new Date(2024, 0, 7 + value)),
    }));
  }
}
