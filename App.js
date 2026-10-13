import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { PlanProvider, usePlans } from './src/context/PlanContext';
import { getColors } from './src/theme/colors';
import RoutineScreen from './src/screens/RoutineScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PlansScreen from './src/screens/PlansScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';

const Stack = createNativeStackNavigator();

function Root() {
  const { settings } = useSettings();
  const { loaded, plans } = usePlans();
  const colors = getColors(settings.themeMode);

  // Match the navigator's background to the app theme so screen transitions
  // don't flash the default white/black behind the cards.
  const base = settings.themeMode === 'light' ? DefaultTheme : DarkTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.cardBorder,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={settings.themeMode === 'light' ? 'dark' : 'light'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* With no plans (fresh install, or every plan deleted) the welcome
            screen is the only screen; creating a plan swaps in the rest. */}
        {loaded && plans.length === 0 ? (
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        ) : (
          <>
            <Stack.Screen name="Routine" component={RoutineScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Plans" component={PlansScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <PlanProvider>
          <Root />
        </PlanProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
