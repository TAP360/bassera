import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** The active scheme: the user's Appearance preference, or the device setting for "system". */
export function useResolvedColorScheme(): "light" | "dark" {
  const theme = usePreferencesStore((state) => state.theme);
  const system = useColorScheme();
  if (theme !== "system") return theme;
  return system === "dark" ? "dark" : "light";
}

/**
 * Returns the design tokens for the active color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 */
export function useColors() {
  const scheme = useResolvedColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
