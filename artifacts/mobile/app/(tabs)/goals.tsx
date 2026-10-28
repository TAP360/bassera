import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useGoals } from '@/hooks/useGoals';
import { useLocalization } from '@/localization';

const ACHIEVEMENTS = [
  {
    id: '1',
    icon: 'award',
    label: 'First Save',
    desc: 'Saved for the first time',
    unlocked: true,
    color: '#F37021',
  },
  {
    id: '2',
    icon: 'zap',
    label: '7-Day Streak',
    desc: 'Saved 7 days in a row',
    unlocked: true,
    color: '#2E3192',
  },
  {
    id: '3',
    icon: 'shield',
    label: 'Emergency Ready',
    desc: '50% Emergency Fund',
    unlocked: true,
    color: '#22C55E',
  },
  {
    id: '4',
    icon: 'star',
    label: 'Discipline',
    desc: 'No impulse buys for 2 weeks',
    unlocked: false,
    color: '#92278F',
  },
  {
    id: '5',
    icon: 'target',
    label: 'Goal Getter',
    desc: 'Complete your first goal',
    unlocked: false,
    color: '#F59E0B',
  },
  {
    id: '6',
    icon: 'trending-up',
    label: 'Investor',
    desc: 'Start your investment journey',
    unlocked: false,
    color: '#64748B',
  },
];

const GOAL_PRESETS = [
  { id: 'emergency', icon: 'shield', label: 'Emergency', color: '#22C55E', emoji: '🛡️' },
  { id: 'home', icon: 'home', label: 'Home', color: '#2E3192', emoji: '🏠' },
  { id: 'investment', icon: 'briefcase', label: 'Investment', color: '#92278F', emoji: '💼' },
  { id: 'education', icon: 'book', label: 'Education', color: '#F37021', emoji: '📚' },
  { id: 'travel', icon: 'globe', label: 'Travel', color: '#0EA5E9', emoji: '✈️' },
  { id: 'health', icon: 'heart', label: 'Health', color: '#EF4444', emoji: '❤️' },
  { id: 'car', icon: 'car', label: 'Car', color: '#F59E0B', emoji: '🚗' },
  { id: 'savings', icon: 'target', label: 'Savings', color: '#64748B', emoji: '🎯' },
] as const;

const GOAL_ICONS: Record<string, string> = {
  shield: '🛡️',
  car: '🚗',
  airplane: '✈️',
  book: '📚',
  home: '🏠',
  briefcase: '💼',
};

