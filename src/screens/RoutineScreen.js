import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { ROUTINES } from '../data/routines';
import {
  getRoutineIndex,
  getExercisesForRoutine,
  logSession,
  advanceRoutine,
  setRoutineIndex as persistRoutineIndex,
  resetCompletionForRoutine,
} from '../storage/storage';
import ExerciseCard from '../components/ExerciseCard';
import DaySelectorBar from '../components/DaySelectorBar';
import { useSettings } from '../context/SettingsContext';
import { getColors } from '../theme/colors';

export default function RoutineScreen({ onOpenSettings }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeStyles(colors);

  // activeIndex = the persisted "current" day (what Finish Day advances from).
  // viewedIndex = whatever day is currently on screen -- browsing doesn't
  // touch activeIndex at all, so you can look ahead freely.
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewedIndex, setViewedIndex] = useState(0);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  const viewedRoutine = ROUTINES[viewedIndex];
  const isViewingActive = viewedIndex === activeIndex;

  const loadExercisesFor = useCallback(async (idx) => {
    const withState = await getExercisesForRoutine(ROUTINES[idx]);
    setExercises(withState);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const idx = await getRoutineIndex();
    setActiveIndex(idx);
    setViewedIndex(idx);
    await loadExercisesFor(idx);
    setLoading(false);
  }, [loadExercisesFor]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectDay = async (idx) => {
    setViewedIndex(idx);
    await loadExercisesFor(idx);
  };

  const handleLog = async (exercise, payload) => {
    await logSession({ ...exercise, routineName: viewedRoutine.name }, payload);
    await loadExercisesFor(viewedIndex);
  };

  const allDone = exercises.length > 0 && exercises.every((e) => e.completedToday);

  const handleFinishDay = async () => {
    await resetCompletionForRoutine(viewedRoutine);
    const next = await advanceRoutine();
    setActiveIndex(next);
    setViewedIndex(next);
    await loadExercisesFor(next);
  };

  const handleSetActive = () => {
    Alert.alert(
      'Set as active day?',
      `Make ${viewedRoutine.name} your active day? "Finish Day" will advance from here next time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Active',
          onPress: async () => {
            await persistRoutineIndex(viewedIndex);
            setActiveIndex(viewedIndex);
          },
        },
      ]
    );
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
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.headerTitle}>{viewedRoutine.name}</Text>
          {!isViewingActive && <Text style={styles.previewTag}>Previewing · not your active day</Text>}
        </View>
        <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <DaySelectorBar
        routines={ROUTINES}
        viewedIndex={viewedIndex}
        activeIndex={activeIndex}
        onSelect={handleSelectDay}
        colors={colors}
      />

      <Text style={styles.headerSub}>
        {exercises.filter((e) => e.completedToday).length}/{exercises.length} logged
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {exercises.length === 0 ? (
          <Text style={styles.empty}>
            No exercises added for this day yet. Edit src/data/routines.js to fill it in.
          </Text>
        ) : (
          exercises.map((ex) => (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={ex}
              onLog={handleLog}
              alwaysShowForm={settings.logFormMode === 'always'}
            />
          ))
        )}
      </ScrollView>

      {exercises.length > 0 && (
        <>
          {isViewingActive ? (
            <TouchableOpacity
              style={[styles.finishButton, !allDone && styles.finishButtonDisabled]}
              disabled={!allDone}
              onPress={handleFinishDay}
            >
              <Text style={styles.finishText}>
                {allDone
                  ? `Finish Day → ${ROUTINES[(viewedIndex + 1) % ROUTINES.length].name}`
                  : 'Log all exercises to finish'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.setActiveButton} onPress={handleSetActive}>
              <Text style={styles.setActiveText}>Set as Active Day</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    loading: { color: colors.textPrimary, textAlign: 'center', marginTop: 40 },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) + 16 : 20,
      paddingBottom: 4,
    },
    headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
    previewTag: { color: colors.accent, fontSize: 12, fontWeight: '600', marginTop: 4 },
    settingsButton: { padding: 6 },
    settingsIcon: { fontSize: 20 },
    headerSub: { color: colors.textSecondary, paddingHorizontal: 20, marginTop: 10 },
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
    setActiveButton: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    setActiveText: { color: '#0A0A0A', fontWeight: '700', fontSize: 15 },
  });
}
