import { useQuery } from "@tanstack/react-query";

import { useLocalization } from "@/localization";
import { useAuthStore } from "@/stores/authStore";
import { httpClient } from "@/utils/httpClient";
import type { ConsumerTransaction } from "@/types/transaction";

export interface RecentTransaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  type: "income" | "expense";
}

export const recentTransactionsQueryKey = (userId?: string) =>
  ["identity", "consumer", "transactions", userId ?? null] as const;

export function useRecentTransactions(enabled = true) {
  const tokens = useAuthStore((state) => state.tokens);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const { isRTL, t } = useLocalization();

  const query = useQuery({
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

  const transactions = (query.data ?? []).slice(0, 4).map((transaction) => {
    const transactionDate = new Date(transaction.transactionDate);
    return {
      id: transaction.id,
      title:
        transaction.merchantName ||
        transaction.description ||
        transaction.category ||
        t("Transaction"),
      category: transaction.category || t("Other"),
      amount: transaction.amount,
      currency: transaction.currency,
      date: Number.isNaN(transactionDate.getTime())
        ? transaction.transactionDate
        : transactionDate.toLocaleDateString(isRTL ? "ar-EG" : "en-EG", {
            day: "numeric",
            month: "short",
          }),
      type: transaction.amount >= 0 ? ("income" as const) : ("expense" as const),
    };
  });

  return { ...query, data: query.data ? transactions : undefined };
}
