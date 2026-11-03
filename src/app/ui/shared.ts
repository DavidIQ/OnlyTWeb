import { inject } from '@angular/core';
import { TranslationKey } from '../i18n';
import { I18nService } from '../i18n.service';

export type MeetingKind = 'midweek' | 'weekend';

export abstract class Translated {
  protected readonly i18n = inject(I18nService);

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}

export function meetingTitleKey(meeting: MeetingKind): TranslationKey {
  return meeting === 'weekend' ? 'progress.titleWeekend' : 'progress.titleMidweek';
}

export function formatTimer(seconds: number): string {
  const absoluteSeconds = Math.abs(Math.trunc(seconds));
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;
  return `${seconds < 0 ? '-' : ''}${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function formatRemaining(remaining: number): string {
  const prefix = remaining === 0 ? '' : remaining > 0 ? '- ' : '+ ';
  const absolute = Math.abs(remaining);
  return `${prefix}${String(Math.floor(absolute / 60) % 60).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}
