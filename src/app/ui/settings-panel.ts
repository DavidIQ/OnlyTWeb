import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MeetingSettingsChanges } from '../services/api.service';
import { TranslationKey } from '../i18n/i18n';
import { Translated } from './shared';

@Component({
  selector: 'section[app-settings-panel]',
  imports: [FormsModule],
  templateUrl: './settings-panel.html',
  host: { class: 'settings-card' },
})
export class SettingsPanel extends Translated {
  readonly draft = input.required<MeetingSettingsChanges>();
  readonly error = input<TranslationKey | ''>('');
  readonly saving = input(false);
  readonly cancelled = output<void>();
  readonly saved = output<void>();

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
