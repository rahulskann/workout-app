import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { usePlans } from '../context/PlanContext';
import { getColors } from '../theme/colors';
import { DEFAULT_PLAN_ID } from '../data/defaultPlan';

function planSummary(plan) {
  const exercises = plan.days.reduce((n, d) => n + d.exercises.length, 0);
  const days = `${plan.days.length} ${plan.days.length === 1 ? 'day' : 'days'}`;
  return `${days} · ${exercises} ${exercises === 1 ? 'exercise' : 'exercises'}`;
}

export default function PlansScreen({ navigation }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeStyles(colors);
  const {
    plans,
    activePlan,
    setActivePlan,
    startWithDefaultPlan,
    createBlankPlan,
    createCopyOfDefaultPlan,
    duplicatePlan,
    deletePlan,
  } = usePlans();

  const confirmDelete = (plan) => {
    const isDefault = plan.id === DEFAULT_PLAN_ID;
    Alert.alert(
      `Delete ${plan.name}?`,
      isDefault
        ? 'You can bring it back any time with "Reset 5-Day Cycle". Logged history and PRs stay on the phone.'
        : 'Its days and exercises will be removed. Sessions already sent to Sheets are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePlan(plan.id) },
      ]
    );
  };

  const confirmReset = () => {
    const hasDefault = plans.some((p) => p.id === DEFAULT_PLAN_ID);
    Alert.alert(
      'Reset 5-Day Cycle?',
      hasDefault
        ? 'Puts the original days and exercises back and makes it your active plan. Any changes you made to it will be lost; logged history, PRs, photos and videos are kept.'
        : 'Adds the original 5-Day Cycle back and makes it your active plan. Logged history and PRs from before are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', onPress: startWithDefaultPlan },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plans</Text>
        </View>

        {plans.map((plan) => {
          const isActive = plan.id === activePlan?.id;
          return (
            <View key={plan.id} style={[styles.planCard, isActive && styles.planCardActive]}>
              <View style={styles.planTitleRow}>
                <Text style={styles.planName}>{plan.name}</Text>
                {isActive && <Text style={styles.activeBadge}>Active</Text>}
              </View>
              <Text style={styles.planSummary}>{planSummary(plan)}</Text>
              <View style={styles.planActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('PlanEditor', { planId: plan.id })}
                >
                  <Text style={styles.primaryLink}>Edit</Text>
                </TouchableOpacity>
                {!isActive && (
                  <TouchableOpacity onPress={() => setActivePlan(plan.id)}>
                    <Text style={styles.primaryLink}>Use this plan</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => duplicatePlan(plan.id)}>
                  <Text style={styles.link}>Duplicate</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(plan)}>
                  <Text style={styles.dangerLink}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New plan</Text>
          <Text style={styles.sectionSub}>
            New plans become your active plan. Copies keep their own history and PRs, separate
            from the original.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={createBlankPlan}>
            <Text style={styles.secondaryButtonText}>Blank plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={createCopyOfDefaultPlan}>
            <Text style={styles.secondaryButtonText}>Copy of the original 5-Day Cycle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reset 5-Day Cycle</Text>
          <Text style={styles.sectionSub}>
            Brings back the original 5-Day Cycle and makes it your active plan. Your logged
            history and PRs are kept.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={confirmReset}>
            <Text style={styles.secondaryButtonText}>Reset 5-Day Cycle</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 60 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingTop: 8 },
    backButton: { marginRight: 12 },
    backButtonText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
    headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
    planCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      marginBottom: 12,
    },
    planCardActive: { borderColor: colors.accent },
    planTitleRow: { flexDirection: 'row', alignItems: 'center' },
    planName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', flexShrink: 1 },
    activeBadge: {
      color: colors.accent,
      backgroundColor: colors.accentSoft,
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 8,
      overflow: 'hidden',
    },
    planSummary: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
    planActions: { flexDirection: 'row', gap: 18, marginTop: 12 },
    primaryLink: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    link: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    dangerLink: { color: colors.danger, fontSize: 14, fontWeight: '600' },
    section: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      marginTop: 8,
      marginBottom: 8,
    },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6 },
    sectionSub: { color: colors.textSecondary, fontSize: 12, marginBottom: 6, lineHeight: 17 },
    secondaryButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 8,
    },
    secondaryButtonText: { color: colors.textPrimary, fontWeight: '600' },
  });
}
