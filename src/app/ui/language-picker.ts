import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Translated } from './shared';

@Component({
  selector: 'label[app-language-picker]',
  imports: [FormsModule],
  template: `
<span class="visually-hidden">{{ t('language.label') }}</span>
<select
  [ngModel]="i18n.language"
  (ngModelChange)="onChange($event)"
  [attr.aria-label]="t('language.label')"
>
  @for (language of i18n.languages; track language.code) {
    <option [value]="language.code">{{ language.name }}</option>
  }
</select>
`,
  host: { class: 'language-picker' },
})
export class LanguagePicker extends Translated {
  // On the progress page the choice only lasts for this visit.
  readonly persist = input(true);

  protected onChange(code: string): void {
    this.i18n.setLanguage(code, this.persist());
  }
}
