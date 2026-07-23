import React from 'react';
import { StatusBar } from 'expo-status-bar';
import RoutineScreen from './src/screens/RoutineScreen';

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <RoutineScreen />
    </>
  );
}
