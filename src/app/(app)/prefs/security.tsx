import React, { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/contexts/ThemeContext';
import { AutoLock, useAppLock } from '@/contexts/AppLockContext';
import { ActionSheet, Header, Row, Section } from '@/components/ui';
import { sb } from '@/lib/supabase';
import { humanError } from '@/utils/errors';
import { useT } from '@/i18n';

export default function SecuritySettingsScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const { signOut, deleteAccount } = useAuth();
  const lock = useAppLock();
  const [autoLockOpen, setAutoLockOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const autoLockLabel = (m: AutoLock) => (m === 0 ? t('security.immediately') : t('security.afterMin', { min: m }));

  const signOutOthers = () =>
    Alert.alert(t('security.signOutOthersTitle'), t('security.signOutOthersText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('security.signOutOthers'),
        onPress: async () => {
          const { error } = await sb().auth.signOut({ scope: 'others' });
          Alert.alert(error ? t('common.error') : t('common.done'), error ? humanError(error) : t('security.signedOutOthers'));
        },
      },
    ]);

  const confirmSignOut = () =>
    Alert.alert(t('security.signOutTitle'), t('security.signOutText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('security.signOut'), style: 'destructive', onPress: () => signOut().catch((e) => Alert.alert(t('common.error'), humanError(e))) },
    ]);

  const confirmDelete = () =>
    Alert.alert(t('security.deleteTitle'), t('security.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('security.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await lock.removePin().catch(() => {});
            await deleteAccount();
          } catch (e) {
            Alert.alert(t('common.error'), humanError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={t('settings.security')} back />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Section title={t('security.appLock')} footer={t('security.appLockFooter')}>
          <Row
            icon="keypad"
            label={t('security.pin')}
            right={
              <Switch
                value={lock.pinEnabled}
                onValueChange={(on) => router.push({ pathname: '/prefs/pin', params: { mode: on ? 'set' : 'disable' } })}
                trackColor={{ true: c.primary, false: c.border }}
                thumbColor="#fff"
              />
            }
          />
          {lock.pinEnabled ? (
            <>
              <Row icon="refresh" label={t('security.changePin')} onPress={() => router.push({ pathname: '/prefs/pin', params: { mode: 'change' } })} />
              <Row
                icon="finger-print"
                label={t('security.biometric')}
                hint={lock.biometricAvailable ? undefined : t('security.biometricUnavailable')}
                right={<Switch value={lock.biometric} disabled={!lock.biometricAvailable} onValueChange={(v) => lock.setBiometric(v)} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />}
              />
              <Row icon="timer" label={t('security.autoLock')} value={autoLockLabel(lock.autoLockMin)} onPress={() => setAutoLockOpen(true)} last />
            </>
          ) : null}
        </Section>

        <Section title={t('security.account')}>
          <Row icon="lock-closed" label={t('security.changePassword')} onPress={() => router.push('/change-password')} />
          <Row icon="phone-portrait" label={t('security.signOutOthers')} hint={t('security.devicesLater')} onPress={signOutOthers} last />
        </Section>

        <Section title={t('security.encryption')}>
          <Row icon="key" label={t('security.encryptionInfo')} onPress={() => router.push('/security')} last />
        </Section>

        <Section>
          <Row icon="log-out" label={t('security.signOut')} onPress={confirmSignOut} danger />
          <Row icon="trash" label={busy ? t('security.deleting') : t('security.deleteAccount')} onPress={busy ? undefined : confirmDelete} danger last />
        </Section>
      </ScrollView>
      <ActionSheet
        visible={autoLockOpen}
        title={t('security.autoLock')}
        actions={([0, 1, 5, 15, 60] as AutoLock[]).map((m) => ({
          label: autoLockLabel(m) + (lock.autoLockMin === m ? ' ✓' : ''),
          icon: 'timer-outline',
          onPress: () => lock.setAutoLock(m),
        }))}
        onClose={() => setAutoLockOpen(false)}
      />
    </View>
  );
}
