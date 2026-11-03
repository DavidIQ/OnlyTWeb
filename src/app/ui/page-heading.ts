import { Component, input, output } from '@angular/core';
import { Translated } from './shared';

@Component({
  selector: 'section[app-page-heading]',
  templateUrl: './page-heading.html',
  host: { class: 'page-heading' },
})
export class PageHeading extends Translated {
  readonly running = input.required<boolean>();
  readonly settingsOpen = input.required<boolean>();
  readonly settingsRequested = output<void>();
}
