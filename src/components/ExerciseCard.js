import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { getColors } from '../theme/colors';
import VideoModal from './VideoModal';

const WEIGHT_STEP = 5;
const REPS_STEP = 1;
const DEFAULT_REPS = 12;

export default function ExerciseCard({ exercise, onLog, alwaysShowForm }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);

  if (exercise.logType === 'checkbox') {
    return <CheckboxCard exercise={exercise} onLog={onLog} colors={colors} />;
  }
  return (
    <WeightedCard
      exercise={exercise}
      onLog={onLog}
      colors={colors}
      alwaysShowForm={alwaysShowForm}
    />
  );
}

// ---------- Checkbox variant (warm-ups, cooldowns, mobility routines) ----------

function CheckboxCard({ exercise, onLog, colors }) {
  const styles = makeStyles(colors);
  const [videoVisible, setVideoVisible] = useState(false);

  return (
    <View style={[styles.card, exercise.completedToday && styles.cardDone]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.thumb}
          onPress={() => setVideoVisible(true)}
          disabled={!exercise.videoUri}
        >
          <Text style={styles.thumbIcon}>▶</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{exercise.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{exercise.targetGroup}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.checkbox, exercise.completedToday && styles.checkboxChecked]}
          onPress={() => onLog(exercise, {})}
          disabled={exercise.completedToday}
        >
          {exercise.completedToday ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </TouchableOpacity>
      </View>

      <VideoModal
        visible={videoVisible}
        onClose={() => setVideoVisible(false)}
        videoUri={exercise.videoUri}
      />
    </View>
  );
}

// ---------- Weighted variant (lifts) ----------

function makeDefaultSets(count) {
  return Array.from({ length: count }, () => ({ weight: 0, reps: DEFAULT_REPS }));
}

