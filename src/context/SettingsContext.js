import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SETTINGS_KEY } from '../constants/storageKeys';

const defaultSettings = {
  themeMode: 'dark', // 'dark' | 'light'
  logFormMode: 'expand', // 'expand' | 'always'
  sheetsWebhookUrl: '',
};

const SettingsContext = createContext({
  settings: defaultSettings,
  updateSettings: () => {},
  loaded: false,
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          setSettings({ ...defaultSettings, ...JSON.parse(raw) });
        }
      } catch (e) {
        // fall back to defaults silently
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
