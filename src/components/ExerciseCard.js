import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { getColors } from '../theme/colors';
import VideoModal from './VideoModal';

const WEIGHT_STEP = 5;
const REPS_STEP = 1;

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

function WeightedCard({ exercise, onLog, colors, alwaysShowForm }) {
  const styles = makeStyles(colors);
  const [expanded, setExpanded] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [reps, setReps] = useState(12);
  const [setWeights, setSetWeights] = useState(Array(exercise.targetSets).fill(0));
  // touched[0] is unused -- Set 1 is always the driver. touched[i] for i>0
  // means that set was individually nudged and should stop mirroring Set 1.
  const [touched, setTouched] = useState(Array(exercise.targetSets).fill(false));

  const isOpen = alwaysShowForm || expanded;

  const history = exercise.history || [];
  const lastTwoLabel =
    history.length > 0
      ? history.map((h) => `${Math.max(...(h.sets || [h.weight || 0]))}lbs`).join(', ')
      : '—';

  const nudgeReps = (direction) => {
    setReps((prev) => Math.max(1, prev + direction * REPS_STEP));
  };

  const nudgeSet = (idx, direction) => {
    if (idx === 0) {
      // Set 1 drives every set that hasn't been individually touched.
      setSetWeights((prev) => {
        const nextSet1 = Math.max(0, prev[0] + direction * WEIGHT_STEP);
        return prev.map((w, i) => (i === 0 || !touched[i] ? nextSet1 : w));
      });
    } else {
      setSetWeights((prev) =>
        prev.map((w, i) => (i === idx ? Math.max(0, w + direction * WEIGHT_STEP) : w))
      );
      setTouched((prev) => prev.map((t, i) => (i === idx ? true : t)));
    }
  };

  const resetForm = () => {
    setReps(12);
    setSetWeights(Array(exercise.targetSets).fill(0));
    setTouched(Array(exercise.targetSets).fill(false));
    if (!alwaysShowForm) setExpanded(false);
  };

  const handleLog = () => {
    if (!reps || setWeights.some((w) => !w)) return;
    onLog(exercise, { reps, sets: setWeights });
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
          <View style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>Reps</Text>
            <TouchableOpacity style={styles.stepButton} onPress={() => nudgeReps(-1)}>
              <Text style={styles.stepButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{reps}</Text>
            <TouchableOpacity style={styles.stepButton} onPress={() => nudgeReps(1)}>
              <Text style={styles.stepButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.perSetWrap}>
            {setWeights.map((w, i) => (
              <View key={i} style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Set {i + 1}</Text>
                <TouchableOpacity style={styles.stepButton} onPress={() => nudgeSet(i, -1)}>
                  <Text style={styles.stepButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{w} lbs</Text>
                <TouchableOpacity style={styles.stepButton} onPress={() => nudgeSet(i, 1)}>
                  <Text style={styles.stepButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

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
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    stepperLabel: { color: colors.textSecondary, fontSize: 12, width: 44 },
    stepButton: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
    stepperValue: {
      color: colors.textPrimary,
      fontSize: 13,
      width: 70,
      textAlign: 'center',
    },
    perSetWrap: { marginTop: 2 },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 9,
      alignItems: 'center',
      marginTop: 6,
    },
    saveButtonText: { color: '#0A0A0A', fontWeight: '700' },
  });
}
