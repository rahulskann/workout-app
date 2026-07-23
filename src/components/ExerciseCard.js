import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import VideoModal from './VideoModal';

// Top (max) weight logged in a single past session - used for the
// "Last 2" quick-stat line.
function sessionTopWeight(entry) {
  if (!entry || !entry.sets || entry.sets.length === 0) return 0;
  return Math.max(...entry.sets.map((s) => s.weight));
}

export default function ExerciseCard({ exercise, onLog }) {
  const targetSets = exercise.targetSets || 1;
  const [expanded, setExpanded] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [weights, setWeights] = useState(() => Array(targetSets).fill(''));
  const [overridden, setOverridden] = useState(() => Array(targetSets).fill(false));
  const [reps, setReps] = useState('12');

  const history = exercise.history || [];
  const lastTwoLabel =
    history.length > 0 ? history.map((h) => `${sessionTopWeight(h)}lbs`).join(', ') : '—';

  // Set 1's field acts as the "default" - typing into it fills every set
  // that hasn't been individually edited yet. Editing a later set's field
  // directly only changes that one field (it "detaches" from the default),
  // so you only need to touch the sets that actually differ.
  const handleSetWeightChange = (index, value) => {
    if (index === 0) {
      setWeights((prev) => prev.map((w, i) => (overridden[i] ? w : value)));
    } else {
      setOverridden((prev) => prev.map((o, i) => (i === index ? true : o)));
      setWeights((prev) => prev.map((w, i) => (i === index ? value : w)));
    }
  };

  const resetForm = () => {
    setWeights(Array(targetSets).fill(''));
    setOverridden(Array(targetSets).fill(false));
    setReps('12');
    setExpanded(false);
  };

  const handleLog = () => {
    const r = parseInt(reps, 10);
    const parsedWeights = weights.map((w) => parseFloat(w));
    if (!r || parsedWeights.some((w) => !w && w !== 0)) return;
    onLog(exercise, { sets: parsedWeights.map((weight) => ({ weight, reps: r })) });
    resetForm();
  };

  const handleToggleDone = () => {
    onLog(exercise, { done: true });
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
          {!exercise.noWeight && (
            <Text style={styles.statsText}>
              PR: {exercise.maxWeight || 0} lbs · Last 2: {lastTwoLabel}
            </Text>
          )}
        </View>

        {exercise.noWeight ? (
          <TouchableOpacity
            style={[styles.checkbox, exercise.completedToday && styles.checkboxChecked]}
            onPress={handleToggleDone}
          >
            {exercise.completedToday ? <Text style={styles.checkmark}>✓</Text> : null}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.logButton} onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.logButtonText}>{expanded ? '×' : '+'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {expanded && !exercise.noWeight && (
        <View style={styles.logForm}>
          {Array.from({ length: targetSets }).map((_, i) => (
            <View key={i} style={styles.setRow}>
              <Text style={styles.setLabel}>Set {i + 1}</Text>
              <TextInput
                style={styles.setInput}
                placeholder="Weight"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={weights[i]}
                onChangeText={(v) => handleSetWeightChange(i, v)}
              />
            </View>
          ))}
          <View style={styles.repsRow}>
            <TextInput
              style={styles.input}
              placeholder="Reps (all sets)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={reps}
              onChangeText={setReps}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleLog}>
              <Text style={styles.saveButtonText}>Log</Text>
            </TouchableOpacity>
          </View>
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
  logButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  logButtonText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: { color: '#0A0A0A', fontWeight: '700' },
  logForm: {
    marginTop: 12,
    gap: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setLabel: { color: colors.textSecondary, fontSize: 12, width: 44 },
  setInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  repsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
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
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  saveButtonText: { color: '#0A0A0A', fontWeight: '700' },
});