function ProgressBar({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <View
      style={{
        height: 8,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={[color, color + 'BB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${pct}%`, height: '100%', borderRadius: 4 }}
      />
    </View>
  );
}

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { goals: localGoals, streak, addGoal } = useApp();
  const goalsQuery = useGoals();
  const isAuthenticated = goalsQuery.hasSession;
  const goals = isAuthenticated ? (goalsQuery.data ?? []) : localGoals;
  const { t, isRTL } = useLocalization();
  const textAlign = isRTL ? 'right' : 'left';
  const [showAdd, setShowAdd] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);

  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;
  const botPad = insets.bottom + 40;
  const parsedTarget = Number(newGoalTarget.replace(/,/g, ''));
  const canAddGoal =
    newGoalTitle.trim().length > 0 &&
    Number.isFinite(parsedTarget) &&
    parsedTarget > 0;
  const isSavingGoal = goalsQuery.createGoal.isPending;

  const totalSaved = goals.reduce((sum, g) => sum + g.current, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.target, 0);
  const overallPct =
    totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0;

  const closeAddModal = (afterSave = false) => {
    if (isSavingGoal && !afterSave) return;
    Keyboard.dismiss();
    setShowAdd(false);
    setNewGoalTitle('');
    setNewGoalTarget('');
    setSelectedPreset(0);
    if (!afterSave) goalsQuery.createGoal.reset();
  };

  const saveGoal = () => {
    if (!canAddGoal) return;
    Keyboard.dismiss();
    const preset = GOAL_PRESETS[selectedPreset];
    if (isAuthenticated) {
      goalsQuery.createGoal.mutate(
        {
          name: newGoalTitle.trim(),
          targetAmount: parsedTarget,
          presetId: preset.id,
        },
        {
          onSuccess: () => {
            closeAddModal(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      );
      return;
    }

    addGoal({
      title: newGoalTitle.trim(),
      target: parsedTarget,
      current: 0,
      icon: preset.icon,
      deadline: 'Dec 2026',
      color: preset.color,
    });
    closeAddModal();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad }}
      >
        <LinearGradient
          colors={['#0B1026', '#1A1040', '#2E3192']}
          style={[styles.header, { paddingTop: topPad + 16 }]}
        >
          <Text style={[styles.headerTitle, { textAlign }]}>{t('goals.title')}</Text>
          <Text style={[styles.headerSub, { textAlign }]}>
            {t('Build your financial future, one goal at a time')}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>{t('goals.dayStreak')}</Text>
            </View>
            <View style={[styles.statCard, styles.statCardMain]}>
              <Text style={styles.statValue}>{overallPct}%</Text>
              <Text style={styles.statLabel}>{t('goals.totalProgress')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{goals.length}</Text>
              <Text style={styles.statLabel}>{t('goals.active')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <View style={styles.summaryRow}>
              <View>
                <Text
                  style={[styles.summaryAmount, { color: colors.foreground, textAlign }]}
                >
                  {totalSaved.toLocaleString()} EGP
                </Text>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.mutedForeground, textAlign },
                  ]}
                >
                  {t('goals.savedOfTotal', { amount: `${totalTarget.toLocaleString()} EGP` })}
                </Text>
              </View>
              <View style={[styles.pctBadge, { backgroundColor: '#2E319215' }]}>
                <Text style={styles.pctText}>{overallPct}%</Text>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <ProgressBar
                value={totalSaved}
                total={totalTarget}
                color="#2E3192"
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign }]}>
            {t('goals.active')}
          </Text>

          {isAuthenticated && goalsQuery.isPending ? (
            <ActivityIndicator
              accessibilityLabel={t('common.loading')}
              color={colors.primary}
              style={styles.listStatus}
            />
          ) : isAuthenticated && goalsQuery.isError ? (
            <View style={[styles.listStatusCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.listStatusText, { color: colors.mutedForeground }]}>
                {t(
                  goalsQuery.isFinancialProfileMissing
                    ? 'goals.profileRequired'
                    : 'goals.loadError',
                )}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void goalsQuery.refetch()}
                style={styles.retryButton}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>
                  {t('common.retry')}
                </Text>
              </Pressable>
            </View>
          ) : goals.length === 0 ? (
            <Text style={[styles.listStatusText, { color: colors.mutedForeground }]}>
              {t('goals.empty')}
            </Text>
          ) : goals.map((g) => {
            const pct = g.target > 0 ? Math.min(Math.round((g.current / g.target) * 100), 100) : 0;
            const remaining = Math.max(g.target - g.current, 0);
            const goalEmoji =
              'emoji' in g && typeof g.emoji === 'string'
                ? g.emoji
                : GOAL_ICONS[g.icon] ?? '🎯';
            return (
              <View
                key={g.id}
                style={[styles.goalCard, { backgroundColor: colors.card }]}
              >
                <View style={styles.goalHeader}>
                  <View
                    style={[
                      styles.goalIconWrap,
                      { backgroundColor: g.color + '20' },
                    ]}
                  >
                    <Text style={styles.goalEmoji}>
                      {goalEmoji}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.goalTitle, { color: colors.foreground, textAlign }]}
                    >
                      {t(({ '1': 'data.emergencyFund', '2': 'data.newCar', '3': 'data.travelFund', '4': 'data.education' } as Record<string, string>)[g.id] ?? g.title)}
                    </Text>
                    <Text
                      style={[
                        styles.goalDeadline,
                        { color: colors.mutedForeground, textAlign },
                      ]}
                    >
                      {t('goals.target', { date: t(({ 'Dec 2025': 'data.dec2025', 'Jun 2026': 'data.jun2026', 'Mar 2026': 'data.mar2026', 'Sep 2026': 'data.sep2026' } as Record<string, string>)[g.deadline] ?? g.deadline) })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.goalPct,
                      { backgroundColor: g.color + '20' },
                    ]}
                  >
                    <Text style={[styles.goalPctText, { color: g.color }]}>
                      {pct}%
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 12, marginBottom: 10 }}>
                  <ProgressBar
                    value={g.current}
                    total={g.target}
                    color={g.color}
                  />
                </View>
                <View style={styles.goalAmtRow}>
                  <Text style={[styles.goalAmt, { color: colors.foreground, textAlign }]}>
                    {g.current.toLocaleString()} EGP
                  </Text>
                  <Text
                    style={[
                      styles.goalRemaining,
                      { color: colors.mutedForeground, textAlign },
                    ]}
                  >
                    {remaining.toLocaleString()} EGP {t('remaining to go')}
                  </Text>
                </View>
              </View>
            );
          })}

          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign }]}>
            {t('Achievements')}
          </Text>
          <View style={styles.achievementsGrid}>
            {ACHIEVEMENTS.map((a) => (
              <View
                key={a.id}
                style={[
                  styles.achieveCard,
                  { backgroundColor: colors.card },
                  !a.unlocked && { opacity: 0.45 },
                ]}
              >
                <View
                  style={[
                    styles.achieveIcon,
                    { backgroundColor: a.color + '20' },
                  ]}
                >
                  <Feather
                    name={a.icon as any}
                    size={20}
                    color={a.unlocked ? a.color : colors.mutedForeground}
                  />
                </View>
                <Text
                  style={[styles.achieveLabel, { color: colors.foreground, textAlign }]}
                >
                  {t(a.label)}
                </Text>
                <Text
                  style={[
                    styles.achieveDesc,
                    { color: colors.mutedForeground, textAlign },
                  ]}
                >
                  {t(a.desc)}
                </Text>
                {a.unlocked && (
                  <View
                    style={[styles.unlockedBadge, { backgroundColor: a.color }]}
                  >
                    <Text style={styles.unlockedText}>✓</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <LinearGradient
            colors={['#2E3192', '#92278F', '#F37021']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.challengeCard}
          >
            <View style={styles.challengeRow}>
              <Feather name="flag" size={22} color="rgba(255,255,255,0.8)" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.challengeTitle, { textAlign }]}>{t("This Week's Challenge")}</Text>
                <Text style={[styles.challengeText, { textAlign }]}>
                  {t('Skip 3 impulse purchases and add the savings to your Emergency Fund.')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.challengeStep,
                        i === 1 && styles.challengeStepDone,
                      ]}
                    >
                      <Feather
                        name={i === 1 ? 'check' : 'circle'}
                        size={12}
                        color={i === 1 ? '#22C55E' : 'rgba(255,255,255,0.5)'}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: botPad + 20 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          goalsQuery.createGoal.reset();
          setShowAdd(true);
        }}
      >
        <LinearGradient colors={['#2E3192', '#92278F']} style={styles.fabGrad}>
          <Feather name="plus" size={26} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => closeAddModal()}
      >
        <View style={{ flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}>
          <Pressable
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.55)' },
            ]}
            onPress={() => closeAddModal()}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKav}
          >
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View
                style={[styles.handle, { backgroundColor: colors.border }]}
              />
              <Text style={[styles.modalTitle, { color: colors.foreground, textAlign }]}>
                {t('goals.new')}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.presetsScroll}
                contentContainerStyle={styles.presetsRow}
              >
                {GOAL_PRESETS.map((p, i) => (
                  <Pressable
                    key={p.icon}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor:
                          i === selectedPreset
                            ? p.color + '25'
                            : colors.secondary,
                        borderColor:
                          i === selectedPreset ? p.color : colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedPreset(i);
                    }}
                  >
                    <Text style={styles.presetEmoji}>{p.emoji}</Text>
                    <Text
                      style={[
                        styles.presetLabel,
                        {
                          color:
                            i === selectedPreset
                              ? p.color
                              : colors.mutedForeground,
                          textAlign,
                        },
                      ]}
                    >
                      {t(p.label)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    textAlign,
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                ]}
                placeholder={t('goals.goalName')}
                placeholderTextColor={colors.mutedForeground}
                value={newGoalTitle}
                onChangeText={setNewGoalTitle}
                returnKeyType="next"
              />
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                    textAlign: 'left',
                    writingDirection: 'ltr',
                  },
                ]}
                placeholder={t('goals.targetAmount')}
                placeholderTextColor={colors.mutedForeground}
                value={newGoalTarget}
                onChangeText={setNewGoalTarget}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalCancel, { borderColor: colors.border }]}
                  onPress={() => {
                    closeAddModal();
                  }}
                >
                  <Text
                    style={[
                      styles.modalCancelText,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalConfirm,
                    { opacity: canAddGoal && !isSavingGoal ? 1 : 0.4 },
                  ]}
                  disabled={!canAddGoal || isSavingGoal}
                  onPress={saveGoal}
                >
                  <LinearGradient
                    colors={['#2E3192', '#92278F']}
                    style={styles.modalConfirmGrad}
                  >
                    <Text style={styles.modalConfirmText}>
                      {isSavingGoal ? t('common.saving') : t('goals.addGoal')}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
              {goalsQuery.createGoal.isError && (
                <Text accessibilityRole="alert" style={styles.saveError}>
                  {t(
                    goalsQuery.isCreateProfileMissing
                      ? 'goals.profileRequired'
                      : 'goals.saveError',
                  )}
                </Text>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  headerSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
    marginBottom: 20,
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statCardMain: {
    backgroundColor: 'rgba(243,112,33,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(243,112,33,0.4)',
  },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
    textAlign: 'center',
  },
  body: { padding: 16, gap: 8 },
  summaryCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listStatus: { marginVertical: 20 },
  listStatusCard: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  listStatusText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginVertical: 12,
  },
  retryButton: { padding: 8 },
  retryText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  saveError: {
    color: '#EF4444',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryAmount: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 3 },
  pctBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  pctText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#2E3192' },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginTop: 8,
    marginBottom: 4,
  },
  goalCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalEmoji: { fontSize: 24 },
  goalTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  goalDeadline: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 3 },
  goalPct: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  goalPctText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  goalAmtRow: { flexDirection: 'row', justifyContent: 'space-between' },
  goalAmt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  goalRemaining: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achieveCard: {
    width: '47%',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  achieveIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achieveLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  achieveDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 16,
  },
  unlockedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockedText: { fontSize: 10, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  challengeCard: { borderRadius: 20, padding: 20, marginTop: 4 },
  challengeRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  challengeTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  challengeText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  challengeStep: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeStepDone: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.2)',
  },
  fab: { position: 'absolute', right: 20 },
  fabGrad: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E3192',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  modalKav: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    gap: 14,
  },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  presetsScroll: { marginHorizontal: -4 },
  presetsRow: { gap: 8, paddingHorizontal: 4 },
  presetChip: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 64,
  },
  presetEmoji: { fontSize: 20 },
  presetLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  modalInput: {
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancel: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  modalConfirm: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  modalConfirmGrad: { paddingVertical: 14, alignItems: 'center' },
  modalConfirmText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
});
