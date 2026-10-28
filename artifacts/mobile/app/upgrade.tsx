import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useProfile } from "@/hooks/useProfile";
import { useColors } from "@/hooks/useColors";
import { useLocalization } from "@/localization";

const PLANS = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    color: "#64748B",
    features: [
      "Basic expense tracking",
      "1 financial goal",
      "Weekly EFI snapshot",
      "Limited AI coach (5 msgs/day)",
    ],
    missing: [
      "Unlimited AI coaching",
      "Receipt scanning",
      "Advanced insights",
      "Behavioral analytics",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    priceMonthly: 150,
    priceYearly: 1440,
    color: "#F37021",
    badge: "Most Popular",
    features: [
      "Unlimited expense tracking",
      "Up to 10 financial goals",
      "Full EFI dashboard",
      "Unlimited AI coach",
      "Receipt scanning & OCR",
      "Weekly behavioral report",
    ],
    missing: [
      "1-on-1 human advisor",
      "Custom investment portfolio",
    ],
  },
  {
    id: "premium_plus",
    name: "Premium+",
    priceMonthly: 400,
    priceYearly: 3840,
    color: "#92278F",
    badge: "All-Inclusive",
    features: [
      "Everything in Premium",
      "1-on-1 certified advisor",
      "Custom investment portfolio",
      "Unlimited financial goals",
      "Priority support 24/7",
      "Family account (up to 5)",
      "Tax optimization hints",
    ],
    missing: [],
  },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { profile } = useProfile();
  const { t, isRTL } = useLocalization();
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState<string>("premium");

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;
  const botPad = Platform.OS === "web" ? 24 : insets.bottom;

  const selectedPlan = PLANS.find((p) => p.id === selected) ?? PLANS[1];
  const price = annual ? selectedPlan.priceYearly : selectedPlan.priceMonthly;
  const savings = annual && selectedPlan.priceMonthly > 0
    ? Math.round((1 - selectedPlan.priceYearly / (selectedPlan.priceMonthly * 12)) * 100)
    : 0;

  const handleSubscribe = () => {
    if (selected === "free") {
      router.back();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      t("upgrade.upgradeTo", { plan: t(selectedPlan.name) }),
      `You'll be charged ${price.toLocaleString()} EGP ${annual ? t("upgrade.perYear") : t("upgrade.perMonth")}. Payment integration coming soon.`,
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.ok"), onPress: () => router.back() },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0B1026", direction: isRTL ? "rtl" : "ltr" }}>
      <LinearGradient
        colors={["#0B1026", "#1A0A30", "#0B1026"]}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>

        <LinearGradient
          colors={["#2E3192", "#92278F"]}
          style={styles.crownCircle}
        >
          <Feather name="zap" size={28} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.headerTitle}>{t("upgrade.title")}</Text>
        <Text style={styles.headerSub}>
          {t("upgrade.subtitle")}
        </Text>

        <View style={[styles.toggle, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
          <Pressable
            style={[styles.toggleBtn, !annual && styles.toggleActive]}
            onPress={() => setAnnual(false)}
          >
            <Text style={[styles.toggleText, !annual && styles.toggleTextActive]}>{t("upgrade.monthly")}</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, annual && styles.toggleActive]}
            onPress={() => setAnnual(true)}
          >
            <Text style={[styles.toggleText, annual && styles.toggleTextActive]}>{t("upgrade.annual")}</Text>
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>{t("upgrade.save", { percent: 20 })}</Text>
            </View>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          const planPrice = annual ? plan.priceYearly : plan.priceMonthly;
          const isCurrent = profile.subscription === plan.id;

          return (
            <Pressable
              key={plan.id}
              style={[
                styles.planCard,
                { borderColor: isSelected ? plan.color : "rgba(255,255,255,0.08)" },
                isSelected && { backgroundColor: plan.color + "12" },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelected(plan.id);
              }}
            >
              <View style={styles.planHeader}>
                <View style={styles.planHeaderLeft}>
                  <View style={[styles.radio, isSelected && { borderColor: plan.color }]}>
                    {isSelected && <View style={[styles.radioDot, { backgroundColor: plan.color }]} />}
                  </View>
                  <View>
                    <View style={styles.planNameRow}>
                       <Text style={styles.planName}>{t(plan.name)}</Text>
                      {plan.badge && (
                        <View style={[styles.planBadge, { backgroundColor: plan.color + "25", borderColor: plan.color + "50" }]}>
                           <Text style={[styles.planBadgeText, { color: plan.color }]}>{t(plan.badge)}</Text>
                        </View>
                      )}
                      {isCurrent && (
                        <View style={[styles.planBadge, { backgroundColor: "#22C55E25", borderColor: "#22C55E50" }]}>
                           <Text style={[styles.planBadgeText, { color: "#22C55E" }]}>{t("upgrade.current")}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.planPriceRow}>
                      {planPrice === 0 ? (
                         <Text style={[styles.planPrice, { color: plan.color }]}>{t("profile.free")}</Text>
                      ) : (
                        <>
                          <Text style={[styles.planPrice, { color: plan.color }]}>
                            {planPrice.toLocaleString()}
                          </Text>
                          <Text style={styles.planCurrency}> EGP</Text>
                           <Text style={styles.planPeriod}>{annual ? t("upgrade.perYear") : t("upgrade.perMonth")}</Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.featureList}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <View style={[styles.featureCheck, { backgroundColor: plan.color + "20" }]}>
                      <Feather name="check" size={11} color={plan.color} />
                    </View>
                    <Text style={styles.featureText}>{t(f)}</Text>
                  </View>
                ))}
                {plan.missing.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <View style={[styles.featureCheck, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                      <Feather name="minus" size={11} color="rgba(255,255,255,0.25)" />
                    </View>
                    <Text style={[styles.featureText, { color: "rgba(255,255,255,0.25)" }]}>{t(f)}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 12, backgroundColor: "#0B1026" }]}>
        {savings > 0 && (
          <Text style={styles.footerSavings}>
            {t("upgrade.savings", { amount: ((selectedPlan.priceMonthly * 12) - selectedPlan.priceYearly).toLocaleString() })}
          </Text>
        )}
        <Pressable onPress={handleSubscribe} style={styles.ctaBtn}>
          <LinearGradient
            colors={["#2E3192", "#92278F", "#F37021"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGrad}
          >
            <Text style={styles.ctaText}>
              {selected === "free"
                 ? t("upgrade.stayFree")
                : t("upgrade.upgradeTo", { plan: t(selectedPlan.name) })}
            </Text>
            {price > 0 && (
              <Text style={styles.ctaSub}>
                {price.toLocaleString()} EGP{annual ? t("upgrade.perYear") : t("upgrade.perMonth")}
              </Text>
            )}
          </LinearGradient>
        </Pressable>
        <Text style={styles.terms}>
          {t("upgrade.terms")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24, alignItems: "center" },
  closeBtn: {
    position: "absolute", top: 0, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  crownCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14, marginTop: 8,
    shadowColor: "#92278F", shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginBottom: 8, textAlign: "center" },
  headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 20, marginBottom: 20, paddingHorizontal: 16 },
  toggle: { flexDirection: "row", borderRadius: 12, padding: 3, gap: 2 },
  toggleBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  toggleActive: { backgroundColor: "rgba(255,255,255,0.12)" },
  toggleText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.45)" },
  toggleTextActive: { color: "#FFFFFF" },
  savingsBadge: { backgroundColor: "#22C55E25", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  savingsText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#22C55E" },
  body: { padding: 16, gap: 12 },
  planCard: {
    borderRadius: 20, borderWidth: 1.5,
    padding: 18, backgroundColor: "rgba(255,255,255,0.04)",
  },
  planHeader: { marginBottom: 14 },
  planHeaderLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", marginTop: 3 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  planName: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  planBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  planBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  planPriceRow: { flexDirection: "row", alignItems: "baseline" },
  planPrice: { fontSize: 26, fontFamily: "Inter_700Bold" },
  planCurrency: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)" },
  planPeriod: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)" },
  featureList: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureCheck: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  footerSavings: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#22C55E", textAlign: "center" },
  ctaBtn: { borderRadius: 16, overflow: "hidden" },
  ctaGrad: { paddingVertical: 16, alignItems: "center", gap: 2 },
  ctaText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  ctaSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  terms: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.3)", textAlign: "center" },
});