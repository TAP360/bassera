import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export type BiometricResult = "success" | "cancelled" | "unavailable";

/** Prompts for Face ID / Touch ID / fingerprint, falling back to the device passcode. */
export async function authenticateWithBiometrics(promptMessage: string, cancelLabel: string): Promise<BiometricResult> {
  if (Platform.OS === "web") return "unavailable";
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false });
    if (result.success) return "success";
    // No biometrics or passcode on the device: there is nothing to verify against.
    return ["not_enrolled", "not_available", "passcode_not_set"].includes(result.error) ? "unavailable" : "cancelled";
  } catch {
    return "cancelled";
  }
}
