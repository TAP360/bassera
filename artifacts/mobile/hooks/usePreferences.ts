import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConsumerProfile } from "@workspace/api-client-react";

import { useLocalization, type Language } from "@/localization";
import { useAuthStore } from "@/stores/authStore";
import {
  pickPreferences,
  sanitizePreferences,
  usePreferencesStore,
  type Preferences,
} from "@/stores/preferencesStore";
import { useConsumerProfileUpdate } from "./useConsumerProfileUpdate";
import { consumerQueryKey, useConsumerSession } from "./useConsumerSession";

/** Parses the profile's JSON-encoded preferences, keeping keys this app does not manage. */
export function parseRawPreferences(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Effective preferences (local store, kept in sync with GET /me) plus the UI language. */
export function usePreferences(): Preferences & { language: Language } {
  const currency = usePreferencesStore((state) => state.currency);
  const theme = usePreferencesStore((state) => state.theme);
  const biometric = usePreferencesStore((state) => state.biometric);
  const notifications = usePreferencesStore((state) => state.notifications);
  const { language } = useLocalization();
  return { currency, theme, biometric, notifications, language };
}

/**
 * Saves preferences with PUT /me. Preference changes apply locally first and roll back if the
 * request fails; a language change is saved before switching, because switching reloads the app.
 */
export function useSavePreferences() {
  const queryClient = useQueryClient();
  const profileUpdate = useConsumerProfileUpdate();
  const { language: currentLanguage, setLanguage } = useLocalization();

  const save = async (changes: Partial<Preferences> & { language?: Language }) => {
    const { language, ...preferenceChanges } = changes;
    const store = usePreferencesStore.getState();
    const previous = Object.fromEntries(
      Object.keys(preferenceChanges).map((key) => [key, store[key as keyof Preferences]]),
    ) as Partial<Preferences>;
    store.setPreferences(preferenceChanges);

    const userId = useAuthStore.getState().tokens?.userId;
    if (userId) {
      const consumer = queryClient.getQueryData<ConsumerProfile>(consumerQueryKey(userId));
      const merged = {
        ...parseRawPreferences(consumer?.preferences),
        ...pickPreferences(usePreferencesStore.getState()),
      };
      try {
        await profileUpdate.update({
          ...(language && language !== currentLanguage ? { language } : {}),
          preferences: JSON.stringify(merged),
        });
      } catch (error) {
        usePreferencesStore.getState().setPreferences(previous);
        throw error;
      }
    }
    if (language && language !== currentLanguage) await setLanguage(language);
  };

  return { save, isPending: profileUpdate.isPending };
}

/** Applies preferences from GET /me whenever the server values change (e.g. sign-in on a new device). */
export function usePreferenceSync(): void {
  const { data: consumer } = useConsumerSession();
  const { language, setLanguage } = useLocalization();
  const appliedPreferences = useRef<string | undefined>(undefined);
  const appliedLanguage = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!consumer) return;
    // Tracked separately so a server that ignores one field cannot revert the other locally.
    const preferencesSignature = `${consumer.id}|${consumer.preferences ?? ""}`;
    if (preferencesSignature !== appliedPreferences.current) {
      appliedPreferences.current = preferencesSignature;
      usePreferencesStore.getState().setPreferences(sanitizePreferences(parseRawPreferences(consumer.preferences)));
    }
    const languageSignature = `${consumer.id}|${consumer.language ?? ""}`;
    if (languageSignature !== appliedLanguage.current) {
      appliedLanguage.current = languageSignature;
      const serverLanguage = consumer.language?.toLowerCase();
      if ((serverLanguage === "ar" || serverLanguage === "en") && serverLanguage !== language) {
        void setLanguage(serverLanguage);
      }
    }
  }, [consumer, language, setLanguage]);
}
