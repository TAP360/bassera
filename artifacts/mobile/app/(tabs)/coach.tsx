import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useCreateGoalPlan, type GoalPlanInput } from "@workspace/api-client-react";

import { FORECAST_QUESTIONS } from "@/components/ForecastCoachWidget";
import { useProfile } from "@/hooks/useProfile";
import { useColors } from "@/hooks/useColors";
import { useLocalization } from "@/localization";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  time: string;
}

const SUGGESTED = [
  "Why do I overspend?",
  "Help me save for a car",
  "Analyze my spending",
  "How to reduce debt?",
  "What is my money personality?",
  "Build an emergency fund",
];

const GOAL_FIELDS = ["priority", "horizon", "cashFlow", "obligations", "outlook"] as const;
type GoalField = typeof GOAL_FIELDS[number];
type GoalAnswers = Record<GoalField, string>;

const AI_RESPONSES: Record<string, string> = {
  default:
    "I'm analyzing your financial patterns now. Based on your profile, I can see opportunities to strengthen your financial wellness. What specific area would you like to focus on today?",
  overspend:
    "Based on your transaction history, your impulse spending tends to spike on weekends. This is linked to emotional spending triggers — particularly stress relief. Try the 24-hour rule: wait a full day before non-essential purchases over 200 EGP. Your Money Profile suggests you benefit from structured cooling-off periods.",
  save: "Great goal! For a car savings plan, I recommend the 50/30/20 approach adapted for your income. Set up an automatic transfer of 2,000 EGP monthly to a dedicated goal account. At your current income, you could reach your car goal in 18-24 months. Want me to create a personalized savings plan?",
  debt: "Your debt-to-income ratio is currently healthy at 12%. To accelerate payoff, use the avalanche method — focus extra payments on the highest-interest debt first. This could save you significant interest over time. I've identified 3 areas where you can redirect 1,500 EGP monthly toward debt.",
  spending:
    "Your top 3 spending categories are: Food & Drink (28%), Shopping (22%), and Entertainment (15%). Compared to last month, shopping increased by 18% — this correlates with high-stress periods in your mood log. Reducing shopping by 30% would add 580 EGP to your savings monthly.",
};

function getAIResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("overspend") || lower.includes("spend too much"))
    return AI_RESPONSES.overspend;
  if (
    lower.includes("save") ||
    lower.includes("car") ||
    lower.includes("saving")
  )
    return AI_RESPONSES.save;
  if (lower.includes("debt") || lower.includes("loan"))
    return AI_RESPONSES.debt;
  if (lower.includes("analyz") || lower.includes("spending"))
    return AI_RESPONSES.spending;
  return AI_RESPONSES.default;
}

