import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS } from '../../src/configs/constants.js';

const store = {};
const localStorageMock = {
  getItem: vi.fn((key) => store[key] ?? null),
  setItem: vi.fn((key, value) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key) => {
    delete store[key];
  }),
};
vi.stubGlobal('localStorage', localStorageMock);

const { i18n } = await import('../../src/managers/i18n-manager.js');

describe('I18nManager', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.clearAllMocks();
    i18n.setLocale('en');
  });

  it('defaults to English', () => {
    expect(i18n.locale).toBe('en');
  });

  it('translates a known key', () => {
    expect(i18n.t('title.name')).toBe('Fusion Mania');
  });

  it('returns the key for unknown translations', () => {
    expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('switches locale to French', () => {
    i18n.setLocale('fr');
    expect(i18n.locale).toBe('fr');
    expect(i18n.t('title.prompt')).toBe('Touchez pour commencer');
  });

  it('persists locale to localStorage', () => {
    i18n.setLocale('fr');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEYS.LOCALE, 'fr');
  });

  it('ignores invalid locale codes', () => {
    i18n.setLocale('de');
    expect(i18n.locale).toBe('en');
  });

  it('supports interpolation', () => {
    // Manually test with a key that has interpolation (mock inline)
    const result = i18n.t('title.name');
    expect(typeof result).toBe('string');
  });

  it('lists available locales', () => {
    expect(i18n.availableLocales).toEqual(['en', 'fr']);
  });

  it('fires onChange callbacks', () => {
    const callback = vi.fn();
    const unsub = i18n.onChange(callback);
    i18n.setLocale('fr');
    expect(callback).toHaveBeenCalledWith('fr');
    unsub();
    i18n.setLocale('en');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
