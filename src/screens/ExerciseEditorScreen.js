import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { usePlans } from '../context/PlanContext';
import { getColors } from '../theme/colors';
import { makeScreenStyles } from '../theme/screenStyles';
import { newId } from '../storage/plans';
import {
  DEFAULT_EXERCISE,
  addExercise,
  updateExercise,
  removeExercise,
} from '../storage/planEdits';

const COMMON_GROUPS = [
  'Chest',
  'Back',
  'Lats',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
  'Stretching',
];
const MAX_SETS = 10;

// Add a new exercise to a day (exerciseId null) or edit an existing one.
// Nothing is saved until you tap Save.
export default function ExerciseEditorScreen({ navigation, route }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeScreenStyles(colors);
  const local = makeStyles(colors);
  const { plans, editPlan } = usePlans();
  const { planId, dayId, exerciseId } = route.params;
  const day = plans.find((p) => p.id === planId)?.days.find((d) => d.id === dayId);
  const existing = exerciseId ? day?.exercises.find((ex) => ex.exerciseId === exerciseId) : null;

  const [form, setForm] = useState(() => ({ ...DEFAULT_EXERCISE, ...existing }));
  const set = (changes) => setForm((f) => ({ ...f, ...changes }));
  const isCheckbox = form.logType === 'checkbox';

  if (!day || (exerciseId && !existing)) return null; // deleted while open

  const handleSave = async () => {
    const name = (form.name || '').trim();
    if (!name) {
      Alert.alert('Name needed', 'Give the exercise a name first.');
      return;
    }
    const fields = {
      name,
      targetGroup: (form.targetGroup || '').trim(),
      logType: form.logType,
      // Checkbox exercises are a single tick, so they're always 1 set.
      targetSets: isCheckbox ? 1 : form.targetSets,
    };
    await editPlan(planId, (p) =>
      existing
        ? updateExercise(p, dayId, exerciseId, fields)
        : addExercise(p, dayId, { ...fields, exerciseId: newId('ex') })
    );
    navigation.goBack();
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${existing.name}?`,
      'It is removed from this day. Its logged history stays on the phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await editPlan(planId, (p) => removeExercise(p, dayId, exerciseId));
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{existing ? 'Edit Exercise' : 'New Exercise'}</Text>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(name) => set({ name })}
          placeholder="e.g. Barbell Squat"
          placeholderTextColor={colors.textSecondary}
          autoFocus={!existing}
        />

        <Text style={styles.label}>How it's logged</Text>
        <View style={local.toggleRow}>
          <Choice
            local={local}
            label="Weights & reps"
            active={!isCheckbox}
            onPress={() => set({ logType: 'weights' })}
          />
          <Choice
            local={local}
            label="Checkbox"
            active={isCheckbox}
            onPress={() => set({ logType: 'checkbox' })}
          />
        </View>
        <Text style={styles.hint}>
          {isCheckbox
            ? 'Just tick it off: good for warm-ups, stretches, mobility and timed holds.'
            : 'Log weight and reps for each set. Use 0 lbs for bodyweight moves.'}
        </Text>

        {!isCheckbox && (
          <>
            <Text style={styles.label}>Sets</Text>
            <View style={local.stepper}>
              <TouchableOpacity
                style={local.stepButton}
                onPress={() => set({ targetSets: Math.max(1, form.targetSets - 1) })}
              >
                <Text style={local.stepButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={local.stepValue}>{form.targetSets}</Text>
              <TouchableOpacity
                style={local.stepButton}
                onPress={() => set({ targetSets: Math.min(MAX_SETS, form.targetSets + 1) })}
              >
                <Text style={local.stepButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.label}>Muscle group</Text>
        <TextInput
          style={styles.input}
          value={form.targetGroup}
          onChangeText={(targetGroup) => set({ targetGroup })}
          placeholder="Type one, or tap below"
          placeholderTextColor={colors.textSecondary}
        />
        <View style={local.chips}>
          {COMMON_GROUPS.map((group) => (
            <TouchableOpacity
              key={group}
              style={[local.chip, form.targetGroup === group && local.chipActive]}
              onPress={() => set({ targetGroup: group })}
            >
              <Text style={[local.chipText, form.targetGroup === group && local.chipTextActive]}>
                {group}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>{existing ? 'Save' : 'Add exercise'}</Text>
        </TouchableOpacity>

        {existing && (
          <TouchableOpacity style={styles.dangerButton} onPress={confirmDelete}>
            <Text style={styles.dangerButtonText}>Delete exercise</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Choice({ local, label, active, onPress }) {
  return (
    <TouchableOpacity style={[local.choice, active && local.choiceActive]} onPress={onPress}>
      <Text style={[local.choiceText, active && local.choiceTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    toggleRow: { flexDirection: 'row', gap: 10 },
    choice: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      alignItems: 'center',
    },
    choiceActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    choiceText: { color: colors.textSecondary, fontWeight: '600' },
    choiceTextActive: { color: colors.accent },
    stepper: { flexDirection: 'row', alignItems: 'center' },
    stepButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepButtonText: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
    stepValue: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      width: 56,
      textAlign: 'center',
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.pill,
      borderWidth: 1,
      borderColor: colors.pill,
    },
    chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    chipText: { color: colors.textSecondary, fontSize: 13 },
    chipTextActive: { color: colors.accent, fontWeight: '600' },
  });
}
