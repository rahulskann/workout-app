import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { usePlans } from '../context/PlanContext';
import { getColors } from '../theme/colors';
import { makeDefaultPlan } from '../data/defaultPlan';
import { useTransfer } from '../hooks/useTransfer';

// Shown when there are no plans: on a brand-new install, or after deleting
// every plan. Picking an option creates the plan, and the app switches to
// the workout screen on its own.
export default function WelcomeScreen() {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeStyles(colors);
  const { startWithDefaultPlan, createBlankPlan } = usePlans();
  const [busy, setBusy] = useState(false);
  const transfer = useTransfer();

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
        <Text style={styles.title}>Welcome to SplitCycle</Text>
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

        <Text style={styles.sectionLabel}>Already have one?</Text>
        <View style={styles.fileRow}>
          <TouchableOpacity
            style={styles.fileButton}
            onPress={transfer.importPlan}
            disabled={busy || !!transfer.busy}
          >
            <Text style={styles.fileButtonTitle}>
              {transfer.busy === 'import' ? 'Importing…' : 'Import a plan'}
            </Text>
            <Text style={styles.fileButtonBody}>A plan file someone shared with you</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fileButton}
            onPress={transfer.restore}
            disabled={busy || !!transfer.busy}
          >
            <Text style={styles.fileButtonTitle}>
              {transfer.busy === 'restore' ? 'Restoring…' : 'Restore a backup'}
            </Text>
            <Text style={styles.fileButtonBody}>Moving from another phone</Text>
          </TouchableOpacity>
        </View>

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
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 12,
      marginBottom: 10,
    },
    fileRow: { flexDirection: 'row', gap: 10 },
    fileButton: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
    },
    fileButtonTitle: { color: colors.accent, fontSize: 15, fontWeight: '700' },
    fileButtonBody: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
    footnote: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 16 },
  });
}
