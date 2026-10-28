import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { CircularProgress } from '@/components/CircularProgress';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { AddReceiptModal } from '@/components/AddReceiptModal';
import { useProfile } from '@/hooks/useProfile';
import { useAppStore, type MoodType } from '@/stores/appStore';
import { useColors } from '@/hooks/useColors';
import { useLocalization } from '@/localization';
import { useConsumerSession } from '@/hooks/useConsumerSession';
import { useRecentTransactions } from '@/hooks/useRecentTransactions';
import { useAuthStore } from '@/stores/authStore';

const MOODS: { type: MoodType; icon: string; label: string }[] = [
  { type: 'great', icon: '😄', label: 'Great' },
  { type: 'good', icon: '🙂', label: 'Good' },
  { type: 'neutral', icon: '😐', label: 'Okay' },
  { type: 'stressed', icon: '😰', label: 'Stressed' },
  { type: 'anxious', icon: '😟', label: 'Anxious' },
];

const NUDGES = [
  {
    id: '1',
    type: 'savings',
    icon: 'trending-up',
    color: '#22C55E',
    text: 'You saved 12% more this week. Keep it up!',
  },
  {
    id: '2',
    type: 'warning',
    icon: 'alert-circle',
    color: '#F59E0B',
    text: 'Impulse spending risk elevated — take a breath before your next purchase.',
  },
  {
    id: '3',
    type: 'info',
    icon: 'zap',
    color: '#2E3192',
    text: 'Great progress toward your Emergency Fund. 62% complete!',
  },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const mood = useAppStore((state) => state.mood);
  const setMood = useAppStore((state) => state.setMood);
  const hasOnboarded = useAppStore((state) => state.hasOnboarded);
  const { isAuthenticated } = useConsumerSession();
  const recentTransactionsQuery = useRecentTransactions(isAuthenticated);
  const surveyPending = useAuthStore((state) => state.surveyPending);
  const { t, isRTL } = useLocalization();
  const textAlign = isRTL ? 'right' : 'left';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddReceipt, setShowAddReceipt] = useState(false);

  useEffect(() => {
    if ((!hasOnboarded && !isAuthenticated) || (isAuthenticated && surveyPending)) {
      router.replace('/onboarding');
      return;
    }
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [hasOnboarded, isAuthenticated, surveyPending]);

  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('home.goodMorning') : hour < 17 ? t('home.goodAfternoon') : t('home.goodEvening');
  const recentTransactions = recentTransactionsQuery.data ?? [];

  const quickActions = [
    {
      icon: 'message-circle',
      label: t('home.coach'),
      onPress: () => router.push('/(tabs)/coach'),
    },
    {
      icon: 'plus-circle',
      label: t('home.expense'),
      onPress: () => setShowAddExpense(true),
    },
    {
      icon: 'camera',
      label: t('home.receipt'),
      onPress: () => setShowAddReceipt(true),
    },
    {
      icon: 'target',
      label: t('home.goals'),
      onPress: () => router.push('/(tabs)/goals'),
    },
    {
      icon: 'bar-chart-2',
      label: t('home.insights'),
      onPress: () => router.push('/(tabs)/insights'),
    },
  ];

  return (
    <Animated.View
      style={[
        { flex: 1, backgroundColor: colors.background, opacity: fadeAnim, direction: isRTL ? 'rtl' : 'ltr' },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (Platform.OS == 'android' ? 96 : 0),
        }}
      >
        <LinearGradient
          colors={['#0B1026', '#1A1040', '#2E3192']}
          style={[styles.header, { paddingTop: topPad + 16 }]}
        >
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('personal.title')}
              onPress={() => router.push('/personal-info')}
            >
              <Text style={[styles.greetingSmall, { textAlign }]}>{greeting},</Text>
              <Text style={[styles.greetingName, { textAlign }]}>{profile.name} 👋</Text>
            </Pressable>
            <View style={styles.headerRight}>
              <Pressable style={styles.iconBtn} onPress={() => {}}>
                <Feather name="bell" size={22} color="rgba(255,255,255,0.8)" />
                <View style={styles.notifBadge} />
              </Pressable>
              <Pressable
                style={styles.avatar}
                accessibilityRole="button"
                accessibilityLabel={t('personal.title')}
                onPress={() => router.push('/personal-info')}
              >
                {profile.photoUri ? (
                  <Image
                    source={{ uri: profile.photoUri }}
                    style={styles.avatarPhoto}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {profile.name.trim()[0]?.toUpperCase() ?? '?'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.moodRow}>
              <Text style={[styles.moodLabel, { textAlign }]}>{t('home.feeling')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moodScroll}
            >
              {MOODS.map((m) => (
                <Pressable
                  key={m.type}
                  style={[
                    styles.moodChip,
                    mood === m.type && styles.moodChipActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMood(m.type);
                  }}
                >
                  <Text style={styles.moodEmoji}>{m.icon}</Text>
                  <Text
                    style={[
                      styles.moodText,
                      mood === m.type && styles.moodTextActive,
                    ]}
                  >
                    {t(`home.${m.type === 'neutral' ? 'okay' : m.type}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign }]}>
            {t('Your Wellness Overview')}
          </Text>

          <View style={[styles.mainCard, { backgroundColor: colors.card }]}>
            <LinearGradient
              colors={['#2E3192', '#92278F', '#F37021']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainCardHeader}
            >
              <Text style={[styles.mainCardTitle, { textAlign }]}>{t('home.wellnessScore')}</Text>
              <View style={styles.trendBadge}>
                <Feather name="trending-up" size={12} color="#22C55E" />
                <Text style={styles.trendText}>{t('home.thisMonth')}</Text>
              </View>
            </LinearGradient>
            <View style={styles.mainCardBody}>
              <CircularProgress
                value={profile.wellnessScore}
                size={140}
                strokeWidth={12}
                label="/ 100"
                valueColor={colors.foreground}
                trackColor={colors.border}
              />
              <View style={styles.wellnessDetails}>
                <Text
                  style={[styles.detailItem, { color: colors.mutedForeground, textAlign }]}
                >
                  <Text
                    style={[styles.detailBold, { color: colors.foreground, textAlign }]}
                  >
                    {t('Savings Rate')}{' '}
                  </Text>
                  18%
                </Text>
                <Text
                  style={[styles.detailItem, { color: colors.mutedForeground, textAlign }]}
                >
                  <Text
                    style={[styles.detailBold, { color: colors.foreground, textAlign }]}
                  >
                    {t('Debt Ratio')}{' '}
                  </Text>
                  Low
                </Text>
                <Text
                  style={[styles.detailItem, { color: colors.mutedForeground, textAlign }]}
                >
                  <Text
                    style={[styles.detailBold, { color: colors.foreground, textAlign }]}
                  >
                    {t('Habit Score')}{' '}
                  </Text>
                  Good
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <View style={[styles.scoreCard, { backgroundColor: colors.card }]}>
              <Text
                style={[styles.scoreLabel, { color: colors.mutedForeground }]}
              >
                EFI Score
              </Text>
              <CircularProgress
                value={profile.efiScore}
                size={84}
                strokeWidth={8}
                colors={['#92278F', '#F37021', '#F37021']}
                valueColor={colors.foreground}
                trackColor={colors.border}
              />
              <View style={styles.trendRow}>
                <Feather name="trending-up" size={12} color="#22C55E" />
                <Text style={styles.trendSmall}>+3</Text>
              </View>
            </View>

            <View style={[styles.scoreCard, { backgroundColor: colors.card }]}>
              <Text
                style={[styles.scoreLabel, { color: colors.mutedForeground }]}
              >
                Confidence
              </Text>
              <CircularProgress
                value={profile.confidenceScore}
                size={84}
                strokeWidth={8}
                colors={['#22C55E', '#2E3192', '#2E3192']}
                valueColor={colors.foreground}
                trackColor={colors.border}
              />
              <View style={styles.trendRow}>
                <Feather name="trending-up" size={12} color="#22C55E" />
                <Text style={styles.trendSmall}>+7</Text>
              </View>
            </View>
          </View>

          <LinearGradient
            colors={['#2E3192', '#92278F', '#F37021']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.insightCard}
          >
            <View style={styles.insightCardInner}>
              <View style={{ flex: 1 }}>
              <Text style={[styles.insightCardTitle, { textAlign }]}>{t('home.todaysInsight')}</Text>
                <Text style={[styles.insightCardText, { textAlign }]}>
                  {t('You saved 12% more this week. Reducing coffee spending by 20% could add 300 EGP to your Emergency Fund.')}
                </Text>
              </View>
              <Feather name="zap" size={28} color="rgba(255,255,255,0.7)" />
            </View>
          </LinearGradient>

          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign }]}>
            {t('Quick Actions')}
          </Text>
          <View style={styles.actionsRow}>
            {quickActions.map((a) => (
              <Pressable
                key={a.label}
                style={({ pressed }) => [
                  styles.actionItem,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  a.onPress();
                }}
              >
                <LinearGradient
                  colors={['#2E3192', '#92278F']}
                  style={styles.actionIcon}
                >
                  <Feather name={a.icon as any} size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text
                  style={[
                    styles.actionLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign }]}>
            {t('Smart Nudges')}
          </Text>
          {NUDGES.map((n) => (
            <View
              key={n.id}
              style={[styles.nudgeCard, { backgroundColor: colors.card }]}
            >
              <View
                style={[styles.nudgeIcon, { backgroundColor: n.color + '20' }]}
              >
                <Feather name={n.icon as any} size={18} color={n.color} />
              </View>
              <Text style={[styles.nudgeText, { color: colors.foreground, textAlign }]}>
                {t(n.text)}
              </Text>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign }]}>
            {t('home.recentTransactions')}
          </Text>
          {isAuthenticated && recentTransactionsQuery.isPending ? (
            <ActivityIndicator color={colors.foreground} />
          ) : recentTransactionsQuery.isError ? (
            <View style={[styles.txRow, { backgroundColor: colors.card }]}>
              <View style={styles.txInfo}>
                <Text style={[styles.txCategory, { color: colors.mutedForeground, textAlign }]}>
                  {t('home.transactionsLoadError')}
                </Text>
                <Pressable onPress={() => void recentTransactionsQuery.refetch()}>
                  <Text style={[styles.txTitle, { color: colors.foreground, textAlign }]}>
                    {t('common.retry')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : recentTransactions.length === 0 ? (
            <Text style={[styles.txCategory, { color: colors.mutedForeground, textAlign }]}>
              {t('home.noTransactions')}
            </Text>
          ) : recentTransactions.map((tx) => (
            <View
              key={tx.id}
              style={[styles.txRow, { backgroundColor: colors.card }]}
            >
              <View
                style={[
                  styles.txIcon,
                  {
                    backgroundColor:
                      tx.type === 'income' ? '#22C55E20' : '#F3702120',
                  },
                ]}
              >
                <Feather
                  name={
                    tx.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'
                  }
                  size={18}
                  color={tx.type === 'income' ? '#22C55E' : '#F37021'}
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={[styles.txTitle, { color: colors.foreground, textAlign }]}>
                  {tx.title}
                </Text>
                <Text
                  style={[styles.txCategory, { color: colors.mutedForeground, textAlign }]}
                >
                  {tx.category}
                </Text>
              </View>
              <View style={styles.txRight}>
                <Text
                  style={[
                    styles.txAmount,
                    { color: tx.type === 'income' ? '#22C55E' : '#F37021', textAlign },
                  ]}
                >
                  {tx.type === 'income' ? '+' : ''}
                  {tx.amount.toLocaleString()} {tx.currency}
                </Text>
                <Text
                  style={[styles.txDate, { color: colors.mutedForeground, textAlign }]}
                >
                  {tx.date}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        initialType="expense"
      />
      <AddReceiptModal
        visible={showAddReceipt}
        onClose={() => setShowAddReceipt(false)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greetingSmall: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  greetingName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F37021',
    borderWidth: 1.5,
    borderColor: '#0B1026',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(243,112,33,0.3)',
    borderWidth: 2,
    borderColor: 'rgba(243,112,33,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#F37021' },
  avatarPhoto: { width: '100%', height: '100%', borderRadius: 20 },
  moodRow: { marginTop: 4 },
  moodLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 10,
  },
  moodScroll: { gap: 8, paddingRight: 8 },
  moodChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  moodChipActive: {
    backgroundColor: 'rgba(243,112,33,0.25)',
    borderColor: '#F37021',
  },
  moodEmoji: { fontSize: 20 },
  moodText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.5)',
  },
  moodTextActive: { color: '#F37021' },

  body: { padding: 20, gap: 6 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginTop: 12,
    marginBottom: 8,
  },
  mainCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  mainCardHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainCardTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  trendText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#22C55E' },
  mainCardBody: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  wellnessDetails: { flex: 1, gap: 10 },
  detailItem: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  detailBold: { fontFamily: 'Inter_600SemiBold' },
  scoreRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  scoreCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trendSmall: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#22C55E' },
  insightCard: { borderRadius: 20, marginBottom: 12 },
  insightCardInner: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightCardTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  insightCardText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    lineHeight: 20,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionItem: { alignItems: 'center', gap: 6 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  nudgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  txCategory: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  txDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
