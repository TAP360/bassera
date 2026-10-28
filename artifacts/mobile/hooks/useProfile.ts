import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConsumerProfile, ConsumerProfileDemographics } from "@workspace/api-client-react";

import { useLocalization } from "@/localization";
import { useAppStore, type LocalProfile } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";
import { useConsumerProfileUpdate } from "./useConsumerProfileUpdate";
import { consumerQueryKey, consumerQueryOptions } from "./useConsumerSession";

/** `preferences` is a JSON-encoded string (JSONB) on the identity API. */
export interface ConsumerPreferences {
  currency?: string;
  notifications?: boolean;
  [key: string]: unknown;
}

export interface ProfileDetails extends LocalProfile {
  id?: string;
  /** Server name, or a localized placeholder when the user has not set one. */
  name: string;
  email: string;
  language?: string;
  halalMode: boolean;
  accountStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Localized "Mon YYYY" from createdAt, falling back to the local join date. */
  memberSince: string;
  preferences: ConsumerPreferences;
  demographics: ConsumerProfileDemographics | null;
}

export function parsePreferences(raw: string | null | undefined): ConsumerPreferences {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const preferences = { ...(parsed as Record<string, unknown>) } as ConsumerPreferences;
    if (typeof preferences.currency !== "string") delete preferences.currency;
    if (typeof preferences.notifications !== "boolean") delete preferences.notifications;
    return preferences;
  } catch {
    return {};
  }
}

function formatMemberSince(createdAt: string | undefined, language: string): string | undefined {
  if (!createdAt) return undefined;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: "short", year: "numeric" });
}

export function toProfileDetails(
  consumer: ConsumerProfile | undefined,
  local: LocalProfile,
  language: string,
): ProfileDetails {
  return {
    ...local,
    id: consumer?.id,
    name: consumer?.name?.trim() || (language === "ar" ? "عضو بصيرة" : "Bassera member"),
    email: consumer?.email ?? "",
    language: consumer?.language,
    halalMode: consumer?.halalMode === true,
    accountStatus: consumer?.accountStatus,
    createdAt: consumer?.createdAt,
    updatedAt: consumer?.updatedAt,
    memberSince: formatMemberSince(consumer?.createdAt, language) ?? local.joinDate,
    preferences: parsePreferences(consumer?.preferences),
    demographics: consumer?.demographics ?? null,
  };
}

/**
 * Profile details from GET /v1/identity/consumer/me merged with device-only profile data.
 * Shares the session's query cache entry, so it never triggers a duplicate request.
 */
export function useProfile() {
  const tokens = useAuthStore((state) => state.tokens);
  const ready = useAuthStore((state) => state.sessionReady);
  const cached = useAuthStore((state) => state.profile);
  const localProfile = useAppStore((state) => state.profile);
  const { language } = useLocalization();

  const query = useQuery({
    ...consumerQueryOptions(tokens),
    enabled: !!tokens && ready,
    // Show the last persisted profile instantly (and offline) while /me refreshes.
    placeholderData: cached && cached.id === tokens?.userId ? cached : undefined,
  });

  const profile = useMemo(
    () => toProfileDetails(query.data, localProfile, language),
    [query.data, localProfile, language],
  );

  return { ...query, profile };
}

/** Optimistically toggles halal mode, persisting it with PATCH /me. */
export function useHalalModeToggle() {
  const queryClient = useQueryClient();
  const profileUpdate = useConsumerProfileUpdate();
  const userId = useAuthStore((state) => state.tokens?.userId);

  return {
    isPending: profileUpdate.isPending,
    setHalalMode: async (halalMode: boolean) => {
      const key = consumerQueryKey(userId);
      const previous = queryClient.getQueryData<ConsumerProfile>(key);
      if (previous) queryClient.setQueryData(key, { ...previous, halalMode });
      try {
        await profileUpdate.update({ halalMode });
      } catch (error) {
        if (previous) queryClient.setQueryData(key, previous);
        throw error;
      }
    },
  };
}
