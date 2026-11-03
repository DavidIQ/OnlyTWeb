import { Component, input } from '@angular/core';
import { Translated, formatTimer } from './shared';

@Component({
  selector: 'main[app-display-view]',
  templateUrl: './display-view.html',
  host: {
    class: 'display-mode',
    '[class.running]': 'running()',
    '[class.overtime]': 'overtime()',
    '[class.closing]': 'closing()',
  },
})
export class DisplayView extends Translated {
  readonly running = input.required<boolean>();
  readonly overtime = input.required<boolean>();
  readonly closing = input.required<boolean>();
  readonly seconds = input.required<number>();
  readonly clockText = input.required<string>();

  protected readonly formatTimer = formatTimer;
}
