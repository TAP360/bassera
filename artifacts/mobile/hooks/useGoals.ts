import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/stores/authStore";
import { useLocalization } from "@/localization";
import { httpClient } from "@/utils/httpClient";

type GoalType =
  | "EMERGENCY_FUND"
  | "RETIREMENT"
  | "HOME_PURCHASE"
  | "EDUCATION"
  | "CAR_PURCHASE"
  | "TRAVEL"
  | "SAVINGS"
  | "INVESTMENT"
  | "PURCHASE"
  | "DEBT"
  | "OTHER";

type CreateGoalType = "SAVINGS" | "INVESTMENT" | "DEBT" | "PURCHASE";

export type GoalPresetId =
  | "emergency"
  | "home"
  | "investment"
  | "education"
  | "travel"
  | "health"
  | "car"
  | "savings";

interface ApiGoal {
  id: string;
  type: GoalType;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  status: "ACTIVE" | "ACHIEVED" | "ABANDONED";
}

interface CreateGoalInput {
  name: string;
  targetAmount: number;
  presetId: GoalPresetId;
}

export interface GoalListItem {
  id: string;
  title: string;
  target: number;
  current: number;
  icon: string;
  emoji: string;
  deadline: string;
  color: string;
}

const GOAL_TYPE_BY_PRESET: Record<GoalPresetId, CreateGoalType> = {
  emergency: "SAVINGS",
  home: "PURCHASE",
  investment: "INVESTMENT",
  education: "SAVINGS",
  travel: "SAVINGS",
  health: "SAVINGS",
  car: "PURCHASE",
  savings: "SAVINGS",
};

const GOAL_PRESENTATION: Record<GoalType, Pick<GoalListItem, "icon" | "emoji" | "color">> = {
  EMERGENCY_FUND: { icon: "shield", emoji: "🛡️", color: "#22C55E" },
  RETIREMENT: { icon: "shield", emoji: "🛡️", color: "#22C55E" },
  HOME_PURCHASE: { icon: "home", emoji: "🏠", color: "#2E3192" },
  EDUCATION: { icon: "book", emoji: "📚", color: "#F37021" },
  CAR_PURCHASE: { icon: "car", emoji: "🚗", color: "#F59E0B" },
  TRAVEL: { icon: "globe", emoji: "✈️", color: "#0EA5E9" },
  SAVINGS: { icon: "target", emoji: "🎯", color: "#64748B" },
  INVESTMENT: { icon: "briefcase", emoji: "💼", color: "#92278F" },
  PURCHASE: { icon: "target", emoji: "🎯", color: "#64748B" },
  DEBT: { icon: "target", emoji: "🎯", color: "#EF4444" },
  OTHER: { icon: "target", emoji: "🎯", color: "#64748B" },
};

export const goalsQueryKey = (userId?: string) =>
  ["identity", "profile", "goals", userId ?? null] as const;

function mapGoal(goal: ApiGoal, locale: string): GoalListItem {
  const parsedDeadline = goal.deadline
    ? new Date(`${goal.deadline.slice(0, 10)}T00:00:00`)
    : null;
  const deadline =
    parsedDeadline && !Number.isNaN(parsedDeadline.getTime())
      ? parsedDeadline.toLocaleDateString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : goal.deadline ?? "";

  return {
    id: goal.id,
    title: goal.name,
    target: goal.targetAmount,
    current: goal.currentAmount,
    ...GOAL_PRESENTATION[goal.type],
    deadline,
  };
}

export function useGoals(enabled = true) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.tokens?.userId);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const hasSession = !!userId && sessionReady;
  const { isRTL } = useLocalization();
  const queryKey = goalsQueryKey(userId);

  const query = useQuery({
    queryKey,
    enabled: enabled && hasSession,
    staleTime: 30_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const response = await httpClient.get<ApiGoal[]>(
        "/v1/profile/users/me/goals",
        { signal },
      );
      return response.data;
    },
    select: (apiGoals) =>
      apiGoals
        .filter((goal) => goal.status === "ACTIVE")
        .map((goal) => mapGoal(goal, isRTL ? "ar-EG" : "en-EG")),
  });

  const createGoal = useMutation({
    mutationFn: async ({ name, targetAmount, presetId }: CreateGoalInput) => {
      if (!userId || !sessionReady) {
        throw new Error("INVALID_SESSION");
      }

      const response = await httpClient.post<ApiGoal>(
        "/v1/profile/users/me/goals",
        {
          type: GOAL_TYPE_BY_PRESET[presetId],
          name,
          targetAmount,
          currentAmount: 0,
        },
      );
      return response.data;
    },
    onSuccess: async (createdGoal) => {
      queryClient.setQueryData<ApiGoal[]>(queryKey, (currentGoals) => [
        createdGoal,
        ...(currentGoals ?? []).filter((goal) => goal.id !== createdGoal.id),
      ]);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const isProfileMissing = (error: unknown) =>
    isAxiosError(error) && error.response?.status === 404;

  return {
    ...query,
    createGoal,
    hasSession,
    isFinancialProfileMissing: isProfileMissing(query.error),
    isCreateProfileMissing: isProfileMissing(createGoal.error),
  };
}
