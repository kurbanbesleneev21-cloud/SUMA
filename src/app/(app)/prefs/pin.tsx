import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/contexts/ThemeContext';
import { PinPad, useAppLock } from '@/contexts/AppLockContext';
import { Header } from '@/components/ui';
import { useT } from '@/i18n';

// Flows: set (new → confirm), change (current → new → confirm), disable (current).
export default function PinScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const lock = useAppLock();
  const { mode } = useLocalSearchParams<{ mode: 'set' | 'change' | 'disable' }>();
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>(mode === 'set' ? 'new' : 'current');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);

  const title = step === 'current' ? t('pin.current') : step === 'new' ? t('pin.new') : t('pin.confirm');

  const onComplete = async (pin: string) => {
    setError(null);
    if (step === 'current') {
      if (!lock.verifyPin(pin)) {
        setError(t('pin.wrong'));
        return;
      }
      if (mode === 'disable') {
        await lock.removePin();
        router.back();
        return;
      }
      setStep('new');
      return;
    }
    if (step === 'new') {
      if (/^(\d)\1{3}$/.test(pin) || pin === '1234') {
        setError(t('pin.tooSimple'));
        return;
      }
      setFirst(pin);
      setStep('confirm');
      return;
    }
    if (pin !== first) {
      setError(t('pin.mismatch'));
      setStep('new');
      return;
    }
    await lock.setPin(pin);
    Alert.alert(t('common.done'), t('pin.saved'));
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Header title={mode === 'disable' ? t('pin.disableTitle') : t('security.pin')} back />
      <PinPad key={step} title={title} subtitle={step === 'new' ? t('pin.hint') : undefined} error={error} onComplete={onComplete} />
    </View>
  );
}
