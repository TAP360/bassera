import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getCurrentConsumer,
  getGetCurrentConsumerQueryOptions,
  useGetCurrentConsumer,
  type ConsumerTokens,
} from "@workspace/api-client-react";
import { saveConsumerProfile, useAuthStore } from "@/stores/authStore";
import { revokeSession } from "@/utils/httpClient";
import "@/utils/identityTransport";

export const IDENTITY_QUERY_ROOT = ["identity", "consumer"] as const;
export const consumerQueryKey = (userId?: string) => [...IDENTITY_QUERY_ROOT, "me", userId ?? null] as const;

export function consumerQueryOptions(tokens: ConsumerTokens | null) {
  return getGetCurrentConsumerQueryOptions({
    query: {
      queryKey: consumerQueryKey(tokens?.userId),
      enabled: !!tokens,
      staleTime: 60_000,
      retry: false,
      queryFn: async ({ signal }) => {
        const profile = await getCurrentConsumer({ signal });
        if (!tokens || !profile || typeof profile.id !== "string" || profile.id !== tokens.userId) {
          throw new Error("INVALID_PROFILE");
        }
        await saveConsumerProfile(profile);
        return profile;
      },
    },
  });
}

export function useConsumerSession() {
  const tokens = useAuthStore((state) => state.tokens);
  const ready = useAuthStore((state) => state.sessionReady);
  const query = useGetCurrentConsumer({ query: {
    ...consumerQueryOptions(tokens),
    enabled: !!tokens && ready,
  } });
  return { ...query, tokens, isAuthenticated: !!tokens && ready && !!query.data && !query.isError };
}

export async function logoutSession(queryClient: QueryClient): Promise<void> {
  try {
    await revokeSession();
  } catch {
    // Server revocation is best effort (e.g. offline); the device must still sign out.
  }
  await queryClient.cancelQueries();
  // Drops every cached query (goals, transactions, …) so nothing leaks to the next account.
  queryClient.clear();
  await useAuthStore.getState().clearSession();
}

export function useSessionLogout() {
  const queryClient = useQueryClient();
  return () => logoutSession(queryClient);
}
