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
}

@Component({
  selector: 'ol[app-progress-list]',
  imports: [NgTemplateOutlet],
  templateUrl: './progress-list.html',
  host: { class: 'progress-list' },
})
export class ProgressList {
  readonly rows = input.required<ProgressRow[]>();
  readonly meeting = input.required<MeetingKind>();

  protected readonly formatTimer = formatTimer;
  protected readonly formatRemaining = formatRemaining;
}
