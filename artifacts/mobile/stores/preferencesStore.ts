import { Appearance, Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createEncryptedPersist } from './encryptedPersist';

export const CURRENCIES = ['EGP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'USD', 'EUR'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEMES)[number];

/** Keys stored in the identity profile's JSON-encoded `preferences` field. */
export interface Preferences {
  currency: CurrencyCode;
  theme: ThemePreference;
  biometric: boolean;
  notifications: boolean;
}

interface PreferencesStore extends Preferences {
  setPreferences: (changes: Partial<Preferences>) => void;
  /** Clears account-specific preferences on sign-out; appearance stays a device choice. */
  resetAccountPreferences: () => void;
}

export const defaultPreferences: Preferences = {
  currency: 'EGP',
  theme: 'system',
  biometric: false,
  notifications: true,
};

/** Keeps only recognized, well-typed values (from storage or the server). */
export function sanitizePreferences(raw: unknown): Partial<Preferences> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const result: Partial<Preferences> = {};
  if (CURRENCIES.includes(value.currency as CurrencyCode)) result.currency = value.currency as CurrencyCode;
  if (THEMES.includes(value.theme as ThemePreference)) result.theme = value.theme as ThemePreference;
  if (typeof value.biometric === 'boolean') result.biometric = value.biometric;
  if (typeof value.notifications === 'boolean') result.notifications = value.notifications;
  return result;
}

export function pickPreferences(state: Preferences): Preferences {
  return {
    currency: state.currency,
    theme: state.theme,
    biometric: state.biometric,
    notifications: state.notifications,
  };
}

export const PREFERENCES_STORAGE_KEY = '@bassera_preferences';
const preferencesPersist = createEncryptedPersist<Preferences>('APP_STORAGE_FAILED');

export const usePreferencesStore = create<PreferencesStore>()(
  persist<PreferencesStore, [], [], Preferences>(
    (set) => ({
      ...defaultPreferences,
      setPreferences: (changes) => set(sanitizePreferences(changes)),
      resetAccountPreferences: () =>
        set({
          currency: defaultPreferences.currency,
          biometric: defaultPreferences.biometric,
          notifications: defaultPreferences.notifications,
        }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: 1,
      storage: preferencesPersist.storage,
      skipHydration: true,
      partialize: pickPreferences,
      merge: (persisted, current) => ({ ...current, ...sanitizePreferences(persisted) }),
    },
  ),
);

function applyTheme(theme: ThemePreference): void {
  // Overrides the scheme for native components too (switches, alerts, keyboard).
  if (Platform.OS !== 'web') Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
}

usePreferencesStore.subscribe((state, previous) => {
  if (state.theme !== previous.theme) applyTheme(state.theme);
});

export async function hydratePreferencesStore(): Promise<void> {
  await preferencesPersist.hydrate(usePreferencesStore);
  applyTheme(usePreferencesStore.getState().theme);
}
