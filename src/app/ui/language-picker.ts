import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Translated } from './shared';

@Component({
  selector: 'label[app-language-picker]',
  imports: [FormsModule],
  templateUrl: './language-picker.html',
  host: { class: 'language-picker' },
})
export class LanguagePicker extends Translated {
  // On the progress page the choice only lasts for this visit.
  readonly persist = input(true);

  protected onChange(code: string): void {
    this.i18n.setLanguage(code, this.persist());
  }
}
