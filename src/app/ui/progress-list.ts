import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { MeetingKind, formatRemaining, formatTimer } from './shared';

export interface ProgressRow {
  counsel: boolean;
  heading: { key: string; text: string } | null;
  theme: string;
  state: 'done' | 'running' | 'pending';
  title: string;
  duration: number;
  times: string;
  remaining: number | null;
  closing?: boolean;
}

@Component({
  selector: 'ol[app-progress-list]',
  imports: [NgTemplateOutlet],
  template: `
<ng-template #tieIcon>
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="7" r="4"/>
    <path d="M3 22c0-5 4-8 9-8s9 3 9 8z"/>
    <path class="tie" d="M12 14.5l1.7 1.6-1 1.4 1.3 4.5h-4l1.3-4.5-1-1.4z"/>
  </svg>
</ng-template>

<ng-template #sectionIcon let-key>
  @switch (key) {
    @case ('treasures') {
      <svg viewBox="0 0 24 24"><path d="M7 3h10l5 6-10 12L2 9z"/></svg>
    }
    @case ('ministry') {
      <svg viewBox="0 0 24 24">
        <path d="M12 22V6" stroke="currentColor" stroke-width="1.6" fill="none"/>
        <ellipse cx="12" cy="4" rx="1.8" ry="3"/>
        <ellipse cx="8.3" cy="9" rx="1.8" ry="3.4" transform="rotate(-35 8.3 9)"/>
        <ellipse cx="15.7" cy="9" rx="1.8" ry="3.4" transform="rotate(35 15.7 9)"/>
        <ellipse cx="8.3" cy="15" rx="1.8" ry="3.4" transform="rotate(-35 8.3 15)"/>
        <ellipse cx="15.7" cy="15" rx="1.8" ry="3.4" transform="rotate(35 15.7 15)"/>
      </svg>
    }
    @case ('living') {
      <svg viewBox="0 0 24 24">
        <circle cx="9" cy="10" r="4.2"/><circle cx="13.5" cy="9" r="3.8"/><circle cx="12" cy="13" r="4"/>
        <ellipse cx="19" cy="11.5" rx="2.4" ry="3"/>
        <rect x="7.5" y="15" width="1.6" height="6"/><rect x="14" y="15" width="1.6" height="6"/>
      </svg>
    }
    @case ('circuitoverseer') {
      <ng-container *ngTemplateOutlet="tieIcon"></ng-container>
    }
    @case ('concludingco') {
      <ng-container *ngTemplateOutlet="tieIcon"></ng-container>
    }
    @case ('public') {
      <svg viewBox="0 0 24 24"><path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 5v-5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>
    }
    @case ('watchtower') {
      <svg viewBox="0 0 24 24"><path d="M12 6C10 4.3 6.5 3.5 2 4v14c4.5-.5 8 .3 10 2 2-1.700 5.500-2.500 10-2V4c-4.500-.5-8 .3-10 2zm-1 12.200C8.800 17.300 6.300 17 4 17V6c2.300 0 4.800.7 7 2.200zm2 0V8.200C15.200 6.700 17.700 6 20 6v11c-2.300 0-4.800.3-7 1.200z"/></svg>
    }
  }
</ng-template>

@for (row of rows(); track $index) {
  <li class="progress-row" [class]="row.theme ? 'progress-row theme-' + row.theme : 'progress-row'" [class.counsel]="row.counsel" [class.pending]="row.state === 'pending'" [class.running]="row.state === 'running'" [class.closing]="row.closing === true">
    @if (row.heading; as heading) {
      <h2 class="progress-section" [class]="'progress-section section-' + heading.key">
        <span class="section-badge" aria-hidden="true">
          <ng-container *ngTemplateOutlet="sectionIcon; context: { $implicit: heading.key }"></ng-container>
        </span>
        <span>{{ heading.text }}</span>
      </h2>
    }
    @if (meeting() === 'weekend' && row.theme) {
      <div class="progress-title weekend-title">
        <span class="section-badge" aria-hidden="true">
          <ng-container *ngTemplateOutlet="sectionIcon; context: { $implicit: row.theme }"></ng-container>
        </span>
        <span>{{ row.title }}</span>
      </div>
    } @else {
      <div class="progress-title">{{ row.title }}</div>
    }
    <div class="progress-line">
      <span class="progress-duration">{{ formatTimer(row.duration) }}</span>
      <span class="progress-times">{{ row.times }}</span>
      <span class="progress-dots"></span>
      @if (row.remaining !== null) {
        <span class="progress-remaining" [class.late]="row.remaining < 0">{{ formatRemaining(row.remaining) }}</span>
      }
    </div>
  </li>
}
`,
  host: { class: 'progress-list' },
})
export class ProgressList {
  readonly rows = input.required<ProgressRow[]>();
  readonly meeting = input.required<MeetingKind>();

  protected readonly formatTimer = formatTimer;
  protected readonly formatRemaining = formatRemaining;
}
