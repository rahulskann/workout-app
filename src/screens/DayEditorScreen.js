import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { usePlans } from '../context/PlanContext';
import { getColors } from '../theme/colors';
import { makeScreenStyles } from '../theme/screenStyles';
import NameField from '../components/NameField';
import MoveButtons from '../components/MoveButtons';
import { renameDay, moveExercise, removeDay } from '../storage/planEdits';

export function describeExercise(ex) {
  const parts = [];
  if (ex.targetGroup) parts.push(ex.targetGroup);
  if (ex.logType === 'checkbox') parts.push('checkbox');
  else parts.push(`${ex.targetSets} ${ex.targetSets === 1 ? 'set' : 'sets'}`);
  if (ex.logType === 'timed') parts.push('timed');
  return parts.join(' · ');
}

// Edit one day: its name and its exercises, in the order they're done.
export default function DayEditorScreen({ navigation, route }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeScreenStyles(colors);
  const { plans, editPlan } = usePlans();
  const { planId, dayId } = route.params;
  const plan = plans.find((p) => p.id === planId);
  const day = plan?.days.find((d) => d.id === dayId);

  if (!day) return null; // deleted while open

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${day.name}?`,
      'Its exercises are removed from this plan. Logged history stays on the phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            navigation.goBack();
            await editPlan(planId, (p) => removeDay(p, dayId));
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
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Edit Day
          </Text>
        </View>

        <Text style={styles.label}>Day name</Text>
        <NameField
          style={styles.input}
          value={day.name}
          onCommit={(name) => editPlan(planId, (p) => renameDay(p, dayId, name))}
          placeholder="e.g. Day 1 · Legs"
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.hint}>
          Tip: "Day 1 · Legs" shows as "Day 1" on the day buttons and in full at the top.
        </Text>

        <Text style={styles.label}>Exercises, in order</Text>
        {day.exercises.length === 0 && <Text style={styles.empty}>No exercises yet.</Text>}
        {day.exercises.map((ex, i) => (
          <TouchableOpacity
            key={ex.exerciseId}
            style={styles.listRow}
            onPress={() =>
              navigation.navigate('ExerciseEditor', { planId, dayId, exerciseId: ex.exerciseId })
            }
          >
            <View style={styles.listRowMain}>
              <Text style={styles.listRowTitle}>{ex.name}</Text>
              <Text style={styles.listRowSub}>{describeExercise(ex)}</Text>
            </View>
            <MoveButtons
              styles={styles}
              index={i}
              count={day.exercises.length}
              onMove={(delta) =>
                editPlan(planId, (p) => moveExercise(p, dayId, ex.exerciseId, delta))
              }
            />
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('ExerciseEditor', { planId, dayId, exerciseId: null })}
        >
          <Text style={styles.primaryButtonText}>+ Add exercise</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerButton} onPress={confirmDelete}>
          <Text style={styles.dangerButtonText}>Delete this day</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
