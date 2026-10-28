import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAppStore } from '@/stores/appStore';
import { useLocalization } from '@/localization';
import { IdentityAuthForm } from '@/components/IdentityAuthForm';
import { useMobileLogin } from '@/hooks/useMobileLogin';
import { useConsumerSession } from '@/hooks/useConsumerSession';
import { markSurveyComplete } from '@/stores/authStore';
import { useConsumerProfileUpdate } from '@/hooks/useConsumerProfileUpdate';
import { useMoneyAttitudeQuestionnaire } from '@/hooks/useMoneyAttitudeQuestionnaire';
import { authErrorMessage } from '@/utils/authErrors';
import {
  localize,
  orderedQuestions,
  questionOptions,
  scoreQuestionnaire,
  type QuestionnaireResult,
  type ScoreBand,
} from '@/utils/questionnaireScoring';

const { width, height } = Dimensions.get('window');

const SLOGAN_WORDS = [
  'Understand',
  'your',
  'money',
  'by',
  'understanding',
  'yourself',
];

const PARTICLES = [
  { top: '12%', left: '8%', size: 4, opacity: 0.35 },
  { top: '18%', right: '12%', size: 3, opacity: 0.25 },
  { top: '28%', left: '18%', size: 2, opacity: 0.2 },
  { top: '72%', left: '10%', size: 3, opacity: 0.3 },
  { top: '68%', right: '8%', size: 4, opacity: 0.25 },
  { top: '80%', left: '22%', size: 2, opacity: 0.2 },
  { top: '60%', right: '20%', size: 3, opacity: 0.2 },
  { top: '38%', right: '6%', size: 2, opacity: 0.3 },
];

const SLIDES = [
  {
    id: '1',
    title: 'Understand Your\nMoney Personality',
    subtitle:
      'Discover why you spend, save, and make financial decisions the way you do.',
    image: require('@/assets/images/onboarding1.png'),
  },
  {
    id: '2',
    title: 'Track Your Emotional\nFinancial Intelligence',
    subtitle:
      'Understand the emotions behind your financial behavior and decisions.',
    image: require('@/assets/images/onboarding2.png'),
  },
  {
    id: '3',
    title: 'Meet Your AI\nFinancial Coach',
    subtitle:
      'Receive personalized coaching, insights, and recommendations — 24/7.',
    image: require('@/assets/images/onboarding1.png'),
  },
  {
    id: '4',
    title: 'Build Better\nFinancial Habits',
    subtitle:
      'Develop saving habits and long-term financial confidence, one day at a time.',
    image: require('@/assets/images/onboarding2.png'),
  },
];

const DIMENSION_COLORS = ['#2E3192', '#F37021', '#92278F', '#22C55E', '#F59E0B'];

