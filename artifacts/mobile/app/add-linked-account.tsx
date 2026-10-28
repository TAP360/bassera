import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore, type LinkedAccountKind } from '@/stores/appStore';
import { useColors } from '@/hooks/useColors';
import { useLocalization } from '@/localization';

const ACCOUNT_KINDS: LinkedAccountKind[] = ['checking', 'savings', 'credit', 'investment', 'other'];
type AddMode = 'manual' | 'openBanking';

export default function AddLinkedAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const addLinkedAccount = useAppStore((state) => state.addLinkedAccount);
  const { t, isRTL } = useLocalization();
  const textAlign = isRTL ? 'right' : 'left';
  const [mode, setMode] = useState<AddMode>('manual');
  const [institution, setInstitution] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<LinkedAccountKind>('checking');
  const [last4, setLast4] = useState('');
  const [saving, setSaving] = useState(false);
  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const saveAccount = () => {
    const showValidation = (message: string) => {
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert(t('accounts.validationTitle'), message);
    };
    if (!institution.trim()) {
      showValidation(t('accounts.institutionRequired'));
      return;
    }
    if (!label.trim()) {
      showValidation(t('accounts.labelRequired'));
      return;
    }
    if (last4 && !/^\d{4}$/.test(last4)) {
      showValidation(t('accounts.last4Invalid'));
      return;
    }
    setSaving(true);
    try {
      addLinkedAccount({
        institution: institution.trim(),
        label: label.trim(),
        kind,
        ...(last4 ? { last4 } : {}),
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleLast4 = (value: string) => setLast4(value.replace(/\D/g, '').slice(0, 4));

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { backgroundColor: colors.darkBg, paddingTop: topPad + 12, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID="add-linked-account-back"
        >
          <Feather name={isRTL ? 'arrow-right' : 'arrow-left'} size={21} color={colors.primaryForeground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.primaryForeground, textAlign: 'center' }]}>{t('accounts.addTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: colors.foreground, textAlign }]}>{t('accounts.addHeading')}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign }]}>{t('accounts.addSubtitle')}</Text>

        <View style={[styles.modeSwitch, { backgroundColor: colors.secondary }]}>
          <Pressable
            style={[styles.modeButton, mode === 'manual' && { backgroundColor: colors.card }]}
            onPress={() => setMode('manual')}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'manual' }}
            testID="account-mode-manual"
          >
            <Feather name="edit-3" size={15} color={mode === 'manual' ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.modeText, { color: mode === 'manual' ? colors.foreground : colors.mutedForeground }]}>
              {t('accounts.manualEntry')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'openBanking' && { backgroundColor: colors.card }]}
            onPress={() => setMode('openBanking')}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'openBanking' }}
            testID="account-mode-open-banking"
          >
            <Feather name="shield" size={15} color={mode === 'openBanking' ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.modeText, { color: mode === 'openBanking' ? colors.foreground : colors.mutedForeground }]}>
              {t('accounts.openBanking')}
            </Text>
          </Pressable>
        </View>

        {mode === 'manual' ? (
          <>
            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign }]}>{t('accounts.institution')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign, writingDirection: isRTL ? 'rtl' : 'ltr' }]}
                  value={institution}
                  onChangeText={setInstitution}
                  placeholder={t('accounts.institutionPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                  returnKeyType="next"
                  accessibilityLabel={t('accounts.institution')}
                  testID="linked-account-institution"
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign }]}>{t('accounts.accountLabel')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign, writingDirection: isRTL ? 'rtl' : 'ltr' }]}
                  value={label}
                  onChangeText={setLabel}
                  placeholder={t('accounts.accountLabelPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                  accessibilityLabel={t('accounts.accountLabel')}
                  testID="linked-account-label"
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign }]}>{t('accounts.accountKind')}</Text>
                <View style={styles.kindGrid}>
                  {ACCOUNT_KINDS.map((option) => {
                    const selected = kind === option;
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.kindOption,
                          { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.background },
                        ]}
                        onPress={() => setKind(option)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        testID={`linked-account-kind-${option}`}
                      >
                        <Text style={[styles.kindOptionText, { color: selected ? colors.primary : colors.foreground, textAlign }]}>
                          {t(`accounts.kind.${option}`)}
                        </Text>
                        {selected ? <Feather name="check" size={15} color={colors.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign }]}>{t('accounts.last4')}</Text>
                <TextInput
                  style={[styles.input, styles.last4Input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, writingDirection: 'ltr' }]}
                  value={last4}
                  onChangeText={handleLast4}
                  placeholder="••••"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={4}
                  accessibilityLabel={t('accounts.last4')}
                  testID="linked-account-last4"
                />
                <Text style={[styles.helperText, { color: colors.mutedForeground, textAlign }]}>{t('accounts.last4Help')}</Text>
              </View>
            </View>
            <View style={[styles.safetyNote, { backgroundColor: colors.secondary }]}>
              <Feather name="lock" size={16} color={colors.primary} />
              <Text style={[styles.safetyText, { color: colors.secondaryForeground, textAlign }]}>{t('accounts.manualSafety')}</Text>
            </View>
            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled]}
              onPress={saveAccount}
              disabled={saving}
              accessibilityRole="button"
              testID="save-linked-account"
            >
              <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{saving ? t('common.loading') : t('accounts.saveAccount')}</Text>
              <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={18} color={colors.primaryForeground} />
            </Pressable>
          </>
        ) : (
          <View style={styles.openBankingContent}>
            <View style={[styles.unavailableBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={[styles.statusIcon, { backgroundColor: colors.card }]}>
                <Feather name="clock" size={18} color={colors.primary} />
              </View>
              <View style={styles.bannerCopy}>
                <Text style={[styles.bannerTitle, { color: colors.foreground, textAlign }]}>{t('accounts.openBankingUnavailableTitle')}</Text>
                <Text style={[styles.bannerBody, { color: colors.mutedForeground, textAlign }]}>{t('accounts.openBankingUnavailable')}</Text>
              </View>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t('accounts.openBankingStepsTitle')}</Text>
            <View style={styles.stepsList}>
              {[
                ['accounts.openStep1Title', 'accounts.openStep1Body'],
                ['accounts.openStep2Title', 'accounts.openStep2Body'],
                ['accounts.openStep3Title', 'accounts.openStep3Body'],
                ['accounts.openStep4Title', 'accounts.openStep4Body'],
              ].map(([titleKey, bodyKey], index) => (
                <View key={titleKey} style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.stepNumberText, { color: colors.primaryForeground }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={[styles.stepTitle, { color: colors.foreground }]}>{t(titleKey)}</Text>
                    <Text style={[styles.stepBody, { color: colors.mutedForeground }]}>{t(bodyKey)}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={[styles.consentNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="eye" size={17} color={colors.primary} />
              <Text style={[styles.consentText, { color: colors.foreground }]}>{t('accounts.readOnlyConsent')}</Text>
            </View>
            <View style={[styles.credentialWarning, { backgroundColor: colors.secondary }]}>
              <Feather name="shield" size={17} color={colors.primary} />
              <Text style={[styles.safetyText, { color: colors.secondaryForeground }]}>{t('accounts.credentialsWarning')}</Text>
            </View>
            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.muted }]}
              disabled
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              testID="open-banking-unavailable"
            >
              <Text style={[styles.saveText, { color: colors.mutedForeground }]}>{t('accounts.openBankingUnavailableButton')}</Text>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 24, gap: 13 },
  heading: { fontSize: 24, lineHeight: 30, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: -7 },
  modeSwitch: { flexDirection: 'row', padding: 4, borderRadius: 14, marginTop: 7 },
  modeButton: {
    minHeight: 42,
    flex: 1,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 5,
  },
  modeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  formCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 18, marginTop: 5 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14, fontFamily: 'Inter_400Regular' },
  last4Input: { width: 112, textAlign: 'center', letterSpacing: 4 },
  helperText: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindOption: {
    minHeight: 39,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  kindOptionText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  safetyNote: { borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  safetyText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  saveButton: {
    minHeight: 52,
    borderRadius: 15,
    marginTop: 3,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  saveText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  disabled: { opacity: 0.65 },
  openBankingContent: { gap: 14, marginTop: 5 },
  unavailableBanner: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 11 },
  statusIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerCopy: { flex: 1, gap: 4 },
  bannerTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bannerBody: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  stepsList: { gap: 9 },
  stepCard: { borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  stepCopy: { flex: 1, gap: 3 },
  stepTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  stepBody: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  consentNote: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  consentText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  credentialWarning: { borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
});