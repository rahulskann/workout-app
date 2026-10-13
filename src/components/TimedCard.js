import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import ExerciseThumb from './ExerciseThumb';
import { makeStyles } from './cardStyles';
import { formatDuration } from '../utils/time';

const ADJUST_STEP = 5; // seconds, for fixing a timer you started or stopped late

// What the form opens with: today's times when editing them, otherwise zeros.
function startingTimes(exercise) {
  const todaySets = exercise.completedToday ? exercise.today?.sets : null;
  if (todaySets?.length) return todaySets.map((s) => ({ seconds: s.seconds || 0 }));
  return Array.from({ length: exercise.targetSets || 1 }, () => ({ seconds: 0 }));
}

function longest(sets) {
  return Math.max(0, ...(sets || []).map((s) => s.seconds || 0));
}

// Keeps the screen on while a set is being timed (rendered only then).
function KeepAwake() {
  useKeepAwake();
  return null;
}

// Card for timed exercises (planks, hangs, holds): each set has a stopwatch
// you start and stop, and the times are logged like weights would be.
export default function TimedCard({ exercise, onLog, onUndo, colors, alwaysShowForm, readOnly }) {
  const styles = makeStyles(colors);
  const local = makeTimerStyles(colors);
  const [expanded, setExpanded] = useState(false);
  const [sets, setSets] = useState(() => startingTimes(exercise));
  // The set being timed: its index, when it was started, and the time it
  // already had (Start after Stop carries on from there).
  const [running, setRunning] = useState(null);
  const [now, setNow] = useState(Date.now());

  const done = exercise.completedToday;
  const isOpen = !readOnly && (alwaysShowForm || expanded);
  const todaySets = done ? exercise.today?.sets || [] : [];
  const history = exercise.history || [];
  const lastSets = history[history.length - 1]?.sets || [];
  const best = Math.max(exercise.maxSeconds || 0, longest(todaySets));
  const lastTwoLabel = history.length
    ? history.map((h) => formatDuration(longest(h.sets))).join(', ')
    : '—';

  // Measured from the start time rather than counted, so it stays right even
  // if the phone locks or the app is in the background mid-set.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const secondsFor = (i) =>
    running?.index === i
      ? running.base + Math.floor((now - running.startedAt) / 1000)
      : sets[i]?.seconds || 0;

  // Stops the running set, if any, and returns the sets with its time saved.
  const stopTimer = () => {
    if (!running) return sets;
    const elapsed = running.base + Math.floor((Date.now() - running.startedAt) / 1000);
    const next = sets.map((s, i) => (i === running.index ? { seconds: elapsed } : s));
    setSets(next);
    setRunning(null);
    return next;
  };

  const toggleTimer = (i) => {
    if (running?.index === i) {
      stopTimer();
      return;
    }
    const current = stopTimer(); // only one set runs at a time
    const startedAt = Date.now();
    setRunning({ index: i, startedAt, base: current[i].seconds });
    setNow(startedAt);
  };

  const adjust = (i, delta) =>
    setSets((prev) => prev.map((s, j) => (j === i ? { seconds: Math.max(0, s.seconds + delta) } : s)));

  const addSet = () => setSets((prev) => [...prev, { seconds: 0 }]);

  const removeSet = (i) => {
    if (running) stopTimer();
    setSets((prev) => prev.filter((_, j) => j !== i));
  };

  const openForm = () => {
    if (!running) setSets(startingTimes(exercise));
    setExpanded(true);
  };

  const handleLog = () => {
    const final = stopTimer();
    if (final.length === 0 || final.some((s) => s.seconds < 1)) {
      Alert.alert('Time every set first', 'Tap Start on each set, then Stop when you finish it.');
      return;
    }
    onLog(exercise, { sets: final });
    setExpanded(false);
  };

  const handleUndo = () => {
    Alert.alert(
      `Undo ${exercise.name}?`,
      `Removes today's times (${todaySets.map((s) => formatDuration(s.seconds)).join(' · ')}).`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: () => {
            onUndo(exercise);
            setRunning(null);
            setExpanded(false);
            setSets(startingTimes({ ...exercise, completedToday: false }));
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      {running && <KeepAwake />}
      <View style={styles.row}>
        <ExerciseThumb exercise={exercise} colors={colors} />

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{exercise.name}</Text>
            {done ? <Text style={styles.check}>✓</Text> : null}
          </View>
          <View style={styles.metaRow}>
            {exercise.targetGroup ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{exercise.targetGroup}</Text>
              </View>
            ) : null}
            <Text style={styles.metaText}>
              {exercise.targetSets} {exercise.targetSets === 1 ? 'Set' : 'Sets'} · Timed
            </Text>
          </View>
          {running && !isOpen ? (
            <Text style={local.runningText}>⏱️ Set {running.index + 1}: {formatDuration(secondsFor(running.index))}</Text>
          ) : (
            <Text style={styles.statsText}>
              Best: {formatDuration(best)} · Last 2: {lastTwoLabel}
            </Text>
          )}
        </View>

        {!alwaysShowForm && !readOnly && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => (expanded ? setExpanded(false) : openForm())}
          >
            <Text style={styles.editButtonText}>{expanded ? '✕' : '⏱️'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isOpen && (
        <View style={styles.logForm}>
          {sets.map((_, i) => {
            const isRunning = running?.index === i;
            const seconds = secondsFor(i);
            return (
              <View key={i} style={styles.setBlock}>
                <View style={styles.setHeaderRow}>
                  <Text style={styles.setLabel}>
                    Set {i + 1}
                    {lastSets[i]?.seconds ? `  ·  last time ${formatDuration(lastSets[i].seconds)}` : ''}
                  </Text>
                  {i >= (exercise.targetSets || 1) && (
                    <TouchableOpacity onPress={() => removeSet(i)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={local.timerRow}>
                  <Text style={[local.time, isRunning && local.timeRunning]}>{formatDuration(seconds)}</Text>
                  <TouchableOpacity
                    style={[local.startButton, isRunning && local.stopButton]}
                    onPress={() => toggleTimer(i)}
                  >
                    <Text style={local.startButtonText}>
                      {isRunning ? 'Stop' : seconds > 0 ? 'Resume' : 'Start'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {!isRunning && (
                  <View style={local.adjustRow}>
                    <TouchableOpacity style={local.adjustButton} onPress={() => adjust(i, -ADJUST_STEP)}>
                      <Text style={local.adjustText}>−{ADJUST_STEP}s</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={local.adjustButton} onPress={() => adjust(i, ADJUST_STEP)}>
                      <Text style={local.adjustText}>+{ADJUST_STEP}s</Text>
                    </TouchableOpacity>
                    {seconds > 0 && (
                      <TouchableOpacity onPress={() => adjust(i, -seconds)}>
                        <Text style={local.resetText}>Reset</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

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

function makeTimerStyles(colors) {
  return StyleSheet.create({
    timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    time: {
      color: colors.textPrimary,
      fontSize: 32,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    timeRunning: { color: colors.success },
    startButton: {
      backgroundColor: colors.success,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 22,
      minWidth: 96,
      alignItems: 'center',
    },
    stopButton: { backgroundColor: colors.danger },
    startButtonText: { color: '#0A0A0A', fontWeight: '700', fontSize: 15 },
    adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    adjustButton: {
      height: 30,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.pill,
      justifyContent: 'center',
    },
    adjustText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    resetText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginLeft: 6 },
    runningText: { color: colors.success, fontSize: 12, fontWeight: '700', marginTop: 4 },
  });
}
