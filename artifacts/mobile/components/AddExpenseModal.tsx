import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  Modal,
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

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  useCreateTransaction,
  type TransactionFeeling,
} from "@/hooks/useCreateTransaction";
import { useConsumerSession } from "@/hooks/useConsumerSession";
import { useLocalization } from "@/localization";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, EMOTION_TAGS, Category } from "@/constants/categories";
import { TransactionSaveFeedback } from "@/components/TransactionSaveFeedback";

interface Props {
  visible: boolean;
  onClose: () => void;
  initialType?: "expense" | "income";
}

const NUMPAD = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  [".", "0", "⌫"],
];

export function AddExpenseModal({ visible, onClose, initialType = "expense" }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addTransaction } = useApp();
  const { isAuthenticated } = useConsumerSession();
  const createTransaction = useCreateTransaction();
  const { t, isRTL } = useLocalization();
  const textAlign = isRTL ? "right" : "left";

  const [type, setType] = useState<"expense" | "income">(initialType);
  const [step, setStep] = useState<"amount" | "details" | "feedback">("amount");
  const [amount, setAmount] = useState("0");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState("");
  const [emotionTag, setEmotionTag] = useState<string>("");
  const [note, setNote] = useState("");
  const saveLock = useRef(false);

  const botPad = Platform.OS === "web" ? insets.bottom + 34 : insets.bottom;

  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const numericAmount = parseFloat(amount) || 0;
  const canProceed = numericAmount > 0 && selectedCategory !== null;

  const handleNumpad = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "⌫") {
      setAmount((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
      return;
    }
    if (key === "." && amount.includes(".")) return;
    const parts = amount.split(".");
    if (parts[1]?.length >= 2) return;
    if (amount === "0" && key !== ".") {
      setAmount(key);
    } else {
      setAmount((prev) => prev + key);
    }
  };

  const handleSave = () => {
    if (!canProceed || !selectedCategory || saveLock.current) return;
    saveLock.current = true;
    const feelingByTag: Record<string, TransactionFeeling> = {
      planned: "PLANNED",
      impulse: "IMPULSE",
      routine: "ROUTINE",
      stressed: "STRESSED",
      rewarded: "REWARD",
      regret: "REGRET",
    };
    const feeling = feelingByTag[emotionTag];

    const showFeedback = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("feedback");
    };

    if (isAuthenticated) {
      createTransaction.mutate(
        {
          amount: type === "expense" ? -numericAmount : numericAmount,
          currency: "EGP",
          merchantName: title.trim() || undefined,
          type: "POS",
          source: "MANUAL",
          category: selectedCategory.label,
          transactionDate: new Date().toISOString(),
          feeling,
          note: note.trim() || undefined,
        },
        {
          onSuccess: showFeedback,
          onError: () => {
            saveLock.current = false;
          },
        },
      );
      return;
    }

    addTransaction({
      title: title.trim() || selectedCategory.label,
      category: selectedCategory.label,
      amount: type === "expense" ? -numericAmount : numericAmount,
      date: "Just now",
      type,
      emotionTag: emotionTag || undefined,
      note: note.trim() || undefined,
    });
    showFeedback();
  };

  const handleClose = () => {
    if (createTransaction.isPending) return;
    saveLock.current = false;
    setStep("amount");
    setAmount("0");
    setSelectedCategory(null);
    setTitle("");
    setEmotionTag("");
    setNote("");
    setType(initialType);
    createTransaction.reset();
    onClose();
  };

  const displayAmount = amount.includes(".")
    ? amount
    : parseInt(amount).toLocaleString();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: botPad + 16,
              direction: isRTL ? "rtl" : "ltr",
            },
          ]}
          >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <View style={styles.typeToggle}>
              <Pressable
                style={[styles.typeBtn, type === "expense" && styles.typeBtnActive]}
                onPress={() => { setType("expense"); setSelectedCategory(null); }}
              >
                <Text style={[styles.typeBtnText, type === "expense" && styles.typeBtnTextActive]}>
                  {t("home.expense")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeBtn, type === "income" && styles.typeBtnActiveIncome]}
                onPress={() => { setType("income"); setSelectedCategory(null); }}
              >
                <Text style={[styles.typeBtnText, type === "income" && styles.typeBtnTextActive]}>
                  {t("data.income")}
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={handleClose} disabled={createTransaction.isPending}>
              <View style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </View>
            </Pressable>
          </View>

          {step === "feedback" && selectedCategory ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <TransactionSaveFeedback
                type={type}
                amount={numericAmount}
                categoryId={selectedCategory.id}
                categoryLabel={t(selectedCategory.label)}
                emotionTag={emotionTag || undefined}
                onDone={handleClose}
              />
            </ScrollView>
          ) : step === "amount" ? (
            <>
              <View style={styles.amountDisplay}>
                <Text style={[styles.currency, { color: colors.mutedForeground }]}>EGP</Text>
                <Text
                  style={[
                    styles.amountText,
                    {
                      color: type === "expense" ? "#F37021" : "#22C55E",
                      fontSize: displayAmount.length > 7 ? 36 : 52,
                    },
                  ]}
                >
                  {displayAmount}
                </Text>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign }]}>{t("Category")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {categories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor:
                          selectedCategory?.id === cat.id
                            ? cat.color + "25"
                            : colors.secondary,
                        borderColor:
                          selectedCategory?.id === cat.id
                            ? cat.color
                            : "transparent",
                        borderWidth: 1.5,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedCategory(cat);
                    }}
                  >
                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        {
                          color:
                            selectedCategory?.id === cat.id
                              ? cat.color
                              : colors.foreground,
                        },
                      ]}
                    >
                      {t(cat.label)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={[styles.numpad, { borderTopColor: colors.border }]}>
                {NUMPAD.map((row, ri) => (
                  <View key={ri} style={styles.numpadRow}>
                    {row.map((key) => (
                      <Pressable
                        key={key}
                        style={({ pressed }) => [
                          styles.numKey,
                          {
                            backgroundColor: pressed
                              ? colors.secondary
                              : key === "⌫"
                              ? colors.secondary
                              : "transparent",
                          },
                        ]}
                        onPress={() => handleNumpad(key)}
                      >
                        <Text
                          style={[
                            styles.numKeyText,
                            { color: key === "⌫" ? colors.mutedForeground : colors.foreground },
                          ]}
                        >
                          {key}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>

              <Pressable
                style={[styles.nextBtn, !canProceed && { opacity: 0.4 }]}
                onPress={() => {
                  if (!canProceed) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setStep("details");
                }}
                disabled={!canProceed}
              >
                <LinearGradient
                  colors={type === "expense" ? ["#2E3192", "#92278F", "#F37021"] : ["#22C55E", "#16A34A"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextBtnGrad}
                >
                  <Text style={styles.nextBtnText}>{t("common.next")} →</Text>
                </LinearGradient>
              </Pressable>
            </>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailsScroll}>
              <View style={[styles.amountSummary, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.amountSummaryLabel, { color: colors.mutedForeground }]}>{t("Amount")}</Text>
                <Text style={[styles.amountSummaryVal, { color: type === "expense" ? "#F37021" : "#22C55E" }]}>
                  {type === "expense" ? "−" : "+"}{numericAmount.toLocaleString()} EGP
                </Text>
                {selectedCategory && (
                  <View style={[styles.catTag, { backgroundColor: selectedCategory.color + "20" }]}>
                    <Text style={styles.catTagEmoji}>{selectedCategory.emoji}</Text>
                    <Text style={[styles.catTagText, { color: selectedCategory.color }]}>
                      {t(selectedCategory.label)}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign }]}>{t("Title (optional)")}</Text>
              <TextInput
                style={[styles.textField, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, textAlign, writingDirection: isRTL ? "rtl" : "ltr" }]}
                value={title}
                onChangeText={setTitle}
                placeholder={`${t("e.g.")} ${t(selectedCategory?.label ?? "Transaction")}`}
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
              />

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign }]}>{t("How did this feel?")}</Text>
              <View style={styles.emotionGrid}>
                {EMOTION_TAGS.map((e) => (
                  <Pressable
                    key={e.id}
                    style={[
                      styles.emotionChip,
                      {
                        backgroundColor:
                          emotionTag === e.id ? e.color + "25" : colors.secondary,
                        borderColor: emotionTag === e.id ? e.color : "transparent",
                        borderWidth: 1.5,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEmotionTag(emotionTag === e.id ? "" : e.id);
                    }}
                  >
                    <Text style={styles.emotionEmoji}>{e.emoji}</Text>
                    <Text style={[styles.emotionLabel, { color: emotionTag === e.id ? e.color : colors.foreground }]}>
                      {t(e.label)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {createTransaction.isError && (
                <Text
                  accessibilityRole="alert"
                  style={[styles.saveError, { color: colors.destructive }]}
                >
                  {t("transaction.saveError")}
                </Text>
              )}

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign }]}>{t("Note (optional)")}</Text>
              <TextInput
                style={[styles.textField, styles.noteField, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, textAlign, writingDirection: isRTL ? "rtl" : "ltr" }]}
                value={note}
                onChangeText={setNote}
                placeholder={t("Add a note...")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />

              <View style={styles.detailActions}>
                <Pressable
                  style={[styles.backBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setStep("amount");
                  }}
                >
                  <Text style={[styles.backBtnText, { color: colors.mutedForeground }]}>{t("common.back")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, createTransaction.isPending && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={createTransaction.isPending}
                >
                  <LinearGradient
                    colors={type === "expense" ? ["#2E3192", "#92278F", "#F37021"] : ["#22C55E", "#16A34A"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveBtnGrad}
                  >
                    <Feather name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>
                      {createTransaction.isPending ? t("common.saving") : t("common.save")}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 20, maxHeight: "94%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  typeToggle: { flexDirection: "row", borderRadius: 12, overflow: "hidden", backgroundColor: "#F1F5F9" },
  typeBtn: { paddingVertical: 8, paddingHorizontal: 20 },
  typeBtnActive: { backgroundColor: "#F37021" },
  typeBtnActiveIncome: { backgroundColor: "#22C55E" },
  typeBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#64748B" },
  typeBtnTextActive: { color: "#FFFFFF" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  amountDisplay: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", marginBottom: 16, gap: 8 },
  currency: { fontSize: 18, fontFamily: "Inter_400Regular", marginBottom: 10 },
  amountText: { fontFamily: "Inter_700Bold", lineHeight: 60 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  categoryScroll: { gap: 8, paddingBottom: 14 },
  categoryChip: { alignItems: "center", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 4, minWidth: 70 },
  categoryEmoji: { fontSize: 22 },
  categoryLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  numpad: { borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  numpadRow: { flexDirection: "row", justifyContent: "space-between" },
  numKey: { flex: 1, margin: 4, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  numKeyText: { fontSize: 22, fontFamily: "Inter_500Medium" },
  nextBtn: { borderRadius: 16, overflow: "hidden", marginTop: 8 },
  nextBtnGrad: { paddingVertical: 15, alignItems: "center" },
  nextBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  detailsScroll: { paddingTop: 4 },
  amountSummary: { borderRadius: 18, padding: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  amountSummaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  amountSummaryVal: { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1 },
  catTag: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  catTagEmoji: { fontSize: 14 },
  catTagText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  textField: { borderRadius: 14, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1, marginBottom: 16 },
  noteField: { minHeight: 80, textAlignVertical: "top" },
  emotionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  emotionChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
  emotionEmoji: { fontSize: 14 },
  emotionLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailActions: { flexDirection: "row", gap: 12, paddingTop: 4, paddingBottom: 8 },
  backBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1 },
  backBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  saveBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  saveBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, gap: 6 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  saveError: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12, textAlign: "center" },
});
