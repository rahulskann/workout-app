import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import VideoModal from './VideoModal';

export default function ExerciseCard({ exercise, onLog }) {
  const [expanded, setExpanded] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const history = exercise.history || [];
  const lastTwoLabel =
    history.length > 0 ? history.map((h) => `${h.weight}lbs`).join(', ') : '—';

  const handleLog = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r) return;
    onLog(exercise, { weight: w, reps: r });
    setWeight('');
    setReps('');
    setExpanded(false);
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

        <TouchableOpacity style={styles.logButton} onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.logButtonText}>{expanded ? '×' : '+'}</Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.logForm}>
          <TextInput
            style={styles.input}
            placeholder="Weight (lbs)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />
          <TextInput
            style={styles.input}
            placeholder="Reps"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={reps}
            onChangeText={setReps}
          />
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
  logForm: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  saveButtonText: { color: '#0A0A0A', fontWeight: '700' },
});
