import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SchedulePreviewItem } from '../api.service';
import { Translated } from './shared';

@Component({
  selector: 'section[app-setup-card]',
  imports: [FormsModule],
  templateUrl: './setup-card.html',
  host: { class: 'setup-card' },
})
export class SetupCard extends Translated {
  readonly circuitVisit = input.required<boolean>();
  readonly items = input.required<SchedulePreviewItem[]>();
  readonly previewFailed = input.required<boolean>();
  readonly importing = input.required<boolean>();
  readonly circuitVisitChange = output<boolean>();
  readonly importRequested = output<void>();

  protected readonly totalSeconds = computed(() => this.items().reduce((total, item) => total + item.originalDurationSecs, 0));
}
