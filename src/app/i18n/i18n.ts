import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { pt } from './pt';
import type { Translations } from './en';

export type { TranslationKey, Translations } from './en';

export type LanguageCode = 'en' | 'es' | 'pt' | 'fr' | 'it';

export const LANGUAGES: { code: LanguageCode; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
];

export const TRANSLATIONS: Record<LanguageCode, Translations> = { en, es, pt, fr, it };
