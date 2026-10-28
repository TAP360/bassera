import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore, type LinkedAccount, type LinkedAccountKind } from '@/stores/appStore';
import { useColors } from '@/hooks/useColors';
import { useLocalization } from '@/localization';

const KIND_ICONS: Record<LinkedAccountKind, React.ComponentProps<typeof Feather>['name']> = {
  checking: 'credit-card',
  savings: 'archive',
  credit: 'credit-card',
  investment: 'trending-up',
  other: 'briefcase',
};

export default function LinkedAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const linkedAccounts = useAppStore((state) => state.linkedAccounts);
  const paymentMethods = useAppStore((state) => state.paymentMethods);
  const removeLinkedAccount = useAppStore((state) => state.removeLinkedAccount);
  const { t, isRTL } = useLocalization();
  const textAlign = isRTL ? 'right' : 'left';
  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const kindLabel = (kind: LinkedAccountKind) => t(`accounts.kind.${kind}`);

  const confirmRemove = (account: LinkedAccount) => {
    const linkedMethods = paymentMethods.filter((method) => method.accountId === account.id).length;
    const message = linkedMethods
      ? t('accounts.removeMessageWithMethods', { count: linkedMethods })
      : t('accounts.removeMessage');
    const remove = () => removeLinkedAccount(account.id);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${t('accounts.removeTitle')}\n\n${message}`)) {
        remove();
      }
      return;
    }

    Alert.alert(t('accounts.removeTitle'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('accounts.remove'), style: 'destructive', onPress: remove },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' }]}>
      <View style={[styles.header, { backgroundColor: colors.darkBg, paddingTop: topPad + 12, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID="linked-accounts-back"
        >
          <Feather name={isRTL ? 'arrow-right' : 'arrow-left'} size={21} color={colors.primaryForeground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.primaryForeground, textAlign: 'center' }]}>{t('accounts.title')}</Text>
        <Pressable
          style={styles.headerAdd}
          onPress={() => router.push('/add-linked-account')}
          accessibilityRole="button"
          accessibilityLabel={t('accounts.add')}
          testID="linked-accounts-add"
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={[styles.heading, { color: colors.foreground, textAlign }]}>{t('accounts.heading')}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign }]}>{t('accounts.subtitle')}</Text>
        </View>

        {linkedAccounts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="layers" size={25} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, textAlign: 'center' }]}>{t('accounts.emptyTitle')}</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: 'center' }]}>{t('accounts.emptyMessage')}</Text>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/add-linked-account')}
              accessibilityRole="button"
              testID="linked-accounts-empty-add"
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{t('accounts.add')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.accountList}>
            <Text style={[styles.listCaption, { color: colors.mutedForeground, textAlign }]}>
              {t('accounts.linkedCount', { count: linkedAccounts.length })}
            </Text>
            {linkedAccounts.map((account) => (
              <View
                key={account.id}
                style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.accountTop}>
                  <View style={[styles.accountIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name={KIND_ICONS[account.kind]} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountInstitution, { color: colors.foreground, textAlign }]} numberOfLines={1}>
                      {account.institution}
                    </Text>
                    <Text style={[styles.accountLabel, { color: colors.mutedForeground, textAlign }]} numberOfLines={1}>
                      {account.label}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => confirmRemove(account)}
                    accessibilityRole="button"
                    accessibilityLabel={t('accounts.removeAccount', { label: account.label })}
                    testID={`remove-linked-account-${account.id}`}
                  >
                    <Feather name="trash-2" size={18} color={colors.destructive} />
                  </Pressable>
                </View>
                <View style={[styles.accountMeta, { borderTopColor: colors.border }]}>
                  <View style={[styles.kindPill, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.kindText, { color: colors.secondaryForeground }]}>{kindLabel(account.kind)}</Text>
                  </View>
                  <View style={[styles.sourcePill, { backgroundColor: colors.muted }]}>
                    <Feather name="edit-3" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.sourceText, { color: colors.mutedForeground }]}>{t('accounts.manualSource')}</Text>
                  </View>
                  {account.last4 ? (
                    <Text style={[styles.last4, { color: colors.mutedForeground }]}>{t('accounts.endsIn', { last4: account.last4 })}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            <Pressable
              style={[styles.secondaryAddButton, { borderColor: colors.border }]}
              onPress={() => router.push('/add-linked-account')}
              accessibilityRole="button"
              testID="linked-accounts-add-another"
            >
              <Feather name="plus" size={17} color={colors.primary} />
              <Text style={[styles.secondaryAddText, { color: colors.primary }]}>{t('accounts.addAnother')}</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.privacyNote, { backgroundColor: colors.secondary }]}>
          <Feather name="shield" size={16} color={colors.primary} />
          <Text style={[styles.privacyText, { color: colors.secondaryForeground, textAlign }]}>{t('accounts.privacyNote')}</Text>
        </View>
      </ScrollView>
    </View>
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
  headerAdd: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, gap: 22 },
  intro: { gap: 7 },
  heading: { fontSize: 24, lineHeight: 30, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular' },
  emptyCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 26,
  },
  emptyIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8, marginBottom: 21 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  accountList: { gap: 12 },
  listCaption: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginBottom: 1 },
  accountCard: { borderWidth: 1, borderRadius: 19, paddingHorizontal: 16, paddingTop: 16, overflow: 'hidden' },
  accountTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 15 },
  accountIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  accountInfo: { flex: 1, gap: 4 },
  accountInstitution: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  accountLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  removeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  accountMeta: { minHeight: 47, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  kindPill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  kindText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  sourcePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sourceText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  last4: { fontSize: 12, fontFamily: 'Inter_500Medium', marginLeft: 'auto' },
  secondaryAddButton: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryAddText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  privacyNote: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
});