import { Injectable } from '@angular/core';
import { LANGUAGES, LanguageCode, TRANSLATIONS, TranslationKey } from './i18n/i18n';

const STORAGE_KEY = 'onlyt.language';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly languages = LANGUAGES;
  private current: LanguageCode = this.detectInitialLanguage();

  constructor() {
    document.documentElement.lang = this.current;
  }

  get language(): LanguageCode {
    return this.current;
  }

  setLanguage(code: string, persist = true): void {
    if (!this.isSupported(code)) {
      return;
    }
    // Always store the choice, even when it matches the auto-detected language.
    if (persist) {
      this.persist(code);
    }
    this.current = code;
    document.documentElement.lang = code;
  }

  // Applies a language chosen in another window (e.g. the operator console driving the display).
  syncFromStorage(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null || !this.isSupported(stored) || stored === this.current) {
      return false;
    }
    this.current = stored;
    document.documentElement.lang = stored;
    return true;
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    let text: string = TRANSLATIONS[this.current][key] ?? TRANSLATIONS.en[key];
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace(`{${name}}`, String(value));
    }
    return text;
  }

  has(key: string): key is TranslationKey {
    return key in TRANSLATIONS.en;
  }

  talkTitle(talk: { talkKey: string; talkTitle: string }): string {
    const key = `talk.${talk.talkKey}`;
    return this.has(key) ? this.t(key) : talk.talkTitle;
  }

  sectionName(sectionInternal: string): string {
    const key = `section.${sectionInternal.toLowerCase()}`;
    return this.has(key) ? this.t(key) : sectionInternal;
  }

  private persist(code: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Storage can be unavailable (private mode); the choice then only lasts for this visit.
    }
  }

  private isSupported(code: string): code is LanguageCode {
    return this.languages.some((language) => language.code === code);
  }

  private detectInitialLanguage(): LanguageCode {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && this.isSupported(stored)) {
      return stored;
    }
    for (const candidate of navigator.languages ?? [navigator.language]) {
      const base = candidate.toLowerCase().split('-')[0];
      if (this.isSupported(base)) {
        return base;
      }
    }
    return 'en';
  }
}
