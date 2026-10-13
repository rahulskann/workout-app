import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { getColors } from '../theme/colors';
import ExerciseThumb from './ExerciseThumb';
import TimedCard from './TimedCard';
import { makeStyles } from './cardStyles';

const WEIGHT_STEP = 5;
const REPS_STEP = 1;
const DEFAULT_REPS = 12;

// readOnly is for days you're previewing: stats and videos still work, but
// nothing can be ticked or logged until the day is made active.
export default function ExerciseCard({ exercise, onLog, onUndo, alwaysShowForm, readOnly }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);

  if (exercise.logType === 'checkbox') {
    return (
      <CheckboxCard
        exercise={exercise}
        onLog={onLog}
        onUndo={onUndo}
        colors={colors}
        readOnly={readOnly}
      />
    );
  }
  if (exercise.logType === 'timed') {
    return (
      <TimedCard
        exercise={exercise}
        onLog={onLog}
        onUndo={onUndo}
        colors={colors}
        alwaysShowForm={alwaysShowForm && !readOnly}
        readOnly={readOnly}
      />
    );
  }
  return (
    <WeightedCard
      exercise={exercise}
      onLog={onLog}
      onUndo={onUndo}
      colors={colors}
      alwaysShowForm={alwaysShowForm && !readOnly}
      readOnly={readOnly}
    />
  );
}

// ---------- Checkbox variant (warm-ups, cooldowns, mobility routines) ----------

function CheckboxCard({ exercise, onLog, onUndo, colors, readOnly }) {
  const styles = makeStyles(colors);

  return (
    <View style={[styles.card, exercise.completedToday && styles.cardDone]}>
      <View style={styles.row}>
        <ExerciseThumb exercise={exercise} colors={colors} />

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{exercise.name}</Text>
          <View style={styles.metaRow}>
            {exercise.targetGroup ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{exercise.targetGroup}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {!readOnly && (
          <TouchableOpacity
            style={[styles.checkbox, exercise.completedToday && styles.checkboxChecked]}
            // Tapping a ticked box unticks it, so a mis-tap is one tap to fix.
            onPress={() => (exercise.completedToday ? onUndo(exercise) : onLog(exercise, {}))}
          >
            {exercise.completedToday ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---------- Weighted variant (lifts) ----------

function makeDefaultSets(count) {
  return Array.from({ length: count }, () => ({ weight: 0, reps: DEFAULT_REPS }));
}

// What the log form opens with: today's numbers when editing them, otherwise
// last session's so you only adjust what changed, otherwise blanks.
function startingSets(exercise) {
  const todaySets = exercise.completedToday ? exercise.today?.sets : null;
  const lastSets = exercise.history?.[exercise.history.length - 1]?.sets;
  const source = todaySets?.length ? todaySets : lastSets?.length ? lastSets : null;
  return source ? source.map((s) => ({ ...s })) : makeDefaultSets(exercise.targetSets);
}

// A set counts as already "touched" if it differs from Set 1, so nudging
// Set 1 doesn't flatten a pre-filled drop set.
function touchedFrom(sets, field) {
  return sets.map((s, i) => i > 0 && s[field] !== sets[0][field]);
}

function formatSets(sets) {
  return sets.map((s) => `${s.weight}×${s.reps}`).join(' · ');
}

function WeightedCard({ exercise, onLog, onUndo, colors, alwaysShowForm, readOnly }) {
  const styles = makeStyles(colors);
  const [expanded, setExpanded] = useState(false);
  const [sets, setSets] = useState(() => startingSets(exercise));
  // touched*[0] is unused -- Set 1 always drives the others until they're
  // individually nudged, same rule for both weight and reps.
  const [touchedWeight, setTouchedWeight] = useState(() => touchedFrom(sets, 'weight'));
  const [touchedReps, setTouchedReps] = useState(() => touchedFrom(sets, 'reps'));

  const done = exercise.completedToday;
  const isOpen = !readOnly && (alwaysShowForm || expanded);
  const originalSetCount = exercise.targetSets;
  const todaySets = done ? exercise.today?.sets || [] : [];

  const history = exercise.history || [];
  const lastTwoLabel =
    history.length > 0
      ? history.map((h) => `${Math.max(...(h.sets || []).map((s) => s.weight))}lbs`).join(', ')
      : '—';
  // Today's sets only join history when the day ends, but a new PR should
  // show the moment you log it.
  const pr = Math.max(exercise.maxWeight || 0, ...todaySets.map((s) => s.weight));

  const loadForm = (next) => {
    setSets(next);
    setTouchedWeight(touchedFrom(next, 'weight'));
    setTouchedReps(touchedFrom(next, 'reps'));
  };

  const openForm = () => {
    loadForm(startingSets(exercise));
    setExpanded(true);
  };

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

  const handleLog = () => {
    // 0 lbs is a real value: push-ups, squat jumps, dips etc. are bodyweight.
    if (sets.length === 0 || sets.some((s) => s.reps < 1)) return;
    onLog(exercise, { sets });
    setExpanded(false);
  };

  const handleUndo = () => {
    Alert.alert(`Undo ${exercise.name}?`, `Removes today's sets (${formatSets(todaySets)}).`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Undo',
        style: 'destructive',
        onPress: () => {
          onUndo(exercise);
          setExpanded(false);
          // Back to last session's numbers for the always-visible form.
          loadForm(startingSets({ ...exercise, completedToday: false }));
        },
      },
    ]);
  };

  return (
    <View style={[styles.card, exercise.completedToday && styles.cardDone]}>
      <View style={styles.row}>
        <ExerciseThumb exercise={exercise} colors={colors} />

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{exercise.name}</Text>
            {exercise.completedToday ? <Text style={styles.check}>✓</Text> : null}
          </View>
          <View style={styles.metaRow}>
            {exercise.targetGroup ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{exercise.targetGroup}</Text>
              </View>
            ) : null}
            <Text style={styles.metaText}>{exercise.targetSets} Sets</Text>
          </View>
          <Text style={styles.statsText}>
            PR: {pr} lbs · Last 2: {lastTwoLabel}
          </Text>
        </View>

        {/* Tapping the pencil on a logged exercise reopens it with today's
            numbers; saving replaces them rather than adding a second session. */}
        {!alwaysShowForm && !readOnly && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => (expanded ? setExpanded(false) : openForm())}
          >
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

          <View style={styles.formLinksRow}>
            <TouchableOpacity onPress={addSet}>
              <Text style={styles.addSetText}>+ Add Set</Text>
            </TouchableOpacity>
            {done && (
              <TouchableOpacity onPress={handleUndo}>
                <Text style={styles.undoText}>Undo log</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleLog}>
            <Text style={styles.saveButtonText}>{done ? 'Save Changes' : 'Log'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
