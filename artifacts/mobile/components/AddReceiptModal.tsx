import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useAppStore } from "@/stores/appStore";
import { useColors } from "@/hooks/useColors";
import { useLocalization } from "@/localization";
import { EXPENSE_CATEGORIES, EMOTION_TAGS } from "@/constants/categories";
import { TransactionSaveFeedback } from "@/components/TransactionSaveFeedback";
import { useExtractReceipt } from "@/hooks/useExtractReceipt";

interface ReceiptItem {
  name: string;
  amount: number;
  currency: string;
  category: string;
  categoryId: string;
  emoji: string;
}

const RECEIPT_CATEGORY_ALIASES: Record<string, string> = {
  grocery: "food",
  groceries: "food",
  food: "food",
  transportation: "transport",
  transport: "transport",
  healthcare: "health",
  medical: "health",
  entertainment: "entertainment",
  utilities: "bills",
};

function getReceiptCategory(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s&-]+/g, "_");
  const categoryId =
    RECEIPT_CATEGORY_ALIASES[normalized] ??
    normalized;
  const matchedCategory = EXPENSE_CATEGORIES.find(
    (category) =>
      category.id === categoryId ||
      category.label.toLowerCase().replace(/[\s&-]+/g, "_") === normalized,
  );
  const fallbackCategory = EXPENSE_CATEGORIES.find(
    (category) => category.id === "other",
  );
  if (matchedCategory) return matchedCategory;
  if (fallbackCategory) return fallbackCategory;
  throw new Error("RECEIPT_CATEGORY_FALLBACK_MISSING");
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

type ReceiptStep = "scan" | "processing" | "review" | "emotion" | "feedback";

