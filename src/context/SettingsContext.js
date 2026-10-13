import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SETTINGS_KEY } from '../constants/storageKeys';

const defaultSettings = {
  themeMode: 'dark', // 'dark' | 'light'
  logFormMode: 'expand', // 'expand' | 'always'
  youtubePlayback: 'app', // 'app' (open the YouTube app) | 'inapp' (embedded player)
  sheetsWebhookUrl: '', // manual fallback path
  googleAccountEmail: '', // display only -- the actual token lives in SecureStore
  googleSheetsSpreadsheetId: '',
  googleSheetsRange: 'Sheet1!A1',
};

const SettingsContext = createContext({
  settings: defaultSettings,
  updateSettings: () => {},
  reloadSettings: () => {},
  loaded: false,
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  // Reads settings from storage: at startup, and again after a restore.
  const reloadSettings = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      setSettings(raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings);
    } catch (e) {
      // fall back to defaults silently
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, reloadSettings, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
