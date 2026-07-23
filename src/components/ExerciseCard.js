import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import VideoModal from './VideoModal';

const WEIGHT_STEP = 5;

export default function ExerciseCard({ exercise, onLog }) {
  if (exercise.logType === 'checkbox') {
    return <CheckboxCard exercise={exercise} onLog={onLog} />;
  }
  return <WeightedCard exercise={exercise} onLog={onLog} />;
}

// ---------- Checkbox variant (warm-ups, cooldowns, mobility routines) ----------

function CheckboxCard({ exercise, onLog }) {
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

function WeightedCard({ exercise, onLog }) {
  const [expanded, setExpanded] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [reps, setReps] = useState('12');
  const [masterWeight, setMasterWeight] = useState('');
  const [setWeights, setSetWeights] = useState(Array(exercise.targetSets).fill(''));
  const [touched, setTouched] = useState(Array(exercise.targetSets).fill(false));

  const history = exercise.history || [];
  const lastTwoLabel =
    history.length > 0
      ? history.map((h) => `${Math.max(...h.sets)}lbs`).join(', ')
      : '—';

  // Typing in the master field fills every set that hasn't been
  // individually nudged -- ease-of-use default, no retyping per set.
  const handleMasterWeightChange = (val) => {
    setMasterWeight(val);
    setSetWeights((prev) => prev.map((w, i) => (touched[i] ? w : val)));
  };

  const displayValueForSet = (idx) => {
    const raw = setWeights[idx] || masterWeight;
    return raw ? parseFloat(raw) : 0;
  };

  const nudgeSet = (idx, direction) => {
    const current = displayValueForSet(idx);
    const next = Math.max(0, current + direction * WEIGHT_STEP);
    setSetWeights((prev) => prev.map((w, i) => (i === idx ? String(next) : w)));
    setTouched((prev) => prev.map((t, i) => (i === idx ? true : t)));
  };

  const resetForm = () => {
    setReps('12');
    setMasterWeight('');
    setSetWeights(Array(exercise.targetSets).fill(''));
    setTouched(Array(exercise.targetSets).fill(false));
    setExpanded(false);
  };

  const handleLog = () => {
    const repsNum = parseInt(reps, 10);
    const setsNum = setWeights.map((w, i) => parseFloat(w || masterWeight));
    if (!repsNum || setsNum.some((w) => !w)) return;
    onLog(exercise, { reps: repsNum, sets: setsNum });
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

        <TouchableOpacity style={styles.editButton} onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.editButtonText}>{expanded ? '✕' : '✏️'}</Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.logForm}>
          <View style={styles.formRow}>
            <TextInput
              style={styles.input}
              placeholder="Reps"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={reps}
              onChangeText={setReps}
            />
            <TextInput
              style={styles.input}
              placeholder="Weight (all sets)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={masterWeight}
              onChangeText={handleMasterWeightChange}
            />
          </View>

          {exercise.targetSets > 1 && (
            <View style={styles.perSetWrap}>
              {setWeights.map((_, i) => (
                <View key={i} style={styles.perSetRow}>
                  <Text style={styles.perSetLabel}>Set {i + 1}</Text>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => nudgeSet(i, -1)}
                  >
                    <Text style={styles.stepButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.perSetValue}>{displayValueForSet(i) || 0} lbs</Text>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => nudgeSet(i, 1)}
                  >
                    <Text style={styles.stepButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

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

const styles = StyleSheet.create({
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
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
  },
  perSetWrap: { marginTop: 10 },
  perSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  perSetLabel: { color: colors.textSecondary, fontSize: 12, width: 44 },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  perSetValue: {
    color: colors.textPrimary,
    fontSize: 13,
    width: 70,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { color: '#0A0A0A', fontWeight: '700' },
});
