import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { CircularProgress } from '@/components/CircularProgress';
import { EfiBarChart } from '@/components/EfiBarChart';
import { ForecastCoachWidget } from '@/components/ForecastCoachWidget';
import { InsightAssistant } from '@/components/InsightAssistant';
import { useProfile } from '@/hooks/useProfile';
import { useColors } from '@/hooks/useColors';
import { useLocalization } from '@/localization';

const EFI_DIMENSIONS = [
  { key: 'insights.awareness', value: 72 },
  { key: 'insights.confidence', value: 75 },
  { key: 'insights.impulseControl', value: 58 },
  { key: 'insights.stressManagement', value: 64 },
  { key: 'insights.planning', value: 80 },
];

const MONTHLY_DATA = [
  { month: 'Jan', savings: 1200, spending: 8400 },
  { month: 'Feb', savings: 1500, spending: 7900 },
  { month: 'Mar', savings: 900, spending: 9100 },
  { month: 'Apr', savings: 2100, spending: 7500 },
  { month: 'May', savings: 1800, spending: 7800 },
  { month: 'Jun', savings: 2400, spending: 7200 },
];

const ANOMALIES = [
  {
    id: '1',
    title: 'Unusual shopping spike',
    descKey: 'insights.exampleShoppingAnomaly',
    risk: 'medium',
    icon: 'shopping-bag',
  },
  {
    id: '2',
    title: 'Weekend dining pattern',
    descKey: 'insights.exampleDiningAnomaly',
    risk: 'low',
    icon: 'coffee',
  },
  {
    id: '3',
    title: 'Subscription waste detected',
    descKey: 'insights.exampleSubscriptionAnomaly',
    risk: 'low',
    icon: 'credit-card',
  },
];

const NUDGES = [
  {
    id: '1',
    icon: 'trending-up',
    color: '#22C55E',
    title: 'Savings opportunity',
    textKey: 'insights.exampleSavingsNudge',
  },
  {
    id: '2',
    icon: 'alert-triangle',
    color: '#F59E0B',
    title: 'Cooling-off reminder',
    textKey: 'insights.exampleCoolingNudge',
  },
  {
    id: '3',
    icon: 'award',
    color: '#2E3192',
    title: 'Milestone reached',
    textKey: 'insights.exampleMilestoneNudge',
  },
];

type TabKey = 'efi' | 'forecast' | 'nudges' | 'anomalies';
const TRUSTED_ANOMALY_PREFIX = '@bassera_trusted_sample_anomaly_v1_';

function SpendingBar({
  item,
  maxVal,
  monthLabel,
}: {
  item: (typeof MONTHLY_DATA)[0];
  maxVal: number;
  monthLabel: string;
}) {
  const barH = 80;
  const savH = Math.round((item.savings / maxVal) * barH);
  const spH = Math.round((item.spending / maxVal) * barH);
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 2,
          height: barH,
        }}
      >
        <View
          style={{
            width: 8,
            height: savH,
            backgroundColor: '#22C55E',
            borderRadius: 2,
          }}
        />
        <View
          style={{
            width: 8,
            height: spH,
            backgroundColor: '#2E3192',
            borderRadius: 2,
            opacity: 0.5,
          }}
        />
      </View>
      <Text
        style={{
          fontSize: 10,
          color: '#64748B',
          fontFamily: 'Inter_400Regular',
        }}
      >
        {monthLabel}
      </Text>
    </View>
  );
}

