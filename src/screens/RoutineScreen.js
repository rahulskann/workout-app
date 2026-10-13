import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getExercisesForRoutine,
  logSession,
  clearToday,
  flushPendingExports,
} from '../storage/storage';
import ExerciseCard from '../components/ExerciseCard';
import DaySelectorBar from '../components/DaySelectorBar';
import { useSettings } from '../context/SettingsContext';
import { usePlans } from '../context/PlanContext';
import { getColors } from '../theme/colors';

export default function RoutineScreen({ navigation }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { loaded, activePlan, activeDayIndex, activeVisitId, setActiveDayIndex, advanceDay } =
    usePlans();

  // activeDayIndex = the persisted "current" day (what Finish Day advances from).
  // viewedIndex = whatever day you've tapped to browse; null means "follow the
  // active day", so browsing ahead never touches your place in the cycle.
  const [viewedIndex, setViewedIndex] = useState(null);
  // Exercises are tagged with the day they were loaded for, so switching days
  // never briefly shows the previous day's list under the new day's name.
  const [loadedFor, setLoadedFor] = useState({ key: null, exercises: [] });
  const [reloadToken, setReloadToken] = useState(0);

  // A different plan has different days, so stop browsing the old one.
  useEffect(() => {
    setViewedIndex(null);
  }, [activePlan?.id]);

  const days = activePlan?.days || [];
  const shownIndex = Math.min(viewedIndex ?? activeDayIndex, Math.max(days.length - 1, 0));
  const viewedDay = days[shownIndex] || null;
  const isViewingActive = shownIndex === activeDayIndex;
  // Only the active day's current visit has ticks; previews are look-only.
  const visitId = isViewingActive ? activeVisitId : null;
  const dayKey = viewedDay ? `${activePlan.id}/${viewedDay.id}/${visitId}` : null;
  const exercisesReady = loadedFor.key === dayKey;
  const exercises = exercisesReady ? loadedFor.exercises : [];

  // Retry any Sheets exports that couldn't go out last time (e.g. offline).
  useEffect(() => {
    flushPendingExports();
  }, []);

  useEffect(() => {
    if (!viewedDay) return undefined;
    let cancelled = false;
    getExercisesForRoutine(viewedDay, visitId).then((list) => {
      if (!cancelled) setLoadedFor({ key: dayKey, exercises: list });
    });
    return () => {
      cancelled = true;
    };
  }, [viewedDay, visitId, dayKey, reloadToken]);

  const reload = () => setReloadToken((t) => t + 1);

  const handleSelectDay = (idx) => setViewedIndex(idx === activeDayIndex ? null : idx);

  const handleLog = async (exercise, payload) => {
    try {
      await logSession({ ...exercise, routineName: viewedDay.name }, payload, activeVisitId);
    } catch (e) {
      Alert.alert("Couldn't save that", e?.message || 'Something went wrong saving this exercise.');
    }
    reload();
  };

  const handleUndo = async (exercise) => {
    try {
      await clearToday(exercise, activeVisitId);
    } catch (e) {
      Alert.alert("Couldn't undo that", e?.message || 'Something went wrong.');
    }
    reload();
  };

  const allDone = exercises.length > 0 && exercises.every((e) => e.completedToday);

  // Both of these start a new visit, so the day you leave starts clean next
  // time while its logged sessions stay in history (and the Sheets queue).
  const handleFinishDay = async () => {
    await advanceDay();
    setViewedIndex(null);
  };

  const handleSetActive = () => {
    Alert.alert(
      'Set as active day?',
      `Make ${viewedDay.name} your active day? "Finish Day" will advance from here next time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Active',
          onPress: async () => {
            await setActiveDayIndex(shownIndex);
            setViewedIndex(null);
          },
        },
      ]
    );
  };

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (!viewedDay) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{activePlan?.name || 'No plan yet'}</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.empty}>This plan doesn't have any days yet.</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Plans')}>
          <Text style={styles.emptyButtonText}>Open Plans</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    // Bottom edge is left out on purpose: the list and the floating button add
    // insets.bottom themselves so they clear the gesture bar.
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Plans')}>
            <Text style={styles.planName}>{activePlan.name} ›</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{viewedDay.name}</Text>
          {!isViewingActive && <Text style={styles.previewTag}>Previewing · not your active day</Text>}
        </View>
        <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <DaySelectorBar
        routines={days}
        viewedIndex={shownIndex}
        activeIndex={activeDayIndex}
        onSelect={handleSelectDay}
        colors={colors}
      />

      <Text style={styles.headerSub}>
        {exercises.filter((e) => e.completedToday).length}/{exercises.length} logged
      </Text>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: 100 + insets.bottom }]}>
        {!exercisesReady ? null : exercises.length === 0 ? (
          <Text style={styles.empty}>No exercises added for this day yet.</Text>
        ) : (
          exercises.map((ex) => (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={ex}
              onLog={handleLog}
              onUndo={handleUndo}
              alwaysShowForm={settings.logFormMode === 'always'}
              readOnly={!isViewingActive}
            />
          ))
        )}
      </ScrollView>

      {exercises.length > 0 && (
        <>
          {isViewingActive ? (
            <TouchableOpacity
              style={[
                styles.finishButton,
                { bottom: 20 + insets.bottom },
                !allDone && styles.finishButtonDisabled,
              ]}
              disabled={!allDone}
              onPress={handleFinishDay}
            >
              <Text style={styles.finishText}>
                {allDone
                  ? `Finish Day → ${days[(shownIndex + 1) % days.length].name}`
                  : 'Log all exercises to finish'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.setActiveButton, { bottom: 20 + insets.bottom }]}
              onPress={handleSetActive}
            >
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
      paddingTop: 16,
      paddingBottom: 4,
    },
    planName: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 2 },
    headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
    previewTag: { color: colors.accent, fontSize: 12, fontWeight: '600', marginTop: 4 },
    settingsButton: { padding: 6 },
    settingsIcon: { fontSize: 20 },
    headerSub: { color: colors.textSecondary, paddingHorizontal: 20, marginTop: 10 },
    list: { padding: 20, paddingBottom: 100 },
    empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
    emptyButton: {
      alignSelf: 'center',
      marginTop: 16,
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    emptyButtonText: { color: '#0A0A0A', fontWeight: '700' },
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
