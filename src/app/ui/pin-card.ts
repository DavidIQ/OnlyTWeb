import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslationKey } from '../i18n/i18n';
import { Translated } from './shared';

@Component({
  selector: 'section[app-pin-card]',
  imports: [FormsModule],
  template: `
<h1>{{ t('pin.title') }}</h1>
<p class="subheading">{{ t('pin.intro') }}</p>
<form class="pin-form" (ngSubmit)="submit()">
  <input
    class="pin-input"
    name="pin"
    type="password"
    inputmode="numeric"
    autocomplete="one-time-code"
    maxlength="4"
    pattern="[0-9]{4}"
    [attr.aria-label]="t('pin.label')"
    [(ngModel)]="pin"
  />
  @if (error(); as key) {
    <p class="setup-error" role="alert">{{ t(key) }}</p>
  }
  <button class="start-button" type="submit" [disabled]="pin.length !== 4 || busy()">{{ t('pin.submit') }}</button>
</form>
`,
  host: { class: 'setup-card pin-card' },
})
export class PinCard extends Translated {
  readonly error = input<TranslationKey | ''>('');
  readonly busy = input(false);
  readonly pinSubmitted = output<string>();

  protected pin = '';

  protected submit(): void {
    if (this.pin.length !== 4 || this.busy()) {
      return;
    }
    this.pinSubmitted.emit(this.pin);
    this.pin = '';
  }
}
