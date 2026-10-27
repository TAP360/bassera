import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/stores/authStore";
import { httpClient } from "@/utils/httpClient";
import type { ConsumerTransaction } from "@/types/transaction";

export const recentTransactionsQueryKey = (userId?: string) =>
  ["identity", "consumer", "transactions", userId ?? null] as const;

export function useRecentTransactions(enabled = true) {
  const tokens = useAuthStore((state) => state.tokens);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  return useQuery({
    queryKey: recentTransactionsQueryKey(tokens?.userId),
    enabled: enabled && !!tokens && sessionReady,
    staleTime: 30_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const response = await httpClient.get<ConsumerTransaction[]>(
        "/v1/profile/consumer-apis/consumers/me/transactions",
        { signal },
      );
      return response.data;
    },
  });
}
