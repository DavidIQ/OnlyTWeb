import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SchedulePreviewItem } from '../services/api.service';
import { Translated } from './shared';

@Component({
  selector: 'section[app-setup-card]',
  imports: [FormsModule],
  template: `
<p class="eyebrow">{{ t('setup.eyebrow') }}</p>
<h1>{{ t('setup.title') }}</h1>
<p class="subheading">{{ t('setup.intro') }}</p>

<div class="setup-grid">
  <div class="setup-options">
    <h2>{{ t('setup.options') }}</h2>
    <label class="setup-check">
      <input
        type="checkbox"
        [ngModel]="circuitVisit()"
        (ngModelChange)="circuitVisitChange.emit($event)"
      />
      {{ t('setup.circuitVisit') }}
    </label>
    <p class="setup-note">{{ t('setup.note') }}</p>
    <button
      class="start-button setup-import"
      type="button"
      (click)="importRequested.emit()"
      [disabled]="importing() || previewFailed() || !items().length"
    >
      {{ importing() ? t('setup.importing') : t('setup.import') }}
    </button>
  </div>

  <div class="setup-preview">
    <h2>{{ t('setup.preview') }}</h2>
    @if (previewFailed()) {
      <p class="setup-error" role="alert">{{ t('setup.previewFailed') }}</p>
    } @else {
      <ol class="schedule-list">
        @for (item of items(); track item.talkId; let index = $index) {
          <li class="setup-row">
            <span class="schedule-index">{{ (index + 1).toString().padStart(2, '0') }}</span>
            <span class="schedule-content">
              <span class="schedule-title">{{ i18n.talkTitle(item) }}</span>
              <span class="schedule-section">{{ i18n.sectionName(item.meetingSectionNameInternal) }}</span>
            </span>
            <span class="schedule-duration">{{ t('setup.minutes', { n: item.originalDurationSecs / 60 }) }}</span>
          </li>
        }
      </ol>
      <p class="setup-total">
        {{ t('setup.total') }}: {{ t('setup.minutes', { n: totalSeconds() / 60 }) }}
      </p>
    }
  </div>
</div>
`,
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
