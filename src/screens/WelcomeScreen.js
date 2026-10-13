import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { usePlans } from '../context/PlanContext';
import { getColors } from '../theme/colors';
import { makeDefaultPlan } from '../data/defaultPlan';

// Shown when there are no plans: on a brand-new install, or after deleting
// every plan. Picking an option creates the plan, and the app switches to
// the workout screen on its own.
export default function WelcomeScreen() {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeStyles(colors);
  const { startWithDefaultPlan, createBlankPlan } = usePlans();
  const [busy, setBusy] = useState(false);

  const defaultPlan = makeDefaultPlan();
  const exerciseCount = defaultPlan.days.reduce((n, d) => n + d.exercises.length, 0);
  const dayNames = defaultPlan.days.map((d) => d.name.split('·').pop().trim()).join(' · ');

  const choose = (action) => {
    if (busy) return;
    setBusy(true);
    action();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>How do you want to start?</Text>

        <TouchableOpacity style={styles.option} onPress={() => choose(startWithDefaultPlan)}>
          <Text style={styles.optionTitle}>5-Day Cycle</Text>
          <Text style={styles.optionBody}>
            A ready-made program: {dayNames}. {exerciseCount} exercises with sets and muscle
            groups filled in. You can change any of it later.
          </Text>
          <Text style={styles.optionCta}>Start with the 5-Day Cycle ›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={() => choose(createBlankPlan)}>
          <Text style={styles.optionTitle}>Start from scratch</Text>
          <Text style={styles.optionBody}>
            An empty plan you build yourself, with your own days and exercises.
          </Text>
          <Text style={styles.optionCta}>Start from scratch ›</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          You can add more plans, switch between them, or reset the 5-Day Cycle any time in
          Settings → Plans.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 48 },
    title: { color: colors.textPrimary, fontSize: 30, fontWeight: '700' },
    subtitle: { color: colors.textSecondary, fontSize: 16, marginTop: 6, marginBottom: 28 },
    option: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 18,
      marginBottom: 14,
    },
    optionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 6 },
    optionBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    optionCta: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 12 },
    footnote: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 10 },
  });
}