export default function CoachScreen() {
  const colors = useColors();
  const { forecastQuestion, forecastRequest } = useLocalSearchParams<{
    forecastQuestion?: string;
    forecastRequest?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { t, isRTL } = useLocalization();
  const textAlign = isRTL ? "right" : "left";
  const goalPlan = useCreateGoalPlan();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "ai",
      text: t("coach.greeting", { name: profile.name }),
      time: t("common.today"),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [goalStep, setGoalStep] = useState<number | null>(null);
  const [goalAnswers, setGoalAnswers] = useState<Partial<GoalAnswers>>({});
  const flatRef = useRef<FlatList>(null);
  const lastForecastRequest = useRef<string | null>(null);

  useEffect(() => {
    if (!forecastRequest || lastForecastRequest.current === forecastRequest) return;
    lastForecastRequest.current = forecastRequest;
    const selected = FORECAST_QUESTIONS.find((question) => question.id === forecastQuestion);
    const time = t("common.today");
    const newMessages: Message[] = [
      {
        id: `${forecastRequest}-answer`,
        role: "ai",
        text: selected ? t(selected.answerKey) : t("insights.forecastCoach.mainIntro"),
        time,
      },
    ];
    if (selected) {
      newMessages.push({
        id: `${forecastRequest}-question`,
        role: "user",
        text: t(selected.questionKey),
        time,
      });
    }
    setMessages((previous) => [...newMessages, ...previous]);
  }, [forecastQuestion, forecastRequest, t]);

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;
  const botPad = insets.bottom + (Platform.OS === "android" ? 96 : 60);

  const newMessage = (role: Message["role"], text: string): Message => ({
    id: `${Date.now()}-${Math.random()}`,
    role,
    text,
    time: t("common.today"),
  });

  const startGoalFlow = () => {
    if (isTyping) return;
    setGoalAnswers({});
    setGoalStep(0);
    setInput("");
    setMessages((prev) => [
      newMessage("ai", `${t("coach.goalIntro")}\n\n1/5 · ${t("coach.goalQuestion.priority")}`),
      newMessage("user", t("coach.goalPrompt")),
      ...prev,
    ]);
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    if (isTyping) return;
    if (goalStep === null && text.trim().toLowerCase() === t("coach.goalPrompt").toLowerCase()) {
      startGoalFlow();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg = newMessage("user", text.trim());

    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    if (goalStep !== null) {
      if (text.trim().length < 2) {
        setMessages((prev) => [newMessage("ai", t("coach.goalShortAnswer")), ...prev]);
        return;
      }
      const updated = { ...goalAnswers, [GOAL_FIELDS[goalStep]]: text.trim() };
      setGoalAnswers(updated);
      if (goalStep < GOAL_FIELDS.length - 1) {
        const next = goalStep + 1;
        setGoalStep(next);
        setMessages((prev) => [
          newMessage("ai", `${next + 1}/5 · ${t(`coach.goalQuestion.${GOAL_FIELDS[next]}`)}`),
          ...prev,
        ]);
        return;
      }
      setGoalStep(null);
      setIsTyping(true);
      const answers = updated as GoalAnswers;
      const data: GoalPlanInput = { ...answers, language: isRTL ? "ar" : "en" };
      goalPlan.mutateAsync({ data })
        .then(({ suggestion }) => setMessages((prev) => [newMessage("ai", suggestion), ...prev]))
        .catch(() => setMessages((prev) => [newMessage("ai", t("coach.goalError")), ...prev]))
        .finally(() => setIsTyping(false));
      return;
    }
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
         text: t(getAIResponse(text) === AI_RESPONSES.overspend ? "coach.overspend" : getAIResponse(text) === AI_RESPONSES.save ? "coach.save" : getAIResponse(text) === AI_RESPONSES.debt ? "coach.debt" : getAIResponse(text) === AI_RESPONSES.spending ? "coach.spending" : "coach.default"),
         time: t("common.today"),
      };
      setIsTyping(false);
      setMessages((prev) => [aiMsg, ...prev]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 1400);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, direction: isRTL ? "rtl" : "ltr" }]}>
      <LinearGradient
        colors={["#0B1026", "#1A1040", "#2E3192"]}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.coachAvatar}>
            <LinearGradient
              colors={["#2E3192", "#92278F"]}
              style={styles.coachAvatarGrad}
            >
              <Feather name="cpu" size={22} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.coachInfo}>
            <Text style={[styles.coachName, { textAlign }]}>Bassera AI Coach</Text>
            <Text style={[styles.coachStatus, { textAlign }]}>
              {t("coach.online")} · {t("Personalized for you")}
            </Text>
          </View>
          <Feather
            name="more-horizontal"
            size={22}
            color="rgba(255,255,255,0.6)"
          />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          ListHeaderComponent={
            isTyping ? (
              <View
                style={[
                  styles.bubble,
                  styles.aiBubble,
                  { backgroundColor: colors.card },
                ]}
              >
                <Text
                  style={[styles.typingDots, { color: colors.mutedForeground }]}
                >
                  ● ● ●
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) =>
            item.role === "user" ? (
              <View style={styles.userBubbleWrap}>
                <LinearGradient
                  colors={["#2E3192", "#92278F"]}
                  style={[styles.bubble, styles.userBubble]}
                >
                  <Text style={[styles.userText, { textAlign }]}>{item.text}</Text>
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.aiBubbleWrap}>
                <View
                  style={[
                    styles.bubble,
                    styles.aiBubble,
                    { backgroundColor: colors.card },
                  ]}
                >
                  <Text style={[styles.aiText, { color: colors.foreground, textAlign }]}>
                    {item.text}
                  </Text>
                </View>
              </View>
            )
          }
        />

        <View style={[styles.suggestedWrap, { borderTopColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              testID={goalStep !== null ? "coach-goal-cancel" : "coach-long-term-goal"}
              style={[
                styles.goalEntry,
                { backgroundColor: goalStep !== null ? colors.secondary : colors.primary },
              ]}
              onPress={() => {
                if (goalStep !== null) {
                  setGoalStep(null);
                  setGoalAnswers({});
                  setMessages((prev) => [newMessage("ai", t("coach.goalStopped")), ...prev]);
                } else {
                  startGoalFlow();
                }
              }}
              disabled={isTyping}
            >
              <Feather name={goalStep !== null ? "x" : "target"} size={18} color={goalStep !== null ? colors.foreground : colors.primaryForeground} />
              <Text style={[styles.goalEntryText, { color: goalStep !== null ? colors.foreground : colors.primaryForeground, textAlign }]}>
                {goalStep !== null ? t("coach.goalCancel") : t("coach.goalPrompt")}
              </Text>
            </Pressable>
          {goalStep === null ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestedScroll}
          >
            {SUGGESTED.map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.suggestedChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => sendMessage(s)}
              >
                <Text
                  style={[styles.suggestedText, { color: colors.foreground, textAlign }]}
                >
                  {t(({ "Why do I overspend?": "coach.whyOverspend", "Help me save for a car": "coach.saveCar", "Analyze my spending": "coach.analyzeSpending", "How to reduce debt?": "coach.reduceDebt", "What is my money personality?": "coach.personality", "Build an emergency fund": "coach.emergencyFund" } as Record<string, string>)[s] ?? s)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          ) : null}
        </View>

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: botPad + 8,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.secondary,
                textAlign,
                writingDirection: isRTL ? "rtl" : "ltr",
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder={t("coach.ask")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
          >
            <LinearGradient
              colors={["#2E3192", "#92278F"]}
              style={[
                styles.sendBtnGrad,
                (!input.trim() || isTyping) && { opacity: 0.4 },
              ]}
            >
              <Feather name="send" size={18} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  coachAvatar: { position: "relative" },
  coachAvatarGrad: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#0B1026",
  },
  coachInfo: { flex: 1 },
  coachName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  coachStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  bubble: { maxWidth: "82%", borderRadius: 18, padding: 14, marginBottom: 8 },
  userBubbleWrap: { alignItems: "flex-end" },
  userBubble: { borderBottomRightRadius: 4 },
  userText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    lineHeight: 20,
  },
  aiBubbleWrap: { alignItems: "flex-start" },
  aiBubble: {
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  aiText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  typingDots: { fontSize: 18, letterSpacing: 4 },
  suggestedWrap: { borderTopWidth: 1, paddingVertical: 8, gap: 8 },
  goalEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  goalEntryText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 12, lineHeight: 17 },
  suggestedScroll: { paddingHorizontal: 16, gap: 8 },
  suggestedChip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  suggestedText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: {},
  sendBtnGrad: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
