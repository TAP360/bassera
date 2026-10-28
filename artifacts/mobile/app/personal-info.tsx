import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
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

import { useColors } from '@/hooks/useColors';
import { useLocalization } from '@/localization';
import { showProfilePhotoOptions } from '@/utils/profilePhoto';
import { useConsumerProfileUpdate } from '@/hooks/useConsumerProfileUpdate';
import { useProfile } from '@/hooks/useProfile';
import { authErrorMessage } from '@/utils/authErrors';
import { getCountryOptions } from '@/utils/countries';
import { useAppStore } from '@/stores/appStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useAuthStore } from '@/stores/authStore';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { profile } = useProfile();
  const updateLocalProfile = useAppStore((state) => state.updateLocalProfile);
  const { t, isRTL, language } = useLocalization();
  const textAlign = isRTL ? 'right' : 'left';
  const profileUpdate = useConsumerProfileUpdate();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(profile.name);
  const email = profile.email;
  const phone = useAuthStore((identity) => identity.phone) ?? '';
  const countryCode = profile.demographics?.countryCode;
  const country = getCountryOptions(language).find((option) => option.country === countryCode)?.name ?? '';
  const currency = usePreferencesStore((state) => state.currency);
  const [changed, setChanged] = useState(false);

  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 24 : insets.bottom;

  const handleChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setChanged(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('personal.nameRequired'), t('personal.nameRequiredMessage'));
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await profileUpdate.update({ name: name.trim() });
    } catch (error) {
      const message = authErrorMessage(error, language);
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert(t('personal.title'), message);
      return;
    } finally { setSaving(false); }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setChanged(false);
    if (Platform.OS === 'web') {
      window.alert(`${t('personal.saved')}\n${t('personal.savedMessage')}`);
      router.back();
    } else {
      Alert.alert(t('personal.saved'), t('personal.savedMessage'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    }
  };

  const choosePhoto = () =>
    showProfilePhotoOptions(t, (photoUri) => updateLocalProfile({ photoUri }));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background, direction: isRTL ? 'rtl' : 'ltr' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#0B1026', '#1A1040']}
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name={isRTL ? 'arrow-right' : 'arrow-left'} size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={[styles.headerTitle, { textAlign: 'center' }]}>{t('personal.title')}</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingBottom: botPad + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatarFrame}>
            <LinearGradient
              colors={['#2E3192', '#92278F']}
              style={styles.avatarCircle}
            >
              {profile.photoUri ? (
                <Image source={{ uri: profile.photoUri }} style={styles.avatarPhoto} />
              ) : (
                <Text style={styles.avatarLetter}>
                  {(name.trim() || '?')[0]?.toUpperCase()}
                </Text>
              )}
            </LinearGradient>
          </View>
          <Pressable
            style={[
              styles.editAvatarBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            accessibilityRole="button"
            onPress={choosePhoto}
          >
            <Feather name="camera" size={14} color={colors.foreground} />
            <Text style={[styles.editAvatarText, { color: colors.foreground }]}>
              {t('personal.changePhoto')}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign, letterSpacing: isRTL ? 0 : 0.8 }]}
          >
            {t('personal.fullName')}
          </Text>
          <TextInput
            testID="personal-name"
            style={[
              styles.input,
              { color: colors.foreground, borderBottomColor: colors.border, textAlign, writingDirection: isRTL ? 'rtl' : 'ltr' },
            ]}
            value={name}
            onChangeText={handleChange(setName)}
            placeholder={t('personal.fullNamePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="next"
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign, letterSpacing: isRTL ? 0 : 0.8 }]}
          >
            {t('personal.email')}
          </Text>
          <TextInput
            style={[
              styles.input,
              { color: colors.foreground, borderBottomColor: colors.border, textAlign: 'left', writingDirection: 'ltr' },
            ]}
            value={email}
            editable={false}
            placeholder={t('personal.emailPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign, letterSpacing: isRTL ? 0 : 0.8 }]}
          >
            {t('personal.phone')}
          </Text>
          <TextInput
            style={[
              styles.input,
              { color: colors.foreground, borderBottomColor: colors.border, textAlign: 'left', writingDirection: 'ltr' },
            ]}
            value={phone}
            editable={false}
            placeholder={t('personal.phonePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            returnKeyType="next"
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground }]}
          >
            {t('personal.country')}
          </Text>
          <Pressable
            style={[
              styles.input,
              styles.picker,
              {
                borderBottomColor: colors.border,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
            disabled
          >
            <Text style={[styles.pickerText, { color: colors.foreground, textAlign, flex: 1 }]}>
              {country}
            </Text>
            <Feather
              name="chevron-down"
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign, letterSpacing: isRTL ? 0 : 0.8 }]}
          >
            {t('personal.currency')}
          </Text>
          <Pressable
            style={[
              styles.input,
              styles.picker,
              {
                borderBottomColor: colors.border,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
            onPress={() =>
              Alert.alert(
                t('personal.currency'),
                t('EGP — Egyptian Pound\nSAR — Saudi Riyal\nAED — UAE Dirham\nKWD — Kuwaiti Dinar'),
                [{ text: t('common.ok') }],
              )
            }
          >
            <Text style={[styles.pickerText, { color: colors.foreground, textAlign, flex: 1 }]}>
              {currency}
            </Text>
            <Feather
              name="chevron-down"
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        <Pressable
            testID="personal-save"
            style={[styles.saveBtn, (!changed || saving) && { opacity: 0.45 }]}
          onPress={handleSave}
            disabled={!changed || saving}
        >
          <LinearGradient
            colors={['#2E3192', '#92278F', '#F37021']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGrad}
          >
            <Text style={styles.saveBtnText}>{saving ? t('common.loading') : t('personal.save')}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  body: { padding: 20, gap: 12 },
  avatarSection: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  avatarFrame: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden' },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 40, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  avatarPhoto: { width: '100%', height: '100%', borderRadius: 44 },
  editAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  editAvatarText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  section: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  saveBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
});
