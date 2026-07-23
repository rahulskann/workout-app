import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { ROUTINES } from '../data/routines';
import {
  getRoutineIndex,
  getExercisesForRoutine,
  logSession,
  advanceRoutine,
  resetCompletionForRoutine,
} from '../storage/storage';
import ExerciseCard from '../components/ExerciseCard';
import { colors } from '../theme/colors';

export default function RoutineScreen() {
  const [routineIndex, setRoutineIndex] = useState(0);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  const routine = ROUTINES[routineIndex];

  const load = useCallback(async () => {
    setLoading(true);
    const idx = await getRoutineIndex();
    setRoutineIndex(idx);
    const current = ROUTINES[idx];
    const withState = await getExercisesForRoutine(current);
    setExercises(withState);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLog = async (exercise, { weight, reps }) => {
    await logSession({ ...exercise, routineName: routine.name }, { weight, reps });
    const refreshed = await getExercisesForRoutine(routine);
    setExercises(refreshed);
  };

  const allDone = exercises.length > 0 && exercises.every((e) => e.completedToday);

  const handleFinishDay = async () => {
    await resetCompletionForRoutine(routine);
    await advanceRoutine();
    await load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{routine.name}</Text>
        <Text style={styles.headerSub}>
          {exercises.filter((e) => e.completedToday).length}/{exercises.length} logged
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {exercises.length === 0 ? (
          <Text style={styles.empty}>
            No exercises added for this day yet. Edit src/data/routines.js to fill it in.
          </Text>
        ) : (
          exercises.map((ex) => (
            <ExerciseCard key={ex.exerciseId} exercise={ex} onLog={handleLog} />
          ))
        )}
      </ScrollView>

      {exercises.length > 0 && (
        <TouchableOpacity
          style={[styles.finishButton, !allDone && styles.finishButtonDisabled]}
          disabled={!allDone}
          onPress={handleFinishDay}
        >
          <Text style={styles.finishText}>
            {allDone ? `Finish Day → ${ROUTINES[(routineIndex + 1) % ROUTINES.length].name}` : 'Log all exercises to finish'}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { color: colors.textPrimary, textAlign: 'center', marginTop: 40 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  headerSub: { color: colors.textSecondary, marginTop: 4 },
  list: { padding: 20, paddingBottom: 100 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  finishButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finishButtonDisabled: { backgroundColor: colors.cardBorder },
  finishText: { color: '#0A0A0A', fontWeight: '700', fontSize: 15 },
});
