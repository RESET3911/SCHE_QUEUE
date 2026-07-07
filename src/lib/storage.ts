import type { Settings } from '../types';
import { DEFAULT_SUBCATEGORIES } from '../data/defaults';

const KEY = 'schequeue:settings:v1';

export function defaultSettings(): Settings {
  return {
    clientId: '',
    selfCalendarId: '',
    familyCalendarId: '',
    subCategories: DEFAULT_SUBCATEGORIES,
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...defaultSettings(), ...parsed };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
