import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, updateSettings } from '@/services/users';
import { humanError } from '@/utils/errors';
import { t } from '@/i18n';
import type { UserSettings } from '@/types';

// Server-side user settings with optimistic updates (rolled back on failure).
export function useUserSettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSettings(await getSettings());
      setError(null);
    } catch (e) {
      setError(humanError(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<Omit<UserSettings, 'user_id'>>) => {
      if (!settings || !session) return;
      const before = settings;
      setSettings({ ...settings, ...patch });
      try {
        setSettings(await updateSettings(session.user.id, patch));
      } catch (e) {
        setSettings(before);
        Alert.alert(t('common.error'), humanError(e));
      }
    },
    [settings, session],
  );

  return { settings, error, reload: load, update };
}
