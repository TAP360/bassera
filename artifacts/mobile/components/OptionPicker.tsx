import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useLocalization } from "@/localization";

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface OptionPickerProps<T extends string> {
  visible: boolean;
  title: string;
  options: readonly PickerOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

/** Bottom-sheet list for choosing one option (works with any number of options on all platforms). */
export function OptionPicker<T extends string>({ visible, title, options, selected, onSelect, onClose }: OptionPickerProps<T>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, t } = useLocalization();
  const textAlign = isRTL ? "right" : "left";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, paddingBottom: insets.bottom + 16, direction: isRTL ? "rtl" : "ltr" },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.foreground, textAlign }]}>{title}</Text>
        <ScrollView style={{ maxHeight: 420 }}>
          {options.map((option) => {
            const isSelected = option.value === selected;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  onClose();
                  if (!isSelected) onSelect(option.value);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.foreground, textAlign }]}>{option.label}</Text>
                  {option.description ? (
                    <Text style={[styles.description, { color: colors.mutedForeground, textAlign }]}>
                      {option.description}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? <Feather name="check" size={20} color="#2E3192" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
  label: { fontSize: 16, fontFamily: "Inter_500Medium" },
  description: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
});
