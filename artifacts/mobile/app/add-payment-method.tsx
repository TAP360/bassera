import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAppStore, type PaymentMethodKind } from '@/stores/appStore';
import { useColors } from '@/hooks/useColors';
import { useLocalization } from '@/localization';

const methodKinds: PaymentMethodKind[] = ['account', 'card', 'wallet'];

export default function AddPaymentMethodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const linkedAccounts = useAppStore((state) => state.linkedAccounts);
  const addPaymentMethod = useAppStore((state) => state.addPaymentMethod);
  const { t, isRTL } = useLocalization();
  const textAlign: 'right' | 'left' = isRTL ? 'right' : 'left';
  const [kind, setKind] = useState<PaymentMethodKind>('account');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [label, setLabel] = useState('');
  const [provider, setProvider] = useState('');
  const [last4, setLast4] = useState('');
  const [error, setError] = useState('');
  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const selectKind = (next: PaymentMethodKind) => {
    setKind(next);
    setError('');
  };

  const save = () => {
    if (kind === 'account') {
      const account = linkedAccounts.find((item) => item.id === selectedAccountId);
      if (!account) {
        setError(t(linkedAccounts.length ? 'payments.chooseAccountError' : 'payments.noAccountsError'));
        return;
      }
      addPaymentMethod({
        kind,
        label: account.label,
        accountId: account.id,
        provider: account.institution,
        last4: account.last4,
      });
    } else {
      if (!label.trim()) {
        setError(t('payments.nicknameRequired'));
        return;
      }
      if (!provider.trim()) {
        setError(kind === 'card' ? t('payments.issuerRequired') : t('payments.walletProviderRequired'));
        return;
      }
      if (last4 && !/^\d{4}$/.test(last4)) {
        setError(t('payments.last4Error'));
        return;
      }
      addPaymentMethod({
        kind,
        label: label.trim(),
        provider: provider.trim(),
        ...(kind === 'card' && last4 ? { last4 } : {}),
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const inputStyle = [styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, textAlign, writingDirection: isRTL ? 'rtl' as const : 'ltr' as const }];
  const kindLabels: Record<PaymentMethodKind, string> = {
    account: t('payments.accounts'),
    card: t('payments.cards'),
    wallet: t('payments.wallets'),
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' }]}>
      <LinearGradient
        colors={[colors.darkBg, colors.indigo, colors.purple]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID="add-payment-back"
        >
          <Feather name={isRTL ? 'arrow-right' : 'arrow-left'} size={21} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { textAlign }]}>{t('payments.addTitle')}</Text>
          <Text style={[styles.headerSubtitle, { textAlign }]}>{t('payments.addSubtitle')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 30 }]}
        bottomOffset={74}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign }]}>{t('payments.methodType')}</Text>
        <View style={[styles.segmented, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          {methodKinds.map((item) => {
            const active = kind === item;
            const icon = item === 'account' ? 'briefcase' : item === 'card' ? 'credit-card' : 'smartphone';
            return (
              <Pressable
                key={item}
                style={[
                  styles.segment,
                  active && { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => selectKind(item)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                testID={`payment-kind-${item}`}
              >
                <Feather name={icon} size={15} color={active ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.segmentText, { color: active ? colors.foreground : colors.mutedForeground }]}>
                  {kindLabels[item]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {kind === 'account' ? (
          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign }]}>{t('payments.chooseAccount')}</Text>
              <Text style={[styles.optional, { color: colors.mutedForeground, textAlign }]}>{t('payments.manuallySaved')}</Text>
            </View>
            {linkedAccounts.length ? (
              <View style={[styles.accountList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {linkedAccounts.map((account, index) => {
                  const selected = selectedAccountId === account.id;
                  return (
                    <Pressable
                      key={account.id}
                      style={[
                        styles.accountOption,
                        index < linkedAccounts.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                      ]}
                      onPress={() => {
                        setSelectedAccountId(account.id);
                        setError('');
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      testID={`payment-account-${account.id}`}
                    >
                      <View style={[styles.accountIcon, { backgroundColor: colors.secondary }]}>
                        <Feather name="briefcase" size={17} color={colors.primary} />
                      </View>
                      <View style={styles.accountCopy}>
                        <Text style={[styles.accountName, { color: colors.foreground, textAlign }]} numberOfLines={1}>{account.label}</Text>
                        <Text style={[styles.accountMeta, { color: colors.mutedForeground, textAlign }]} numberOfLines={1}>
                          {account.institution}{account.last4 ? ` · ${t('payments.endingIn', { last4: account.last4 })}` : ''}
                        </Text>
                      </View>
                      <Feather
                        name={selected ? 'check-circle' : 'circle'}
                        size={20}
                        color={selected ? colors.primary : colors.border}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.emptyAccounts, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.emptyAccountsIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name="link" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.emptyAccountsText, { color: colors.mutedForeground }]}>{t('payments.noAccounts')}</Text>
                <Pressable
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={() => router.push('/add-linked-account')}
                  accessibilityRole="button"
                  testID="payment-add-linked-account"
                >
                  <Feather name="plus" size={16} color={colors.primary} />
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{t('payments.addLinkedAccount')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.formGroup}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign }]}>
                {kind === 'card' ? t('payments.cardNickname') : t('payments.walletNickname')}
              </Text>
              <TextInput
                style={inputStyle}
                value={label}
                onChangeText={(value) => { setLabel(value); setError(''); }}
                placeholder={t('payments.nicknamePlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                maxLength={40}
                returnKeyType="next"
                accessibilityLabel={kind === 'card' ? t('payments.cardNickname') : t('payments.walletNickname')}
                testID="payment-method-nickname"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign }]}>
                {kind === 'card' ? t('payments.issuer') : t('payments.walletProvider')}
              </Text>
              <TextInput
                style={inputStyle}
                value={provider}
                onChangeText={(value) => { setProvider(value); setError(''); }}
                placeholder={kind === 'card' ? t('payments.issuerPlaceholder') : t('payments.walletProviderPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                maxLength={40}
                returnKeyType={kind === 'card' ? 'next' : 'done'}
                accessibilityLabel={kind === 'card' ? t('payments.issuer') : t('payments.walletProvider')}
                testID="payment-method-provider"
              />
            </View>
            {kind === 'card' && (
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign }]}>{t('payments.last4Label')}</Text>
                  <Text style={[styles.optional, { color: colors.mutedForeground, textAlign }]}>{t('payments.optional')}</Text>
                </View>
                <TextInput
                  style={[inputStyle, { textAlign: 'center', writingDirection: 'ltr' }]}
                  value={last4}
                  onChangeText={(value) => { setLast4(value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                  placeholder="••••"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={4}
                  returnKeyType="done"
                  accessibilityLabel={t('payments.last4Label')}
                  testID="payment-method-last4"
                />
              </View>
            )}
            <View style={[styles.safetyNote, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="shield" size={17} color={colors.primary} />
              <Text style={[styles.safetyText, { color: colors.mutedForeground, textAlign }]}>
                {kind === 'card' ? t('payments.cardSafety') : t('payments.walletSafety')}
              </Text>
            </View>
          </View>
        )}

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + '12' }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, textAlign }]}>{error}</Text>
          </View>
        ) : null}

        <View style={[styles.disclaimer, { borderColor: colors.border }]}>
          <Feather name="info" size={15} color={colors.mutedForeground} />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground, textAlign }]}>{t('payments.referenceDisclaimer')}</Text>
        </View>

        <Pressable
          style={styles.saveButton}
          onPress={save}
          accessibilityRole="button"
          testID="payment-method-save"
        >
          <LinearGradient
            colors={[colors.indigo, colors.purple, colors.orange]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveGradient}
          >
            <Text style={styles.saveText}>{t('payments.save')}</Text>
            <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={18} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 3 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.74)' },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 19 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.65 },
  segmented: { flexDirection: 'row', padding: 4, gap: 4, borderWidth: 1, borderRadius: 15 },
  segment: { flex: 1, minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: 'transparent', borderRadius: 11, paddingHorizontal: 4 },
  segmentText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  formGroup: { gap: 16 },
  fieldGroup: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optional: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 15, fontFamily: 'Inter_400Regular' },
  accountList: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  accountOption: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  accountIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  accountCopy: { flex: 1, gap: 4 },
  accountName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  accountMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  emptyAccounts: { alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 23, gap: 11 },
  emptyAccountsIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emptyAccountsText: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  secondaryButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12, marginTop: 2 },
  secondaryButtonText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  safetyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: 14, borderWidth: 1 },
  safetyText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  errorText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  disclaimer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  disclaimerText: { flex: 1, fontSize: 11, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  saveButton: { borderRadius: 16, overflow: 'hidden', marginTop: 2 },
  saveGradient: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  saveText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
});