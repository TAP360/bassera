import { useMutation, useQueryClient } from "@tanstack/react-query";

import { recentTransactionsQueryKey } from "@/hooks/useRecentTransactions";
import { useAuthStore } from "@/stores/authStore";
import type { ConsumerTransaction } from "@/types/transaction";
import { httpClient } from "@/utils/httpClient";

export type TransactionFeeling =
  | "PLANNED"
  | "IMPULSE"
  | "ROUTINE"
  | "STRESSED"
  | "REWARD"
  | "REGRET";

export interface CreateTransactionInput {
  amount: number;
  currency: string;
  merchantName?: string;
  type: "POS";
  source: "MANUAL";
  category?: string;
  transactionDate: string;
  feeling?: TransactionFeeling;
  note?: string;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.tokens?.userId);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  return useMutation({
    mutationFn: async (transaction: CreateTransactionInput) => {
      if (!sessionReady || !userId) {
        throw new Error("INVALID_SESSION");
      }

      const response = await httpClient.post<ConsumerTransaction>(
        "/v1/profile/consumer-apis/consumers/me/transactions",
        transaction,
      );
      return response.data;
    },
    onSuccess: async (transaction) => {
      if (!userId) return;

      const queryKey = recentTransactionsQueryKey(userId);
      queryClient.setQueryData<ConsumerTransaction[]>(queryKey, (current) => [
        transaction,
        ...(current ?? []).filter((item) => item.id !== transaction.id),
      ]);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
}
