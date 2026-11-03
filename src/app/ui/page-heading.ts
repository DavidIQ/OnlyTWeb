import { Component, input, output } from '@angular/core';
import { Translated } from './shared';

@Component({
  selector: 'section[app-page-heading]',
  template: `
<div>
  <h1>{{ t('heading.title') }}</h1>
</div>
<div class="heading-actions">
  <button class="text-button" type="button" (click)="settingsRequested.emit()" [attr.aria-expanded]="settingsOpen()">
    <svg class="cog-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    {{ t('settings.button') }}
  </button>
  <a class="display-link" href="/display" target="_blank" rel="noreferrer">{{ t('heading.openDisplay') }}</a>
  <div class="session-chip">
    <span class="session-dot" [class.running]="running()"></span>
    {{ running() ? t('session.running') : t('session.ready') }}
  </div>
</div>
`,
  host: { class: 'page-heading' },
})
export class PageHeading extends Translated {
  readonly running = input.required<boolean>();
  readonly settingsOpen = input.required<boolean>();
  readonly settingsRequested = output<void>();
}
