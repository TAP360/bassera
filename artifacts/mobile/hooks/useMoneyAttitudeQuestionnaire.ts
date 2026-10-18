import {
  getGetConsumerQuestionnaireQueryKey,
  useGetConsumerQuestionnaire,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/stores/authStore";
import { parseQuestionnaire } from "@/utils/questionnaireScoring";
import "@/utils/identityTransport";

export const MONEY_ATTITUDE_CODE = "MONEY_ATTITUDE";

/** Fetches the onboarding questionnaire once the consumer session is ready. */
export function useMoneyAttitudeQuestionnaire(enabled = true) {
  const tokens = useAuthStore((state) => state.tokens);
  const ready = useAuthStore((state) => state.sessionReady);
  return useGetConsumerQuestionnaire(MONEY_ATTITUDE_CODE, {
    query: {
      queryKey: getGetConsumerQuestionnaireQueryKey(MONEY_ATTITUDE_CODE),
      enabled: enabled && !!tokens && ready,
      select: parseQuestionnaire,
      // Matches the server's `Cache-Control: max-age=3600`.
      staleTime: 60 * 60 * 1000,
      retry: 1,
    },
  });
}