export function AddReceiptModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const addTransaction = useAppStore((state) => state.addTransaction);
  const { t, isRTL } = useLocalization();
  const receiptMutation = useExtractReceipt();

  const [step, setStep] = useState<ReceiptStep>("scan");
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [emotionTag, setEmotionTag] = useState("");
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [pickerError, setPickerError] = useState(false);
  const saveLock = useRef(false);

  const scanAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  const botPad = Platform.OS === "web" ? insets.bottom + 34 : insets.bottom;

  useEffect(() => {
    if (step === "scan") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }
    if (step === "processing") {
      Animated.loop(
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true })
      ).start();
    }
  }, [step]);

  const scanReceipt = async (source: "camera" | "gallery") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    receiptMutation.reset();
    setPickerError(false);
    let uploadStarted = false;
    try {
      if (Platform.OS !== "web") {
        const permission =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            t("receipt.permissionTitle"),
            t(source === "camera" ? "receipt.cameraPermission" : "receipt.galleryPermission"),
            [
              ...(permission.canAskAgain
                ? []
                : [
                    {
                      text: t("receipt.openSettings"),
                      onPress: () => {
                        void Linking.openSettings().catch(() => {
                          Alert.alert(t("receipt.permissionTitle"), t("receipt.pickerError"));
                        });
                      },
                    },
                  ]),
              { text: t("common.ok"), style: "cancel" },
            ],
          );
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Automatic,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setReceiptImageUri(asset.uri);
      setItems([]);
      setTranscript("");
      setStep("processing");
      uploadStarted = true;
      const extraction = await receiptMutation.mutateAsync(asset);
      setTranscript(extraction.transcript || "");
      setItems(
        extraction.expenses
          .filter(
            (expense) =>
              Number.isFinite(expense.amount) &&
              typeof expense.currency === "string" &&
              typeof expense.category === "string",
          )
          .map((expense, index) => {
            const category = getReceiptCategory(expense.category);
            return {
              name: t("receipt.itemNumber", { count: index + 1 }),
              amount: expense.amount,
              currency: expense.currency,
              category: category.label,
              categoryId: category.id,
              emoji: category.emoji,
            };
          }),
      );
      setStep("review");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setStep("scan");
      if (!uploadStarted) setPickerError(true);
    }
  };

  const handleSave = () => {
    if (!items.length || saveLock.current) return;
    saveLock.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    items.forEach((item) => {
      addTransaction({
        title: item.name,
        category: item.category,
        amount: -item.amount,
        date: "Just now",
        type: "expense",
        emotionTag: emotionTag || undefined,
      });
    });
    setStep("feedback");
  };

  const handleClose = () => {
    saveLock.current = false;
    setStep("scan");
    setItems([]);
    setEmotionTag("");
    setEditingItem(null);
    setReceiptImageUri(null);
    setTranscript("");
    setPickerError(false);
    receiptMutation.reset();
    onClose();
  };

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const receiptCategoryId =
    items.length > 0 && items.every((item) => item.categoryId === items[0].categoryId)
      ? items[0].categoryId
      : "mixed";
  const receiptCategoryLabel =
    receiptCategoryId === "mixed"
      ? t("transaction.mixedCategories")
      : t(items[0]?.category ?? "Other");

  const scanLineY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240],
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={step === "scan" ? handleClose : undefined} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: step === "scan" ? "#0B1026" : colors.card,
              paddingBottom: botPad + 16,
              direction: isRTL ? "rtl" : "ltr",
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: step === "scan" ? "rgba(255,255,255,0.2)" : colors.border }]} />

          {step === "scan" && (
            <View style={styles.scanContainer}>
              <View style={styles.scanHeader}>
                <Text style={styles.scanTitle}>{t("receipt.title")}</Text>
                <Pressable onPress={handleClose}>
                  <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
                </Pressable>
              </View>

              <Text style={styles.scanSubtitle}>{t("receipt.subtitle")}</Text>

              <View style={styles.viewfinder}>
                <View style={styles.corner} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                <Animated.View
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanLineY }] },
                  ]}
                />

                {receiptImageUri ? (
                  <Image source={{ uri: receiptImageUri }} style={styles.receiptImage} resizeMode="contain" />
                ) : (
                  <View style={styles.docPlaceholder}>
                    <Feather name="file-text" size={48} color="rgba(255,255,255,0.15)" />
                    <Text style={styles.docPlaceholderText}>{t("receipt.preview")}</Text>
                  </View>
                )}
              </View>

              {(pickerError || receiptMutation.isError) && (
                <Text style={styles.scanError}>
                  {t(pickerError
                    ? "receipt.pickerError"
                    :
                    receiptMutation.error instanceof Error &&
                      receiptMutation.error.message === "UNSUPPORTED_RECEIPT_FILE"
                      ? "receipt.unsupportedFile"
                      : receiptMutation.error instanceof Error &&
                          receiptMutation.error.message === "INVALID_SESSION"
                        ? "receipt.signInRequired"
                        : "receipt.uploadError",
                  )}
                </Text>
              )}

              <Pressable onPress={() => void scanReceipt("camera")}>
                <LinearGradient
                  colors={["#2E3192", "#92278F", "#F37021"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.shutterBtn}
                >
                  <View style={{alignItems:"center", justifyContent:"center", flexDirection: "row", gap: 10, alignSelf:'center'}}>
                     <Feather name="camera" size={26} color="#FFFFFF" />
                     <Text style={styles.shutterText}>{t("receipt.cameraButton")}</Text>
                  </View>
                </LinearGradient>
              </Pressable>

              <Pressable style={styles.manualBtn} onPress={() => void scanReceipt("gallery")}>
                <Text style={styles.manualBtnText}>{t("receipt.galleryButton")}</Text>
              </Pressable>
            </View>
          )}

          {step === "processing" && (
            <View style={styles.processingContainer}>
              <LinearGradient
                colors={["#2E3192", "#92278F", "#F37021"]}
                style={styles.processingIcon}
              >
                <Feather name="cpu" size={32} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.processingTitle}>{t("receipt.processingTitle")}</Text>
              <Text style={styles.processingSubtitle}>{t("receipt.processingSubtitle")}</Text>

              <View style={styles.processingSteps}>
                {[
                  { label: "receipt.stepReading", done: true },
                  { label: "receipt.stepDetecting", done: true },
                  { label: "receipt.stepCategorizing", done: false },
                  { label: "receipt.stepTotals", done: false },
                ].map((s, i) => (
                  <View key={i} style={styles.processingStep}>
                    <View
                      style={[
                        styles.stepDot,
                        { backgroundColor: s.done ? "#22C55E" : "#E2E8F0" },
                      ]}
                    >
                      {s.done && <Feather name="check" size={10} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.stepText, { color: s.done ? "#22C55E" : "#94A3B8" }]}>
                      {t(s.label)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {step === "feedback" && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <TransactionSaveFeedback
                type="expense"
                amount={totalAmount}
                categoryId={receiptCategoryId}
                categoryLabel={receiptCategoryLabel}
                emotionTag={emotionTag || undefined}
                onDone={handleClose}
              />
            </ScrollView>
          )}

          {(step === "review" || step === "emotion") && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={styles.reviewHeader}>
                <View>
                  <Text style={[styles.reviewTitle, { color: colors.foreground }]}>{t("receipt.reviewTitle")}</Text>
                </View>
                <View style={[styles.aiTag, { backgroundColor: "#2E319215" }]}>
                  <Feather name="cpu" size={12} color="#2E3192" />
                  <Text style={styles.aiTagText}>{t("receipt.aiCategorized")}</Text>
                </View>
              </View>

              {transcript ? (
                <View style={[styles.transcriptCard, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.transcriptTitle, { color: colors.mutedForeground }]}>
                    {t("receipt.transcript")}
                  </Text>
                  <Text style={[styles.transcriptText, { color: colors.foreground }]}>{transcript}</Text>
                </View>
              ) : null}

              {items.length === 0 ? (
                <Text style={[styles.noExpenses, { color: colors.mutedForeground }]}>
                  {t("receipt.noExpenses")}
                </Text>
              ) : (
                <View style={[styles.itemsCard, { backgroundColor: colors.secondary }]}>
                  {items.map((item, idx) => {
                    const cat = EXPENSE_CATEGORIES.find((c) => c.id === item.categoryId);
                    return (
                      <View key={idx}>
                        <Pressable
                          style={styles.itemRow}
                          onPress={() => setEditingItem(editingItem === idx ? null : idx)}
                        >
                          <Text style={styles.itemEmoji}>{item.emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemName, { color: colors.foreground }]}>{t(item.name)}</Text>
                            <View style={styles.itemCatRow}>
                              <View style={[styles.itemCatBadge, { backgroundColor: (cat?.color ?? "#64748B") + "20" }]}>
                                <Text style={[styles.itemCatText, { color: cat?.color ?? "#64748B" }]}>
                                  {t(item.category)}
                                </Text>
                              </View>
                              <Feather
                                name={editingItem === idx ? "chevron-up" : "chevron-down"}
                                size={14}
                                color={colors.mutedForeground}
                              />
                            </View>
                          </View>
                          <Text style={[styles.itemAmount, { color: "#F37021" }]}>
                            {item.amount.toLocaleString()} {item.currency}
                          </Text>
                        </Pressable>

                        {editingItem === idx && (
                          <View style={styles.itemCategoryPicker}>
                            <Text style={[styles.pickLabel, { color: colors.mutedForeground }]}>{t("receipt.changeCategory")}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                              {EXPENSE_CATEGORIES.map((c) => (
                                <Pressable
                                  key={c.id}
                                  style={[
                                    styles.pickChip,
                                    {
                                      backgroundColor:
                                        item.categoryId === c.id ? c.color + "25" : colors.card,
                                      borderColor: item.categoryId === c.id ? c.color : colors.border,
                                      borderWidth: 1,
                                    },
                                  ]}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setItems((prev) =>
                                      prev.map((it, i) =>
                                        i === idx
                                          ? { ...it, category: c.label, categoryId: c.id, emoji: c.emoji }
                                          : it
                                      )
                                    );
                                    setEditingItem(null);
                                  }}
                                >
                                  <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                                  <Text style={[styles.pickChipText, { color: colors.foreground }]}>{t(c.label)}</Text>
                                </Pressable>
                              ))}
                            </ScrollView>
                          </View>
                        )}

                        {idx < items.length - 1 && (
                          <View style={[styles.itemDivider, { backgroundColor: colors.border }]} />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {items.length > 0 && (
                <View style={[styles.totalRow, { backgroundColor: colors.card }]}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>{t("receipt.total")}</Text>
                  <Text style={[styles.totalAmount, { color: "#F37021" }]}>
                    {totalAmount.toLocaleString()} {items[0].currency}
                  </Text>
                </View>
              )}

              {items.length > 0 && (
              <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("receipt.emotionPrompt")}</Text>
              <View style={styles.emotionGrid}>
                {EMOTION_TAGS.map((e) => (
                  <Pressable
                    key={e.id}
                    style={[
                      styles.emotionChip,
                      {
                        backgroundColor: emotionTag === e.id ? e.color + "25" : colors.secondary,
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
              </>
              )}

              <View style={styles.reviewActions}>
                <Pressable
                  style={[styles.retryBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setStep("scan");
                    setItems([]);
                    setReceiptImageUri(null);
                    setTranscript("");
                    setPickerError(false);
                    receiptMutation.reset();
                  }}
                >
                  <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.retryText, { color: colors.mutedForeground }]}>{t("common.retry")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, items.length === 0 && styles.disabledButton]}
                  onPress={handleSave}
                  disabled={items.length === 0}
                >
                  <LinearGradient
                    colors={["#2E3192", "#92278F", "#F37021"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.confirmBtnGrad}
                  >
                    <Feather name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>{t("receipt.saveItems", { count: items.length })}</Text>
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
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 20, maxHeight: "94%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },

  scanContainer: { alignItems: "center", paddingBottom: 8 },
  scanHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 8 },
  scanTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  scanSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", marginBottom: 20, textAlign: "center" },
  viewfinder: {
    width: "100%",
    height: 260,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 24,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  corner: { position: "absolute", top: 16, left: 16, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: "#F37021", borderRadius: 4 },
  cornerTR: { left: undefined, right: 16, borderLeftWidth: 0, borderRightWidth: 3 },
  cornerBL: { top: undefined, bottom: 16, borderTopWidth: 0, borderBottomWidth: 3 },
  cornerBR: { top: undefined, bottom: 16, left: undefined, right: 16, borderTopWidth: 0, borderLeftWidth: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanLine: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "#F37021", shadowColor: "#F37021", shadowOpacity: 1, shadowRadius: 6 },
  docPlaceholder: { alignItems: "center", gap: 8 },
  docPlaceholderText: { fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "Inter_400Regular" },
  receiptImage: { width: "100%", height: "100%" },
  scanError: { color: "#FCA5A5", fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center", marginBottom: 10 },
  shutterBtn: {  alignItems: "center", width: "100%", borderRadius: 18, paddingVertical: 16, paddingHorizontal: 24, justifyContent: "center", marginBottom: 12 , },
  shutterText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  manualBtn: { paddingVertical: 8 },
  manualBtnText: { fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular" },

  processingContainer: { alignItems: "center", paddingVertical: 32, gap: 12 },
  processingIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  processingTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  processingSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" },
  processingSteps: { width: "100%", gap: 12, marginTop: 16 },
  processingStep: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  reviewTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  transcriptCard: { borderRadius: 14, padding: 12, marginBottom: 12 },
  transcriptTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  transcriptText: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  noExpenses: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 20 },
  aiTag: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  aiTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#2E3192" },
  itemsCard: { borderRadius: 18, padding: 4, marginBottom: 12 },
  itemRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  itemEmoji: { fontSize: 24 },
  itemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  itemCatRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  itemCatBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  itemCatText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  itemAmount: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemDivider: { height: 1, marginHorizontal: 12 },
  itemCategoryPicker: { paddingHorizontal: 12, paddingBottom: 12 },
  pickLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 8 },
  pickChip: { alignItems: "center", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, gap: 4 },
  pickChipText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 16, padding: 14, marginBottom: 16 },
  totalLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  totalAmount: { fontSize: 20, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  emotionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  emotionChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
  emotionEmoji: { fontSize: 14 },
  emotionLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  reviewActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  retryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, paddingVertical: 14, gap: 6 },
  retryText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  confirmBtn: { flex: 2, borderRadius: 14, overflow: "hidden" },
  disabledButton: { opacity: 0.5 },
  confirmBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, gap: 6 },
  confirmBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
});
