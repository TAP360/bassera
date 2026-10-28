import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useSignOut } from "@/hooks/useSignOut";
import { useLocalization } from "@/localization";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { authenticateWithBiometrics } from "@/utils/biometrics";

// Brief app switches (e.g. the Android camera) do not re-lock.
const RELOCK_AFTER_MS = 30_000;

/** Covers the app until the user passes biometrics, on launch and after returning from background. */
export function BiometricLock({ isAuthenticated, children }: { isAuthenticated: boolean; children: React.ReactNode }) {
  const enabled = usePreferencesStore((state) => state.biometric);
  const active = enabled && isAuthenticated && Platform.OS !== "web";
  const [locked, setLocked] = useState(enabled);
  const [prompting, setPrompting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const { t } = useLocalization();
  const signOut = useSignOut();

  const unlock = useCallback(async () => {
    if (prompting) return;
    setPrompting(true);
    const result = await authenticateWithBiometrics(t("biometric.unlockPrompt"), t("common.cancel"));
    setPrompting(false);
    if (result !== "cancelled") setLocked(false);
  }, [prompting, t]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") backgroundedAt.current = Date.now();
      else if (state === "active" && backgroundedAt.current !== null) {
        if (Date.now() - backgroundedAt.current >= RELOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  const showLock = active && locked;
  useEffect(() => {
    if (showLock && AppState.currentState === "active") void unlock();
    // Prompt once each time the lock appears; retries use the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {showLock ? (
        <LinearGradient colors={["#0B1026", "#1A1040", "#2E3192"]} style={[StyleSheet.absoluteFill, styles.lock]}>
          <View style={styles.icon}>
            <Feather name="lock" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{t("biometric.lockedTitle")}</Text>
          <Text style={styles.message}>{t("biometric.lockedMessage")}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.unlockBtn}
            disabled={prompting}
            onPress={() => void unlock()}
          >
            <Text style={styles.unlockText}>{t("biometric.unlock")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={() => {
              setSigningOut(true);
              void signOut().catch(() => undefined).finally(() => setSigningOut(false));
            }}
          >
            <Text style={[styles.signOut, signingOut && { opacity: 0.5 }]}>{t("profile.signOut")}</Text>
          </Pressable>
        </LinearGradient>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: "center", justifyContent: "center", padding: 32, gap: 14, zIndex: 1000 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { color: "#FFFFFF", fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  message: { color: "rgba(255,255,255,0.75)", fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  unlockBtn: {
    marginTop: 16,
    backgroundColor: "#F37021",
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
  },
  unlockText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  signOut: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 12 },
});