export default function InsightsScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const summarySize = width < 360 ? 66 : 80;
  const router = useRouter();
  const { section, coach } = useLocalSearchParams<{ section?: string; coach?: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { t, isRTL } = useLocalization();
  const textAlign = isRTL ? 'right' : 'left';
  const [activeTab, setActiveTab] = useState<TabKey>(
    section === 'forecast' || section === 'nudges' || section === 'anomalies' ? section : 'efi',
  );
  const [trustedIds, setTrustedIds] = useState<string[]>([]);
  const [pendingTrustedIds, setPendingTrustedIds] = useState<string[]>([]);
  const [trustLoaded, setTrustLoaded] = useState(false);
  const [trustError, setTrustError] = useState(false);
  const [savingTrustId, setSavingTrustId] = useState<string | null>(null);
  const trustTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let active = true;
    Promise.all(ANOMALIES.map(async (item) => {
      const value = await AsyncStorage.getItem(TRUSTED_ANOMALY_PREFIX + item.id);
      return value === 'yes' ? item.id : null;
    }))
      .then((values) => {
        if (active) setTrustedIds(values.filter((id): id is string => id !== null));
      })
      .catch(() => { if (active) setTrustError(true); })
      .finally(() => { if (active) setTrustLoaded(true); });
    return () => {
      active = false;
      trustTimers.current.forEach((timer) => clearTimeout(timer));
      trustTimers.current.clear();
    };
  }, []);

  const trustAnomaly = async (id: string) => {
    if (savingTrustId || trustError || trustedIds.includes(id)) return;
    setSavingTrustId(id);
    try {
      await AsyncStorage.setItem(TRUSTED_ANOMALY_PREFIX + id, 'yes');
      setTrustedIds((previous) => [...previous, id]);
      setPendingTrustedIds((previous) => [...previous, id]);
      const timer = setTimeout(() => {
        setPendingTrustedIds((previous) => previous.filter((value) => value !== id));
        trustTimers.current.delete(id);
      }, 5000);
      trustTimers.current.set(id, timer);
    } catch {
      setTrustError(true);
    } finally {
      setSavingTrustId(null);
    }
  };

  const undoTrust = async (id: string) => {
    if (savingTrustId) return;
    setSavingTrustId(id);
    try {
      await AsyncStorage.removeItem(TRUSTED_ANOMALY_PREFIX + id);
      const timer = trustTimers.current.get(id);
      if (timer) clearTimeout(timer);
      trustTimers.current.delete(id);
      setTrustedIds((previous) => previous.filter((value) => value !== id));
      setPendingTrustedIds((previous) => previous.filter((value) => value !== id));
    } catch {
      setTrustError(true);
    } finally {
      setSavingTrustId(null);
    }
  };

  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;

  const bottomPad = insets.bottom + (Platform.OS === 'android' ? 96 : 60);
  const maxBarVal = Math.max(
    ...MONTHLY_DATA.flatMap((d) => [d.savings, d.spending]),
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'efi', label: 'EFI' },
    { key: 'forecast', label: t('insights.forecast') },
    { key: 'nudges', label: t('insights.nudges') },
    { key: 'anomalies', label: t('insights.anomalies') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPad }}
    >
      <LinearGradient
        colors={['#0B1026', '#1A1040', '#2E3192']}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.headerTitle, { textAlign }]}>{t('insights.title')}</Text>
        <Text style={[styles.headerSub, { textAlign }]}>{t('insights.subtitle')}</Text>

        <View style={styles.scoreRow}>
          <View style={styles.headerScoreCard}>
            <CircularProgress
              value={profile.efiScore}
              size={summarySize}
              strokeWidth={7}
              colors={['#92278F', '#F37021', '#F37021']}
              valueColor="#FFFFFF"
              trackColor="rgba(255,255,255,0.15)"
            />
            <Text style={styles.headerScoreLabel}>{t('insights.efi')}</Text>
          </View>
          <View style={styles.headerScoreCard}>
            <CircularProgress
              value={profile.wellnessScore}
              size={summarySize}
              strokeWidth={7}
              colors={['#2E3192', '#92278F', '#92278F']}
              valueColor="#FFFFFF"
              trackColor="rgba(255,255,255,0.15)"
            />
            <Text style={styles.headerScoreLabel}>{t('home.wellnessScore')}</Text>
          </View>
          <View style={styles.headerScoreCard}>
            <CircularProgress
              value={profile.confidenceScore}
              size={summarySize}
              strokeWidth={7}
              colors={['#22C55E', '#2E3192', '#2E3192']}
              valueColor="#FFFFFF"
              trackColor="rgba(255,255,255,0.15)"
            />
            <Text style={styles.headerScoreLabel}>{t('insights.confidence')}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            testID={`insights-tab-${tab.key}`}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === tab.key ? '#2E3192' : colors.mutedForeground,
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {activeTab === 'efi' && (
          <>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground, textAlign }]}>
                {t('insights.emotionalIntelligence')}
              </Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground, textAlign }]}>
                {t('insights.dimensionsGlance')}
              </Text>
              <EfiBarChart
                title={t('insights.dimensionBreakdown')}
                outOfLabel={t('insights.outOf100')}
                dimensions={EFI_DIMENSIONS.map((dimension, index) => ({
                  label: t(dimension.key).replace('\n', ' '),
                  value: dimension.value,
                  color: [colors.indigo, colors.purple, colors.orange, colors.success, colors.warning][index],
                }))}
              />
            </View>

            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground, textAlign }]}>
                {t('Risk Indicators')}
              </Text>
              {[
                {
                  label: 'Anxiety Index',
                  value: 32,
                  color: '#EF4444',
                  desc: 'Low — within healthy range',
                },
                {
                  label: 'Spending Trigger Index',
                  value: 58,
                  color: '#F59E0B',
                  desc: 'Moderate — monitor weekend patterns',
                },
                {
                  label: 'Emotional Stability',
                  value: 74,
                  color: '#22C55E',
                  desc: 'Good — consistent over 30 days',
                },
              ].map((r) => (
                <View
                  key={r.label}
                  style={[styles.riskRow, { borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.riskLabel, { color: colors.foreground, textAlign }]}
                    >
                      {t(r.label)}
                    </Text>
                    <Text
                      style={[
                        styles.riskDesc,
                        { color: colors.mutedForeground, textAlign },
                      ]}
                    >
                      {t(r.desc)}
                    </Text>
                  </View>
                  <Text style={[styles.riskValue, { color: r.color, textAlign }]}>
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'forecast' && (
          <>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground, textAlign }]}>
                {t('insights.monthlyOverview')}
              </Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground, textAlign }]}>
                {t('insights.savingsVsSpending')}
              </Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground, textAlign }]}>
                {t('insights.forecastSampleNote')}
              </Text>
              <View style={styles.chartRow}>
                {MONTHLY_DATA.map((d) => (
                  <SpendingBar key={d.month} item={d} maxVal={maxBarVal} monthLabel={t(`month.${d.month}`)} />
                ))}
              </View>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: '#22C55E' }]}
                  />
                  <Text
                    style={[
                      styles.legendText,
                      { color: colors.mutedForeground, textAlign },
                    ]}
                  >
                    {t('insights.savings')}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: '#2E3192', opacity: 0.5 },
                    ]}
                  />
                  <Text
                    style={[
                      styles.legendText,
                      { color: colors.mutedForeground, textAlign },
                    ]}
                  >
                    {t('insights.spending')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground, textAlign }]}>
                {t('insights.exampleEstimates')}
              </Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground, textAlign }]}>
                {t('insights.estimateNote')}
              </Text>
              {[
                {
                  cat: 'Food & Drink',
                  predicted: 2800,
                  icon: 'coffee',
                  color: '#F37021',
                },
                {
                  cat: 'Shopping',
                  predicted: 1600,
                  icon: 'shopping-bag',
                  color: '#92278F',
                },
                {
                  cat: 'Transport',
                  predicted: 750,
                  icon: 'map-pin',
                  color: '#2E3192',
                },
                {
                  cat: 'Bills',
                  predicted: 1200,
                  icon: 'zap',
                  color: '#22C55E',
                },
              ].map((p) => (
                <View key={p.cat} style={styles.predRow}>
                  <View
                    style={[
                      styles.predIcon,
                      { backgroundColor: p.color + '20' },
                    ]}
                  >
                    <Feather name={p.icon as any} size={16} color={p.color} />
                  </View>
                  <Text style={[styles.predCat, { color: colors.foreground, textAlign }]}>
                    {t(p.cat)}
                  </Text>
                  <Text
                    style={[styles.predVal, { color: colors.mutedForeground, textAlign }]}
                  >
                    {p.predicted.toLocaleString()} EGP
                  </Text>
                </View>
              ))}
            </View>

            <LinearGradient
              colors={['#2E3192', '#92278F']}
              style={styles.savingOpCard}
            >
              <Feather
                name="dollar-sign"
                size={24}
                color="rgba(255,255,255,0.8)"
                style={{ marginBottom: 8 }}
              />
              <Text style={[styles.savingOpTitle, { textAlign }]}>{t('insights.savingsOpportunity')}</Text>
              <Text style={[styles.savingOpText, { textAlign }]}>
                {t('insights.forecastTip')}
              </Text>
            </LinearGradient>
          </>
        )}

        {activeTab === 'nudges' && (
          <>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground, textAlign }]}>
                {t('profile.smartNudges')}
              </Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground, textAlign }]}>
                {t('insights.exampleNudgesNotice')}
              </Text>
            </View>
            {NUDGES.map((n) => (
              <View
                key={n.id}
                style={[
                  styles.nudgeCard,
                  { backgroundColor: colors.card, borderLeftColor: n.color },
                ]}
              >
                <View
                  style={[
                    styles.nudgeIcon,
                    { backgroundColor: n.color + '20' },
                  ]}
                >
                  <Feather name={n.icon as any} size={18} color={n.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.nudgeTitle, { color: colors.foreground, textAlign }]}
                  >
                    {t(n.title)}
                  </Text>
                  <Text
                    style={[
                      styles.nudgeText,
                      { color: colors.mutedForeground, textAlign },
                    ]}
                  >
                    {t(n.textKey)}
                  </Text>
                  <InsightAssistant
                    kind="nudge"
                    id={n.id}
                    title={t(n.title)}
                    description={t(n.textKey)}
                  />
                </View>
              </View>
            ))}
          </>
        )}

        {activeTab === 'anomalies' && (
          <>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground, textAlign }]}>
                {t('insights.anomalies')}
              </Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground, textAlign }]}>
                {t('insights.exampleAnomaliesNotice')}
              </Text>
              {trustError ? (
                <Text style={[styles.cardSub, { color: colors.destructive, textAlign }]}>
                  {t('insights.trustStorageError')}
                </Text>
              ) : null}
            </View>
            {!trustLoaded ? <ActivityIndicator color={colors.primary} /> : null}
            {trustLoaded && ANOMALIES.filter((a) =>
              !trustedIds.includes(a.id) || pendingTrustedIds.includes(a.id),
            ).map((a) => (
              <View
                key={a.id}
                style={[styles.anomalyCard, { backgroundColor: colors.card }]}
              >
                <View style={styles.anomalyHeader}>
                  <View
                    style={[
                      styles.anomalyIcon,
                      {
                        backgroundColor:
                          a.risk === 'medium' ? '#F59E0B20' : '#22C55E20',
                      },
                    ]}
                  >
                    <Feather
                      name={a.icon as any}
                      size={18}
                      color={a.risk === 'medium' ? '#F59E0B' : '#22C55E'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.anomalyTitle,
                        { color: colors.foreground, textAlign },
                      ]}
                    >
                      {t(a.title)}
                    </Text>
                    <Text
                      style={[
                        styles.anomalyDesc,
                        { color: colors.mutedForeground, textAlign },
                      ]}
                    >
                        {t(a.descKey)}
                    </Text>
                  </View>
                </View>
                <InsightAssistant
                  kind="anomaly"
                  id={a.id}
                  title={t(a.title)}
                  description={t(a.descKey)}
                />
                <View style={styles.anomalyFooter}>
                  {pendingTrustedIds.includes(a.id) ? (
                    <Text style={[styles.pendingText, { color: colors.mutedForeground, textAlign }]}>
                      {t('insights.hidingSoon')}
                    </Text>
                  ) : <View style={{ flex: 1 }} />}
                  <Pressable
                    accessibilityRole="button"
                    testID={`trust-anomaly-${a.id}`}
                    disabled={!!savingTrustId || trustError}
                    onPress={() => {
                      if (pendingTrustedIds.includes(a.id)) void undoTrust(a.id);
                      else void trustAnomaly(a.id);
                    }}
                    style={({ pressed }) => [
                      styles.anomalyBtn,
                      { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather
                      name={pendingTrustedIds.includes(a.id) ? 'rotate-ccw' : 'check-circle'}
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={[styles.anomalyBtnText, { color: colors.primary, textAlign }]}>
                      {pendingTrustedIds.includes(a.id) ? t('insights.undo') : t('insights.trustThis')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {trustLoaded && ANOMALIES.every((a) =>
              trustedIds.includes(a.id) && !pendingTrustedIds.includes(a.id),
            ) ? (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <Text style={[styles.cardSub, { color: colors.mutedForeground, textAlign }]}>
                  {t('insights.noExampleAnomalies')}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
    {activeTab === 'forecast' ? (
      <ForecastCoachWidget
        initialOpen={coach === 'open'}
        onContinue={(question) =>
          router.navigate({
            pathname: '/(tabs)/coach',
            params: {
              forecastQuestion: question ?? 'intro',
              forecastRequest: `${Date.now()}-${Math.random()}`,
            },
          })
        }
      />
    ) : null}
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
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between' },
  headerScoreCard: { alignItems: 'center', gap: 8, width: '32%' },
  headerScoreLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: '#2E319215' },
  tabText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  body: { padding: 16, gap: 12 },
  card: {
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  riskLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  riskDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  riskValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 12,
  },
  legendRow: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  predRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  predIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predCat: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  predVal: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  savingOpCard: { borderRadius: 20, padding: 20 },
  savingOpTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  savingOpText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 21,
  },
  nudgeCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderLeftWidth: 3,
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
  nudgeTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  nudgeText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  anomalyCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  anomalyHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  anomalyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anomalyTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  anomalyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  anomalyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  pendingText: { fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1 },
  anomalyBtn: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  anomalyBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
