import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAppStore } from '@/stores/appStore';
import { useColors } from '@/hooks/useColors';
import { useLocalization } from '@/localization';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const paymentMethods = useAppStore((state) => state.paymentMethods);
  const linkedAccounts = useAppStore((state) => state.linkedAccounts);
  const removePaymentMethod = useAppStore((state) => state.removePaymentMethod);
  const { t, isRTL } = useLocalization();
  const textAlign = isRTL ? 'right' : 'left';
  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const groups = [
    { kind: 'account' as const, title: t('payments.accounts'), icon: 'briefcase' as const },
    { kind: 'card' as const, title: t('payments.cards'), icon: 'credit-card' as const },
    { kind: 'wallet' as const, title: t('payments.wallets'), icon: 'smartphone' as const },
  ];

  const confirmRemove = (id: string, label: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('payments.removeMessage', { label }))) removePaymentMethod(id);
      return;
    }
    Alert.alert(t('payments.removeTitle'), t('payments.removeMessage', { label }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('payments.remove'),
        style: 'destructive',
        onPress: () => removePaymentMethod(id),
      },
    ]);
  };

  const renderDetails = (method: (typeof paymentMethods)[number]) => {
    if (method.kind === 'account') {
      const account = linkedAccounts.find((item) => item.id === method.accountId);
      return (
        <>
          <Text style={[styles.methodName, { color: colors.foreground, textAlign }]} numberOfLines={1}>
            {account?.label ?? method.label}
          </Text>
          <Text style={[styles.methodMeta, { color: colors.mutedForeground, textAlign }]} numberOfLines={1}>
            {account?.institution ?? method.provider}
            {(account?.last4 ?? method.last4) ? ` · ${t('payments.endingIn', { last4: account?.last4 ?? method.last4 ?? '' })}` : ''}
          </Text>
        </>
      );
    }
    return (
      <>
        <Text style={[styles.methodName, { color: colors.foreground, textAlign }]} numberOfLines={1}>
          {method.label}
        </Text>
        <Text style={[styles.methodMeta, { color: colors.mutedForeground, textAlign }]} numberOfLines={1}>
          {method.provider}
          {method.kind === 'card' && method.last4
            ? ` · ${t('payments.endingIn', { last4: method.last4 })}`
            : ''}
        </Text>
      </>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' }]}>
      <LinearGradient
        colors={[colors.darkBg, colors.indigo, colors.purple]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 12, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID="payment-methods-back"
        >
          <Feather name={isRTL ? 'arrow-right' : 'arrow-left'} size={21} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { textAlign }]}>{t('payments.title')}</Text>
          <Text style={[styles.headerSubtitle, { textAlign }]}>{t('payments.subtitle')}</Text>
        </View>
        <Pressable
          style={styles.headerAdd}
          onPress={() => router.push('/add-payment-method')}
          accessibilityRole="button"
          accessibilityLabel={t('payments.add')}
          testID="payment-methods-add"
        >
          <Feather name="plus" size={21} color="#FFFFFF" />
        </Pressable>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={[styles.noticeIcon, { backgroundColor: colors.primary + '18' }]}>
            <Feather name="info" size={17} color={colors.primary} />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={[styles.noticeTitle, { color: colors.foreground, textAlign }]}>{t('payments.localTitle')}</Text>
            <Text style={[styles.noticeText, { color: colors.mutedForeground, textAlign }]}>{t('payments.localNotice')}</Text>
          </View>
        </View>

        {paymentMethods.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="credit-card" size={27} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, textAlign: 'center' }]}>{t('payments.emptyTitle')}</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: 'center' }]}>{t('payments.emptyMessage')}</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/add-payment-method')}
              accessibilityRole="button"
              testID="payment-methods-empty-add"
            >
              <LinearGradient
                colors={[colors.indigo, colors.purple, colors.orange]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Feather name="plus" size={17} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{t('payments.add')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          groups.map((group) => {
            const entries = paymentMethods.filter((method) => method.kind === group.kind);
            if (!entries.length) return null;
            return (
              <View key={group.kind} style={styles.group}>
                <View style={styles.groupHeading}>
                  <View style={[styles.groupIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name={group.icon} size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.groupTitle, { color: colors.foreground, textAlign }]}>{group.title}</Text>
                  <Text style={[styles.groupCount, { color: colors.mutedForeground }]}>{entries.length}</Text>
                </View>
                <View style={[styles.methodList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {entries.map((method, index) => (
                    <View
                      key={method.id}
                      style={[
                        styles.methodRow,
                        index < entries.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                      ]}
                    >
                      <View style={[styles.methodGlyph, { backgroundColor: colors.secondary }]}>
                        <Feather name={group.icon} size={18} color={colors.primary} />
                      </View>
                      <View style={styles.methodCopy}>{renderDetails(method)}</View>
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => confirmRemove(method.id, method.label)}
                        accessibilityRole="button"
                        accessibilityLabel={t('payments.removeNamed', { label: method.label })}
                        testID={`payment-method-remove-${method.id}`}
                      >
                        <Feather name="trash-2" size={17} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, gap: 3 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.74)' },
  headerAdd: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 20 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  noticeIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  noticeText: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  emptyCard: { alignItems: 'center', padding: 24, borderRadius: 22, borderWidth: 1, gap: 10, marginTop: 2 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', textAlign: 'center', maxWidth: 270 },
  primaryButton: { borderRadius: 14, overflow: 'hidden', marginTop: 8, alignSelf: 'stretch' },
  primaryButtonGradient: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', paddingVertical: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  group: { gap: 10 },
  groupHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  groupIcon: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  groupCount: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  methodList: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  methodRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  methodGlyph: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  methodCopy: { flex: 1, gap: 5 },
  methodName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  methodMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  deleteButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
});