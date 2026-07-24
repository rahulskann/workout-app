import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import RoutineScreen from './src/screens/RoutineScreen';
import SettingsScreen from './src/screens/SettingsScreen';

function Root() {
  const [screen, setScreen] = useState('routine'); // 'routine' | 'settings'
  const { settings } = useSettings();

  return (
    <>
      <StatusBar style={settings.themeMode === 'light' ? 'dark' : 'light'} />
      {screen === 'settings' ? (
        <SettingsScreen onBack={() => setScreen('routine')} />
      ) : (
        <RoutineScreen onOpenSettings={() => setScreen('settings')} />
      )}
    </>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <Root />
    </SettingsProvider>
  );
}
