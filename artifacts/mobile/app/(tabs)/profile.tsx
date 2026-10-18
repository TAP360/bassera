import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useLocalization } from "@/localization";
import { showProfilePhotoOptions } from "@/utils/profilePhoto";
import { useConsumerSession, useSessionLogout } from "@/hooks/useConsumerSession";
import { authErrorMessage } from "@/utils/authErrors";
import { localize } from "@/utils/questionnaireScoring";

const personalityColors: Record<string, string> = {
  "Money Vigilance": "#2E3192",
  "Money Worship": "#F37021",
  "Money Status": "#92278F",
  "Money Avoidance": "#22C55E",
  "Money Obligation": "#F59E0B",
};

const SUBSCRIPTION_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "#64748B" },
  premium: { label: "Premium", color: "#F37021" },
  premium_plus: { label: "Premium+", color: "#92278F" },
};

const PLAN_FEATURES = {
  free: [
    "Money Personality Assessment",
    "Manual Transaction Tracking",
    "Limited AI Coach (5/day)",
    "Basic Insights",
  ],
  premium: [
    "Unlimited AI Coaching",
    "Bank Integration",
    "Real-time EFI Tracking",
    "Personalized Saving Plans",
    "Investment Suggestions",
  ],
  premium_plus: [
    "Advanced Investments",
    "Family Sharing",
    "Loan Management",
    "Tax Assistance",
    "Human Advisor Sessions",
  ],
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, clearData, updateProfile } = useApp();
  const { language, setLanguage, t, isRTL } = useLocalization();
  const textAlign = isRTL ? "right" : "left";
  const { data: consumer } = useConsumerSession();
  const logout = useSessionLogout();
  const displayName = consumer?.name?.trim() || (language === "ar" ? "عضو بصيرة" : "Bassera member");
  const [notifications, setNotifications] = useState(true);
  const [nudges, setNudges] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const router = useRouter();
  const topPad = Platform.OS === "android" ? insets.top + 20 : insets.top;
  // The fixed tab bar overlays the scroll view on web and native platforms.
  // Keep the final actions above it at the bottom of the scroll range.
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 104 : 96);
  const attitude = profile.moneyAttitude?.dimensions.find(
    (d) => d.key === profile.moneyAttitude?.dominantKey,
  );
  const personalityLabel = attitude
    ? localize(attitude.profileName ?? attitude.label, language)
    : profile.personalityType
      ? t(profile.personalityType)
      : "";
  const pColor =
    personalityColors[profile.personalityType ?? "Money Vigilance"] ??
    "#2E3192";
  const subInfo = {
    ...(SUBSCRIPTION_LABELS[profile.subscription] ?? SUBSCRIPTION_LABELS.free),
    label:
      profile.subscription === "premium_plus"
        ? t("profile.premiumPlus")
        : profile.subscription === "premium"
          ? t("profile.premium")
          : t("profile.free"),
  };
  const choosePhoto = () =>
    showProfilePhotoOptions(t, (photoUri) => updateProfile({ photoUri }));
  const performSignOut = async () => {
    try {
      await logout();
      await clearData();
      router.replace("/login");
    } catch (error) {
      const message = authErrorMessage(error, language);
      if (Platform.OS === "web") window.alert(message);
      else Alert.alert(t("profile.signOut"), message);
    }
  };

  const settingsSections = [
    {
      title: t("profile.account"),
      items: [
        {
          icon: "user",
          label: t("profile.personalInfo"),
          arrow: true,
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/personal-info");
          },
        },
        {
          icon: "link",
          label: t("profile.linkedAccounts"),
          arrow: true,
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/linked-accounts");
          },
        },
        {
          icon: "credit-card",
          label: t("profile.paymentMethods"),
          arrow: true,
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/payment-methods");
          },
        },
      ],
    },
    {
      title: t("profile.preferences"),
      items: [
        {
          icon: "bell",
          label: t("profile.notifications"),
          toggle: true,
          value: notifications,
          onToggle: setNotifications,
        },
        {
          icon: "zap",
          label: t("profile.smartNudges"),
          toggle: true,
          value: nudges,
          onToggle: setNudges,
        },
        {
          icon: "moon",
          label: t("profile.darkMode"),
          toggle: true,
          value: darkMode,
          onToggle: setDarkMode,
        },
        {
          icon: "globe",
          label: t("profile.language"),
          value: language === "ar" ? t("language.arabic") : t("language.english"),
          arrow: true,
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(t("profile.languageTitle"), undefined, [
              {
                text: t("language.english"),
                onPress: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  void setLanguage("en");
                },
              },
              {
                text: t("language.arabic"),
                onPress: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  void setLanguage("ar");
                },
              },
              { text: t("common.cancel"), style: "cancel" },
            ]);
          },
        },
      ],
    },
    {
      title: t("profile.security"),
      items: [
        {
          icon: "lock",
          label: t("profile.changePasscode"),
          arrow: true,
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              t("profile.changePasscode"),
              t("profile.passcodeMessage"),
              [{ text: t("common.ok") }],
            );
          },
        },
        {
          icon: "shield",
          label: t("profile.biometric"),
          toggle: true,
          value: true,
          onToggle: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
        {
          icon: "eye-off",
          label: t("profile.privacy"),
          arrow: true,
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              t("profile.privacy"),
              t("profile.privacyMessage"),
              [{ text: t("common.ok") }],
            );
          },
        },
      ],
    },
    {
      title: t("profile.support"),
      items: [
        {
          icon: "help-circle",
          label: t("profile.help"),
          arrow: true,
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              t("profile.help"),
              t("profile.helpMessage"),
              [{ text: t("common.ok") }],
            );
          },
        },
        {
          icon: "message-square",
          label: t("profile.contact"),
          arrow: true,
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              t("profile.contact"),
              t("profile.contactMessage"),
              [{ text: t("common.ok") }],
            );
          },
        },
        {
          icon: "star",
          label: t("profile.rate"),
          arrow: true,
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              `${t("profile.rate")} ⭐`,
              t("profile.rateMessage"),
              [
                { text: t("profile.notNow"), style: "cancel" },
                { text: t("profile.rateNow"), onPress: () => {} },
              ],
            );
          },
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        direction: isRTL ? "rtl" : "ltr",
      }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPad }}
    >
      <LinearGradient
        colors={["#0B1026", "#1A1040", "#2E3192"]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={[pColor, pColor + "AA"]}
            style={styles.avatarCircle}
          >
            {profile.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={styles.avatarPhoto} />
            ) : (
              <Text style={styles.avatarLetter}>
                {displayName[0]?.toUpperCase() ?? "?"}
              </Text>
            )}
          </LinearGradient>
          <Pressable
            style={styles.editAvatarBtn}
            accessibilityRole="button"
            accessibilityLabel={t("personal.changePhoto")}
            onPress={choosePhoto}
          >
            <Feather name="camera" size={14} color="#FFFFFF" />
          </Pressable>
        </View>
        <Pressable
          style={styles.nameEdit}
          accessibilityRole="button"
          accessibilityLabel={t("personal.editName")}
          onPress={() => router.push("/personal-info")}
        >
          <Text style={[styles.profileName, { textAlign: "center" }]}>{displayName}</Text>
          <Feather name="edit-2" size={15} color="rgba(255,255,255,0.75)" />
        </Pressable>
        {consumer?.email ? <Text style={[styles.profileEmail, { textAlign: "center" }]}>{consumer.email}</Text> : null}
        <View style={styles.headerBadges}>
          <View
            style={[
              styles.subBadge,
              {
                backgroundColor: subInfo.color + "30",
                borderColor: subInfo.color + "60",
              },
            ]}
          >
            <Feather name="star" size={12} color={subInfo.color} />
            <Text style={[styles.subBadgeText, { color: subInfo.color }]}>
              {subInfo.label}
            </Text>
          </View>
        <Text style={[styles.joinText, { textAlign: "center" }]}>{t("profile.memberSince", { date: t(({ "Jan 2025": "data.jan2025" } as Record<string, string>)[profile.joinDate] ?? profile.joinDate) })}</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {!!personalityLabel && (
          <View
            style={[styles.personalityCard, { backgroundColor: colors.card }]}
          >
            <View
              style={[
                styles.personalityIcon,
                { backgroundColor: pColor + "20" },
              ]}
            >
              <Feather name="user-check" size={22} color={pColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.personalityLabel,
                  { color: colors.mutedForeground, textAlign },
                ]}
              >
                {t("profile.moneyPersonality")}
              </Text>
              <Text style={[styles.personalityName, { color: pColor, textAlign }]}>
                {personalityLabel}
              </Text>
            </View>
            <Pressable
              style={[styles.viewBtn, { borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert(
                  t("profile.retakeTitle"),
                  t("profile.retakeMessage"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("profile.retake"),
                      onPress: () => router.push("/onboarding"),
                    },
                  ],
                );
              }}
            >
              <Text
                style={[styles.viewBtnText, { color: colors.mutedForeground }]}
              >
                {t("profile.retake")}
              </Text>
            </Pressable>
          </View>
        )}

        <View
          style={[styles.subscriptionCard, { backgroundColor: colors.card }]}
        >
          <View style={styles.subHeader}>
            <View>
              <Text style={[styles.subTitle, { color: colors.foreground, textAlign }]}>
                {t("profile.yourPlan")}
              </Text>
              <Text style={[styles.subCurrent, { color: subInfo.color, textAlign }]}>
                {subInfo.label}
              </Text>
            </View>
            {profile.subscription === "free" && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/upgrade");
                }}
              >
                <LinearGradient
                  colors={["#2E3192", "#92278F", "#F37021"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.upgradeBtn}
                >
                  <Text style={styles.upgradeBtnText}>{t("profile.upgrade")}</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>

          <View style={styles.featuresGrid}>
            {(PLAN_FEATURES[profile.subscription] ?? PLAN_FEATURES.free).map(
              (f) => (
                <View key={f} style={styles.featureRow}>
                  <Feather
                    name="check-circle"
                    size={14}
                    color={subInfo.color}
                  />
                  <Text
                    style={[styles.featureText, { color: colors.foreground, textAlign }]}
                  >
                    {t(f)}
                  </Text>
                </View>
              ),
            )}
          </View>

          {profile.subscription === "free" && (
            <View style={styles.premiumPriceRow}>
              <View style={styles.priceCard}>
                <Text
                  style={[styles.priceLabel, { color: colors.mutedForeground, textAlign }]}
                >
                   {t("profile.premium")}
                </Text>
                <Text style={[styles.priceValue, { color: "#F37021", textAlign: "center" }]}>
                  150 EGP
                </Text>
                <Text
                  style={[
                    styles.pricePeriod,
                    { color: colors.mutedForeground, textAlign: "center" },
                  ]}
                >
                  {t("profile.perMonth")}
                </Text>
              </View>
              <View style={styles.priceCard}>
                <Text
                  style={[styles.priceLabel, { color: colors.mutedForeground, textAlign }]}
                >
                   {t("profile.premiumPlus")}
                </Text>
                <Text style={[styles.priceValue, { color: "#92278F", textAlign: "center" }]}>
                  400 EGP
                </Text>
                <Text
                  style={[
                    styles.pricePeriod,
                    { color: colors.mutedForeground, textAlign: "center" },
                  ]}
                >
                  {t("profile.perMonth")}
                </Text>
              </View>
            </View>
          )}
        </View>

        {settingsSections.map((section) => (
          <View key={section.title} style={styles.settingsSection}>
            <Text
              style={[
                styles.settingsSectionTitle,
                { color: colors.mutedForeground, textAlign },
              ]}
            >
              {section.title.toUpperCase()}
            </Text>
            <View
              style={[styles.settingsCard, { backgroundColor: colors.card }]}
            >
              {section.items.map((item, idx) => (
                <View key={item.label}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.settingsRow,
                      pressed && !item.toggle && { opacity: 0.7 },
                    ]}
                    onPress={item.toggle ? undefined : item.onPress}
                  >
                    <View
                      style={[
                        styles.settingsIcon,
                        { backgroundColor: colors.secondary },
                      ]}
                    >
                      <Feather
                        name={item.icon as any}
                        size={16}
                        color={colors.foreground}
                      />
                    </View>
                    <Text
                      style={[
                        styles.settingsLabel,
                        { color: colors.foreground, textAlign },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.toggle ? (
                      <Switch
                        value={item.value as boolean}
                        onValueChange={item.onToggle as (v: boolean) => void}
                        trackColor={{ true: "#2E3192", false: colors.border }}
                        thumbColor="#FFFFFF"
                      />
                    ) : item.value && typeof item.value === "string" ? (
                      <Text
                        style={[
                          styles.settingsValue,
                          { color: colors.mutedForeground, textAlign },
                        ]}
                      >
                        {item.value}
                      </Text>
                    ) : (
                      <Feather
                        name={isRTL ? "chevron-left" : "chevron-right"}
                        size={18}
                        color={colors.mutedForeground}
                      />
                    )}
                  </Pressable>
                  {idx < section.items.length - 1 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          style={styles.signOutBtn}
          testID="sign-out"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (Platform.OS === "web") {
              if (window.confirm(t("profile.signOutQuestion"))) void performSignOut();
              return;
            }
            Alert.alert(t("profile.signOut"), t("profile.signOutQuestion"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("profile.signOut"),
                style: "destructive",
                onPress: performSignOut,
              },
            ]);
          }}
        >
          <View
            style={[styles.signOutInner, { borderColor: "#EF4444" + "40" }]}
          >
            <Feather name="log-out" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>{t("profile.signOut")}</Text>
          </View>
        </Pressable>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          Bassera بصيرة v1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 28, alignItems: "center" },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPhoto: {
    ...StyleSheet.absoluteFill,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarLetter: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0B1026",
  },
  profileName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  nameEdit: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginBottom: 12,
  },
  headerBadges: { flexDirection: "row", alignItems: "center", gap: 12 },
  subBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  joinText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  body: { padding: 16, gap: 8 },
  personalityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  personalityIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  personalityLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 3,
  },
  personalityName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  viewBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewBtnText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  subscriptionCard: {
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  subTitle: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 3 },
  subCurrent: { fontSize: 18, fontFamily: "Inter_700Bold" },
  upgradeBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  upgradeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  featuresGrid: { gap: 8, marginBottom: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  premiumPriceRow: { flexDirection: "row", gap: 10 },
  priceCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  priceValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  pricePeriod: { fontSize: 11, fontFamily: "Inter_400Regular" },
  settingsSection: { gap: 6 },
  settingsSectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  settingsCard: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  settingsValue: { fontSize: 14, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginLeft: 62 },
  signOutBtn: { marginTop: 8, borderRadius: 16, overflow: "hidden" },
  signOutInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },
  signOutText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#EF4444",
  },
  version: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
});
