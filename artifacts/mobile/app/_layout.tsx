import '@/utils/reactotron';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setBaseUrl } from '@workspace/api-client-react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BiometricLock } from '@/components/BiometricLock';
import { LocalizationProvider, useLocalization } from '@/localization';
import { hydrateAppStore } from '@/stores/appStore';
import { ensureAuthHydrated } from '@/stores/authStore';
import { hydratePreferencesStore } from '@/stores/preferencesStore';
import { useConsumerSession } from '@/hooks/useConsumerSession';
import { usePreferenceSync } from '@/hooks/usePreferences';
import { useColors } from '@/hooks/useColors';
import { authErrorMessage } from '@/utils/authErrors';

SplashScreen.preventAutoHideAsync();
setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated } = useConsumerSession();
  usePreferenceSync();
  return (
    <BiometricLock isAuthenticated={isAuthenticated}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="upgrade"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="personal-info"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen name="linked-accounts" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="add-linked-account" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="payment-methods" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="add-payment-method" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack.Protected>
    </Stack>
    </BiometricLock>
  );
}

function SessionBootstrap() {
  const colors = useColors();
  const { language } = useLocalization();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setError(null);
    Promise.all([ensureAuthHydrated(), hydrateAppStore(), hydratePreferencesStore()]).then(
      () => { if (mounted) setReady(true); },
      (failure) => { if (mounted) setError(failure); },
    );
    return () => { mounted = false; };
  }, [attempt]);
  if (ready) return <RootLayoutNav />;
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 20, backgroundColor: colors.background }}>
      {error ? <>
        <Text accessibilityRole="alert" style={{ color: colors.foreground, textAlign: 'center' }}>
          {authErrorMessage(error, language)}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
          <Text style={{ color: colors.primary }}>{language === 'ar' ? 'حاول مرة أخرى' : 'Try again'}</Text>
        </Pressable>
      </> : <ActivityIndicator size="large" color={colors.primary} />}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
      <LocalizationProvider>
        <ErrorBoundary>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <SessionBootstrap />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </ErrorBoundary>
      </LocalizationProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