function WeightedCard({ exercise, onLog, colors, alwaysShowForm }) {
  const styles = makeStyles(colors);
  const [expanded, setExpanded] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [sets, setSets] = useState(makeDefaultSets(exercise.targetSets));
  // touched*[0] is unused -- Set 1 always drives the others until they're
  // individually nudged, same rule for both weight and reps.
  const [touchedWeight, setTouchedWeight] = useState(Array(exercise.targetSets).fill(false));
  const [touchedReps, setTouchedReps] = useState(Array(exercise.targetSets).fill(false));

  const isOpen = alwaysShowForm || expanded;
  const originalSetCount = exercise.targetSets;

  const history = exercise.history || [];
  const lastTwoLabel =
    history.length > 0
      ? history.map((h) => `${Math.max(...(h.sets || []).map((s) => s.weight))}lbs`).join(', ')
      : '—';

  const nudgeWeight = (idx, direction) => {
    if (idx === 0) {
      setSets((prev) => {
        const next = Math.max(0, prev[0].weight + direction * WEIGHT_STEP);
        return prev.map((s, i) => (i === 0 || !touchedWeight[i] ? { ...s, weight: next } : s));
      });
    } else {
      setSets((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, weight: Math.max(0, s.weight + direction * WEIGHT_STEP) } : s
        )
      );
      setTouchedWeight((prev) => prev.map((t, i) => (i === idx ? true : t)));
    }
  };

  const nudgeReps = (idx, direction) => {
    if (idx === 0) {
      setSets((prev) => {
        const next = Math.max(1, prev[0].reps + direction * REPS_STEP);
        return prev.map((s, i) => (i === 0 || !touchedReps[i] ? { ...s, reps: next } : s));
      });
    } else {
      setSets((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, reps: Math.max(1, s.reps + direction * REPS_STEP) } : s
        )
      );
      setTouchedReps((prev) => prev.map((t, i) => (i === idx ? true : t)));
    }
  };

  const addSet = () => {
    setSets((prev) => [...prev, { weight: prev[0]?.weight ?? 0, reps: prev[0]?.reps ?? DEFAULT_REPS }]);
    setTouchedWeight((prev) => [...prev, false]);
    setTouchedReps((prev) => [...prev, false]);
  };

  const removeSet = (idx) => {
    setSets((prev) => prev.filter((_, i) => i !== idx));
    setTouchedWeight((prev) => prev.filter((_, i) => i !== idx));
    setTouchedReps((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setSets(makeDefaultSets(exercise.targetSets));
    setTouchedWeight(Array(exercise.targetSets).fill(false));
    setTouchedReps(Array(exercise.targetSets).fill(false));
    if (!alwaysShowForm) setExpanded(false);
  };

  const handleLog = () => {
    if (sets.length === 0 || sets.some((s) => !s.weight || !s.reps)) return;
    onLog(exercise, { sets });
    resetForm();
  };

  return (
    <View style={[styles.card, exercise.completedToday && styles.cardDone]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.thumb}
          onPress={() => setVideoVisible(true)}
          disabled={!exercise.videoUri}
        >
          <Text style={styles.thumbIcon}>▶</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{exercise.name}</Text>
            {exercise.completedToday ? <Text style={styles.check}>✓</Text> : null}
          </View>
          <View style={styles.metaRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{exercise.targetGroup}</Text>
            </View>
            <Text style={styles.metaText}>{exercise.targetSets} Sets</Text>
          </View>
          <Text style={styles.statsText}>
            PR: {exercise.maxWeight || 0} lbs · Last 2: {lastTwoLabel}
          </Text>
        </View>

        {!alwaysShowForm && (
          <TouchableOpacity style={styles.editButton} onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.editButtonText}>{expanded ? '✕' : '✏️'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isOpen && (
        <View style={styles.logForm}>
          {sets.map((s, i) => (
            <View key={i} style={styles.setBlock}>
              <View style={styles.setHeaderRow}>
                <Text style={styles.setLabel}>Set {i + 1}</Text>
                {i >= originalSetCount && (
                  <TouchableOpacity onPress={() => removeSet(i)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.setRow}>
                <View style={styles.stepperGroup}>
                  <Text style={styles.stepperMiniLabel}>Reps</Text>
                  <TouchableOpacity style={styles.stepButton} onPress={() => nudgeReps(i, -1)}>
                    <Text style={styles.stepButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{s.reps}</Text>
                  <TouchableOpacity style={styles.stepButton} onPress={() => nudgeReps(i, 1)}>
                    <Text style={styles.stepButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.stepperGroup}>
                  <Text style={styles.stepperMiniLabel}>Weight</Text>
                  <TouchableOpacity style={styles.stepButton} onPress={() => nudgeWeight(i, -1)}>
                    <Text style={styles.stepButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{s.weight} lbs</Text>
                  <TouchableOpacity style={styles.stepButton} onPress={() => nudgeWeight(i, 1)}>
                    <Text style={styles.stepButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addSetButton} onPress={addSet}>
            <Text style={styles.addSetText}>+ Add Set</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleLog}>
            <Text style={styles.saveButtonText}>Log</Text>
          </TouchableOpacity>
        </View>
      )}

      <VideoModal
        visible={videoVisible}
        onClose={() => setVideoVisible(false)}
        videoUri={exercise.videoUri}
      />
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
      marginBottom: 12,
    },
    cardDone: {
      borderColor: colors.success,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    thumbIcon: { color: colors.accent, fontSize: 16 },
    titleRow: { flexDirection: 'row', alignItems: 'center' },
    title: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
    check: { color: colors.success, marginLeft: 8, fontWeight: '700' },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    pill: {
      backgroundColor: colors.pill,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginRight: 8,
    },
    pillText: { color: colors.textSecondary, fontSize: 12 },
    metaText: { color: colors.textSecondary, fontSize: 12 },
    statsText: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
    editButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    editButtonText: { fontSize: 14 },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    checkboxChecked: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    checkboxMark: { color: '#0A0A0A', fontWeight: '700' },
    logForm: {
      marginTop: 12,
    },
    setBlock: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
    },
    setHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    setLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    removeText: { color: colors.danger, fontSize: 11 },
    setRow: { flexDirection: 'row', gap: 16 },
    stepperGroup: { flexDirection: 'row', alignItems: 'center' },
    stepperMiniLabel: { color: colors.textSecondary, fontSize: 11, width: 40 },
    stepButton: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: colors.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    stepperValue: {
      color: colors.textPrimary,
      fontSize: 13,
      width: 56,
      textAlign: 'center',
    },
    addSetButton: {
      alignSelf: 'flex-start',
      marginBottom: 10,
    },
    addSetText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 9,
      alignItems: 'center',
    },
    saveButtonText: { color: '#0A0A0A', fontWeight: '700' },
  });
}