const BAND_COLORS: Record<ScoreBand, string> = {
  high: '#22C55E',
  moderate: '#F59E0B',
  low: '#4A90E2',
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const { t, language } = useLocalization();
  const auth = useMobileLogin();
  const { data: consumer, isAuthenticated } = useConsumerSession();
  const profileUpdate = useConsumerProfileUpdate();

  const [phase, setPhase] = useState<
    'splash' | 'slides' | 'auth' | 'name' | 'assessment' | 'result'
  >(isAuthenticated ? 'name' : auth.stage === 'profile' ? 'auth' : 'splash');
  const [slideIndex, setSlideIndex] = useState(0);
  const [userName, setUserName] = useState(consumer?.name ?? '');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuestionnaireResult | null>(null);
  const [finishing, setFinishing] = useState(false);
  const questionnaire = useMoneyAttitudeQuestionnaire(
    phase === 'name' || phase === 'assessment',
  );
  const questions = useMemo(
    () => (questionnaire.data ? orderedQuestions(questionnaire.data) : []),
    [questionnaire.data],
  );
  const [visibleWords, setVisibleWords] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const iconScale = useRef(new Animated.Value(0.35)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.45)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.22)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== 'splash') return;

    iconScale.setValue(0.35);
    iconOpacity.setValue(0);
    ring1Scale.setValue(1);
    ring1Opacity.setValue(0.45);
    ring2Scale.setValue(1);
    ring2Opacity.setValue(0.22);
    titleOpacity.setValue(0);
    titleY.setValue(20);
    sloganOpacity.setValue(0);
    setVisibleWords(0);

    Animated.loop(
      Animated.sequence([
        Animated.timing(ring1Scale, {
          toValue: 1.75,
          duration: 1900,
          useNativeDriver: false,
        }),
        Animated.timing(ring1Scale, {
          toValue: 1,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(ring1Opacity, {
          toValue: 0,
          duration: 1900,
          useNativeDriver: false,
        }),
        Animated.timing(ring1Opacity, {
          toValue: 0.4,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    ).start();

    const r2 = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring2Scale, {
            toValue: 1.75,
            duration: 1900,
            useNativeDriver: false,
          }),
          Animated.timing(ring2Scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: false,
          }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: 1900,
            useNativeDriver: false,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0.2,
            duration: 0,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    }, 950);

    const iconT = setTimeout(() => {
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: false,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
      ]).start();
    }, 180);

    const titleT = setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start();
    }, 720);

    const sloganT = setTimeout(() => {
      Animated.timing(sloganOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }, 1280);

    const wordTimers: ReturnType<typeof setTimeout>[] = [];
    SLOGAN_WORDS.forEach((_, i) => {
      wordTimers.push(setTimeout(() => setVisibleWords(i + 1), 1380 + i * 230));
    });

    const totalMs = 1380 + SLOGAN_WORDS.length * 230 + 1500;
    const advanceT = setTimeout(() => {
      fadeTransition(() => setPhase('slides'));
    }, totalMs);

    return () => {
      clearTimeout(r2);
      clearTimeout(iconT);
      clearTimeout(titleT);
      clearTimeout(sloganT);
      wordTimers.forEach(clearTimeout);
      clearTimeout(advanceT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const fadeTransition = (fn: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      fn();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleSlideNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (slideIndex < SLIDES.length - 1) {
      const next = slideIndex + 1;
      setSlideIndex(next);
      flatRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      fadeTransition(() => setPhase('auth'));
    }
  };

  const handleNameNext = async () => {
    if (!userName.trim() || profileUpdate.isPending) return;
    try {
      if (userName.trim() !== consumer?.name?.trim()) await profileUpdate.update({ name: userName.trim() });
    } catch (error) {
      // Remain on the name step; never claim an unsaved name was persisted.
      const message = authErrorMessage(error, language);
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert(t('onboarding.nameTitle'), message);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fadeTransition(() => setPhase('assessment'));
  };

  const handleAnswer = (value: number) => {
    const data = questionnaire.data;
    const question = questions[questionIndex];
    if (!data || !question) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);

    if (questionIndex < questions.length - 1) {
      fadeTransition(() => setQuestionIndex((i) => i + 1));
    } else {
      setResult(scoreQuestionnaire(data, nextAnswers));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fadeTransition(() => setPhase('result'));
    }
  };

  const handleBack = () => {
    if (questionIndex === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fadeTransition(() => setQuestionIndex((i) => i - 1));
  };

  const handleFinish = async () => {
    if (!result || finishing) return;
    setFinishing(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      completeOnboarding(null, result);
      await markSurveyComplete();
      router.replace('/');
    } finally {
      setFinishing(false);
    }
  };

  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (phase === 'splash') {
    return (
      <Pressable
        style={{ flex: 1 }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          fadeTransition(() => setPhase('slides'));
        }}
      >
        <Animated.View style={[styles.fill, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={['#020919', '#0B1026', '#0C0B34']}
            style={[styles.fill, styles.splashCenter, { paddingTop: topPad }]}
          >
            {PARTICLES.map((p, i) => (
              <View
                key={i}
                style={[
                  styles.particle,
                  {
                    width: p.size,
                    height: p.size,
                    borderRadius: p.size / 2,
                    opacity: p.opacity,
                    top: p.top as any,
                    left: (p as any).left,
                    right: (p as any).right,
                  },
                ]}
              />
            ))}

            <View style={styles.splashIconWrap}>
              <Animated.View
                style={[
                  styles.splashRing,
                  {
                    transform: [{ scale: ring1Scale }],
                    opacity: ring1Opacity,
                    borderColor: '#2E3192',
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.splashRing,
                  styles.splashRingOuter,
                  {
                    transform: [{ scale: ring2Scale }],
                    opacity: ring2Opacity,
                    borderColor: '#92278F',
                  },
                ]}
              />

              <Animated.View
                style={{
                  opacity: iconOpacity,
                  transform: [{ scale: iconScale }],
                  alignItems: 'center',
                }}
              >
                <LinearGradient
                  colors={['#2E3192', '#6B1FB0', '#92278F']}
                  style={styles.splashIconCircle}
                >
                  <Image
                    source={require('@/assets/images/icon.png')}
                    style={styles.splashIconImg}
                    resizeMode="cover"
                  />
                </LinearGradient>
              </Animated.View>
            </View>

            <Animated.View
              style={{
                opacity: titleOpacity,
                transform: [{ translateY: titleY }],
                alignItems: 'center',
                marginTop: 28,
              }}
            >
              <View style={styles.splashTitleRow}>
                <Text style={styles.splashBrand}>Bassera بصيرة</Text>
                <LinearGradient
                  colors={['#2E3192', '#92278F', '#F37021']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.splashAIBadge}
                >
                  <Text style={styles.splashAIText}>AI</Text>
                </LinearGradient>
              </View>
              <Text style={styles.splashTagline}>{t('Smart Financial Advisory')}</Text>
            </Animated.View>

            <Animated.View
              style={[styles.sloganContainer, { opacity: sloganOpacity }]}
            >
              <View style={styles.sloganRow}>
                {SLOGAN_WORDS.map((word, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.sloganWord,
                      i < visibleWords
                        ? styles.sloganVisible
                        : styles.sloganHidden,
                    ]}
                  >
                    {t(word)}
                    {i < SLOGAN_WORDS.length - 1 ? ' ' : ''}
                  </Text>
                ))}
              </View>
            </Animated.View>

            {visibleWords >= SLOGAN_WORDS.length && (
              <Text style={styles.tapHint}>{t('Tap anywhere to continue')}</Text>
            )}
          </LinearGradient>
        </Animated.View>
      </Pressable>
    );
  }

  if (phase === 'slides') {
    return (
      <LinearGradient
        colors={['#0B1026', '#1A1040', '#2E1855']}
        style={[styles.fill, { paddingTop: topPad }]}
      >
        <FlatList
          ref={flatRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              <Image
                source={item.image}
                style={styles.slideImage}
                resizeMode="contain"
              />
              <Text style={styles.slideTitle}>{t(item.title)}</Text>
              <Text style={styles.slideSubtitle}>{t(item.subtitle)}</Text>
            </View>
          )}
        />

        <View style={[styles.slideDots, { marginBottom: botPad + 20 }]}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === slideIndex && styles.dotActive]}
            />
          ))}
        </View>

        <View style={[styles.slideActions, { paddingBottom: botPad + 16 }]}>
          <Pressable style={styles.nextBtn} onPress={handleSlideNext}>
            <LinearGradient
              colors={['#2E3192', '#92278F', '#F37021']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextBtnGrad}
            >
              <Text style={styles.nextBtnText}>
                {slideIndex === SLIDES.length - 1 ? t('onboarding.getStarted') : t('common.next')}
              </Text>
            </LinearGradient>
          </Pressable>
          {slideIndex < SLIDES.length - 1 && (
            <Pressable
              style={styles.skipBtn}
              onPress={() => {
                setSlideIndex(SLIDES.length - 1);
                flatRef.current?.scrollToIndex({
                  index: SLIDES.length - 1,
                  animated: true,
                });
              }}
            >
              <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>
    );
  }

  if (phase === 'auth') {
    return (
      <LinearGradient
        colors={['#0B1026', '#1A1040', '#2E1855']}
        style={[
          styles.fill,
          { paddingTop: topPad, paddingBottom: botPad + 16 },
        ]}
      >
        <Animated.View style={[styles.fill, { opacity: fadeAnim }]}>
          <IdentityAuthForm auth={auth} />
        </Animated.View>
      </LinearGradient>
    );
  }

  if (phase === 'name') {
    return (
      <LinearGradient
        colors={['#0B1026', '#1A1040', '#2E1855']}
        style={[
          styles.fill,
          { paddingTop: topPad, paddingBottom: botPad + 16 },
        ]}
      >
        <Animated.View style={[styles.center, { opacity: fadeAnim }]}>
          <Text style={styles.assessTitle}>{t('onboarding.nameTitle')}</Text>
          <Text style={styles.assessSubtitle}>
            {t('Bassera will personalize your experience based on your name.')}
          </Text>
          <TextInput
            style={[
              styles.nameInput,
              {
                textAlign: language === 'ar' ? 'right' : 'left',
                writingDirection: language === 'ar' ? 'rtl' : 'ltr',
              },
            ]}
            value={userName}
            testID="onboarding-name"
            editable={!profileUpdate.isPending}
            onChangeText={setUserName}
            placeholder={t('onboarding.namePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleNameNext}
          />
          <Pressable
            style={[
              styles.assessBtn,
              (!userName.trim() || profileUpdate.isPending) && styles.assessBtnDisabled,
            ]}
            onPress={handleNameNext}
            disabled={!userName.trim() || profileUpdate.isPending}
          >
            <LinearGradient
              colors={['#2E3192', '#92278F', '#F37021']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.assessBtnGrad}
            >
              <Text style={styles.assessBtnText}>{profileUpdate.isPending ? t('common.loading') : t('onboarding.continue')}</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    );
  }

  const textAlign = language === 'ar' ? 'right' : 'left';

  if (phase === 'assessment') {
    const q = questions[questionIndex];
    const selected = q ? answers[q.id] : undefined;
    return (
      <LinearGradient
        colors={['#0B1026', '#1A1040', '#2E1855']}
        style={[
          styles.fill,
          { paddingTop: topPad, paddingBottom: botPad + 16 },
        ]}
      >
        <Animated.View style={[styles.assessContainer, { opacity: fadeAnim }]}>
          {!q ? (
            <View style={styles.center}>
              {questionnaire.isError || questionnaire.isSuccess ? (
                <>
                  <Text style={styles.assessSubtitle}>
                    {questionnaire.isError
                      ? authErrorMessage(questionnaire.error, language)
                      : t('onboarding.surveyUnavailable')}
                  </Text>
                  <Pressable
                    style={styles.assessBtn}
                    testID="onboarding-survey-retry"
                    disabled={questionnaire.isFetching}
                    onPress={() => void questionnaire.refetch()}
                  >
                    <LinearGradient
                      colors={['#2E3192', '#92278F', '#F37021']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.assessBtnGrad}
                    >
                      <Text style={styles.assessBtnText}>
                        {questionnaire.isFetching ? t('common.loading') : t('common.retry')}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </>
              ) : (
                <>
                  <ActivityIndicator color="#FFFFFF" size="large" />
                  <Text style={[styles.assessSubtitle, { marginTop: 16 }]}>
                    {t('common.loading')}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <>
              <View style={styles.progressRow}>
                {questions.map((question, i) => (
                  <View
                    key={question.id}
                    style={[
                      styles.progressDot,
                      i <= questionIndex && styles.progressDotActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.assessStep}>
                {t('onboarding.question', { current: questionIndex + 1, total: questions.length })}
              </Text>
              <Text style={styles.assessTitle}>{localize(q.question, language)}</Text>
              <View style={styles.optionList}>
                {questionOptions(q).map((opt) => (
                  <Pressable
                    key={opt.value}
                    testID={`onboarding-answer-${opt.value}`}
                    style={({ pressed }) => [
                      styles.option,
                      (pressed || selected === opt.value) && styles.optionPressed,
                    ]}
                    onPress={() => handleAnswer(opt.value)}
                  >
                    <Text style={[styles.optionText, { textAlign }]}>
                      {localize(opt.label, language)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {questionIndex > 0 && (
                <Pressable style={[styles.skipBtn, { marginTop: 16 }]} onPress={handleBack}>
                  <Text style={styles.skipText}>{t('common.back')}</Text>
                </Pressable>
              )}
            </>
          )}
        </Animated.View>
      </LinearGradient>
    );
  }

  const dominantIndex = Math.max(
    result?.dimensions.findIndex((d) => d.key === result.dominantKey) ?? -1,
    0,
  );
  const dominant = result?.dimensions[dominantIndex];
  const dominantColor = DIMENSION_COLORS[dominantIndex % DIMENSION_COLORS.length];
  return (
    <LinearGradient
      colors={['#0B1026', '#1A1040', '#2E1855']}
      style={[styles.fill, { paddingTop: topPad }]}
    >
      <Animated.View style={[styles.fill, { opacity: fadeAnim }]}>
        <ScrollView
          contentContainerStyle={[styles.resultScroll, { paddingBottom: botPad + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.slideTitle}>{t('onboarding.result')}</Text>
          {dominant && (
            <View
              style={[
                styles.personalityBadge,
                {
                  backgroundColor: dominantColor + '22',
                  borderColor: dominantColor + '55',
                },
              ]}
            >
              <Text style={[styles.personalityName, { color: dominantColor }]}>
                {localize(dominant.profileName ?? dominant.label, language)}
              </Text>
            </View>
          )}

          <View style={styles.resultCards}>
            {result?.dimensions.map((d, i) => {
              const color = DIMENSION_COLORS[i % DIMENSION_COLORS.length];
              return (
                <View key={d.key} style={styles.dimensionCard}>
                  <View style={styles.dimensionHeader}>
                    <Text style={[styles.dimensionLabel, { color }]}>
                      {localize(d.label, language)}
                    </Text>
                    <Text style={styles.dimensionScore}>{d.score}%</Text>
                  </View>
                  <View style={styles.scoreTrack}>
                    <View
                      style={[styles.scoreFill, { width: `${d.score}%`, backgroundColor: color }]}
                    />
                    {d.populationAverage !== undefined && (
                      <View style={[styles.scoreAverage, { left: `${d.populationAverage}%` }]} />
                    )}
                  </View>
                  <View style={styles.dimensionHeader}>
                    <Text style={[styles.bandText, { color: BAND_COLORS[d.band] }]}>
                      {t(`onboarding.band.${d.band}`)}
                    </Text>
                    {d.populationAverage !== undefined && (
                      <Text style={styles.averageText}>
                        {t('onboarding.average', { value: d.populationAverage })}
                      </Text>
                    )}
                  </View>
                  {!!d.narrative && (
                    <Text style={[styles.resultCardText, { textAlign }]}>
                      {localize(d.narrative, language)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          <Pressable
            style={[styles.nextBtn, styles.fullWidth, finishing && styles.assessBtnDisabled]}
            onPress={handleFinish}
            disabled={finishing}
            testID="onboarding-finish"
          >
            <LinearGradient
              colors={['#2E3192', '#92278F', '#F37021']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextBtnGrad}
            >
              <Text style={styles.nextBtnText}>
                {finishing ? t('common.loading') : t('Start My Journey')}
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  slideImage: { width: width * 0.7, height: height * 0.32, marginBottom: 36 },
  slideTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 16,
  },
  slideSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  slideDots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: { width: 24, backgroundColor: '#F37021' },
  slideActions: { paddingHorizontal: 28, gap: 12 },
  nextBtn: { borderRadius: 16, overflow: 'hidden' },
  nextBtnGrad: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderRadius: 16,
  },
  nextBtnText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.45)',
  },

  assessContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  authContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  authTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 24,
  },
  socialStack: { gap: 10, marginBottom: 20 },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  socialIcon: {
    width: 26,
    height: 26,
    textAlign: 'center',
    lineHeight: 26,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    overflow: 'hidden',
  },
  socialBtnText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  authDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  authDivider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  authDividerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  authInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressDotActive: { backgroundColor: '#F37021' },
  assessStep: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  assessTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 24,
    textAlign: 'center',
  },
  assessSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  optionList: { gap: 12 },
  option: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  optionPressed: {
    backgroundColor: 'rgba(46,49,146,0.4)',
    borderColor: 'rgba(146,39,143,0.6)',
  },
  optionText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    lineHeight: 22,
  },

  nameInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 24,
  },
  assessBtn: { borderRadius: 16, overflow: 'hidden', width: '100%' },
  assessBtnDisabled: { opacity: 0.45 },
  assessBtnGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  assessBtnText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },

  personalityBadge: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  resultScroll: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 24 },
  fullWidth: { width: '100%' },
  dimensionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  dimensionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimensionLabel: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  dimensionScore: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  scoreTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  scoreFill: { height: 8, borderRadius: 4 },
  scoreAverage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  bandText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  averageText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.5)',
  },
  personalityName: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  resultCards: { width: '100%', gap: 12, marginBottom: 32 },
  resultCardText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },

  splashCenter: { alignItems: 'center', justifyContent: 'center' },
  splashIconWrap: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
  },
  splashRingOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  splashIconCircle: {
    width: 138,
    height: 138,
    borderRadius: 69,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashIconImg: { width: 138, height: 138 },
  splashTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splashBrand: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  splashAIBadge: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 5 },
  splashAIText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  splashTagline: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 7,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sloganContainer: {
    marginTop: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  sloganRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  sloganWord: {
    fontSize: 20,
    fontFamily: 'Inter_400Regular',
    lineHeight: 30,
    textAlign: 'center',
  },
  sloganVisible: { color: 'rgba(255,255,255,0.88)' },
  sloganHidden: { color: 'transparent' },
  tapHint: {
    position: 'absolute',
    bottom: 48,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.22)',
    letterSpacing: 0.5,
  },
  particle: { position: 'absolute', backgroundColor: '#4A90E2' },
});
