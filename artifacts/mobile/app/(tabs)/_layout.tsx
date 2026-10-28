import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, useResolvedColorScheme } from '@/hooks/useColors';
import { useLocalization } from '@/localization';

export const unstable_settings = {
  initialRouteName: 'index',
};

function AICoachIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C7.03 2 3 5.69 3 10.2c0 2.57 1.28 4.87 3.3 6.4V20l3.37-1.87c.74.2 1.52.31 2.33.31 4.97 0 9-3.69 9-8.24C21 5.69 16.97 2 12 2z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 10.2h.01"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M12 10.2h.01"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M15 10.2h.01"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M18 3l.5 1.5L20 5l-1.5.5L18 7l-.5-1.5L16 5l1.5-.5L18 3z"
        fill={color}
        opacity={0.7}
      />
    </Svg>
  );
}

function NativeTabLayout() {
  const { t, isRTL } = useLocalization();
  const tabs = [
    { name: 'index', label: t('tabs.home'), icon: { default: 'house', selected: 'house.fill' } },
    { name: 'coach', label: t('tabs.coach'), icon: { default: 'sparkles', selected: 'sparkles' } },
    { name: 'insights', label: t('tabs.insights'), icon: { default: 'chart.bar', selected: 'chart.bar.fill' } },
    { name: 'goals', label: t('tabs.goals'), icon: { default: 'target', selected: 'target' } },
    { name: 'profile', label: t('tabs.profile'), icon: { default: 'person', selected: 'person.fill' } },
  ] as const;
  const orderedTabs = isRTL ? [...tabs].reverse() : tabs;

  return (
    <NativeTabs>
      {orderedTabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon sf={tab.icon} />
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useResolvedColorScheme();
  const safeAreaInsets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const { t, isRTL } = useLocalization();
  const tabNames = ['index', 'coach', 'insights', 'goals', 'profile'] as const;
  const orderedTabNames = isRTL ? [...tabNames].reverse() : tabNames;
  const titles = {
    index: t('tabs.home'),
    coach: t('tabs.coach'),
    insights: t('tabs.insights'),
    goals: t('tabs.goals'),
    profile: t('tabs.profile'),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.indigo,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: safeAreaInsets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      {orderedTabNames.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: titles[name],
            tabBarIcon: ({ color }) => {
              if (name === 'index') {
                return isIOS ? (
                  <SymbolView name="house" tintColor={color} size={24} />
                ) : (
                  <Feather name="home" size={22} color={color} />
                );
              }
              if (name === 'coach') {
                return isIOS ? (
                  <SymbolView name="sparkles" tintColor={color} size={24} />
                ) : (
                  <AICoachIcon color={color} />
                );
              }
              if (name === 'insights') {
                return isIOS ? (
                  <SymbolView name="chart.bar" tintColor={color} size={24} />
                ) : (
                  <Feather name="bar-chart-2" size={22} color={color} />
                );
              }
              if (name === 'goals') {
                return isIOS ? (
                  <SymbolView name="target" tintColor={color} size={24} />
                ) : (
                  <Feather name="target" size={22} color={color} />
                );
              }
              return isIOS ? (
                <SymbolView name="person" tintColor={color} size={24} />
              ) : (
                <Feather name="user" size={22} color={color} />
              );
            },
          }}
        />
      ))}
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
