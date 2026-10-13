import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { usePlans } from '../context/PlanContext';
import { getColors } from '../theme/colors';
import { makeScreenStyles } from '../theme/screenStyles';
import { newId } from '../storage/plans';
import { pickPhoto, pickVideo } from '../services/media';
import { parseYouTubeUrl, youTubeThumbnail } from '../services/youtube';
import MediaModal from '../components/MediaModal';
import {
  DEFAULT_EXERCISE,
  addExercise,
  updateExercise,
  removeExercise,
} from '../storage/planEdits';

const COMMON_GROUPS = [
  'Chest',
  'Back',
  'Lats',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
  'Stretching',
];
const MAX_SETS = 10;

const LOG_TYPE_CHOICES = [
  { type: 'weights', label: 'Weight & reps' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'timed', label: 'Timed' },
];

const LOG_TYPE_HINTS = {
  weights: 'Log weight and reps for each set. Use 0 lbs for bodyweight moves.',
  checkbox: 'Just tick it off: good for warm-ups, stretches and mobility.',
  timed: 'A stopwatch for each set: tap Start, then Stop when you finish. Good for planks, hangs and holds; your longest time is tracked like a PR.',
};

function confirmLargeVideo(sizeMb) {
  const size = sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(1)} GB` : `${sizeMb} MB`;
  return new Promise((resolve) =>
    Alert.alert('Large video', `This video is ${size} and will take that much space on your phone.`, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Keep it', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  );
}

// Add a new exercise to a day (exerciseId null) or edit an existing one.
// Nothing is saved until you tap Save.
export default function ExerciseEditorScreen({ navigation, route }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeScreenStyles(colors);
  const local = makeStyles(colors);
  const { plans, editPlan } = usePlans();
  const { planId, dayId, exerciseId } = route.params;
  const day = plans.find((p) => p.id === planId)?.days.find((d) => d.id === dayId);
  const existing = exerciseId ? day?.exercises.find((ex) => ex.exerciseId === exerciseId) : null;

  const [form, setForm] = useState(() => ({ ...DEFAULT_EXERCISE, ...existing }));
  const set = (changes) => setForm((f) => ({ ...f, ...changes }));
  const isCheckbox = form.logType === 'checkbox';
  const [busy, setBusy] = useState(null); // 'photo' | 'video' while saving one
  const [previewing, setPreviewing] = useState(null); // 'photo' | 'video' | 'youtube'
  const youtube = parseYouTubeUrl(form.videoUrl);

  // Media is picked into the form like any other field and only kept if you
  // tap Save; files that end up unused are cleaned up on the next launch.
  const addMedia = async (kind, source) => {
    setBusy(kind);
    try {
      const uri =
        kind === 'photo' ? await pickPhoto(source) : await pickVideo(source, confirmLargeVideo);
      if (uri) set(kind === 'photo' ? { photoUri: uri } : { videoUri: uri });
    } catch (e) {
      Alert.alert(`Couldn't add that ${kind}`, e?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  if (!day || (exerciseId && !existing)) return null; // deleted while open

  const handleSave = async () => {
    const name = (form.name || '').trim();
    if (!name) {
      Alert.alert('Name needed', 'Give the exercise a name first.');
      return;
    }
    const videoUrl = (form.videoUrl || '').trim();
    if (videoUrl && !youtube) {
      Alert.alert(
        "That link didn't work",
        'Paste a link to a single YouTube video, like youtube.com/watch?v=… or youtu.be/…'
      );
      return;
    }
    const fields = {
      name,
      targetGroup: (form.targetGroup || '').trim(),
      logType: form.logType,
      photoUri: form.photoUri || null,
      videoUri: form.videoUri || null,
      videoUrl: videoUrl || null,
      // Kept even for checkbox exercises (which don't show it), so switching
      // one back to weights brings back its real set count.
      targetSets: form.targetSets,
    };
    await editPlan(planId, (p) =>
      existing
        ? updateExercise(p, dayId, exerciseId, fields)
        : addExercise(p, dayId, { ...fields, exerciseId: newId('ex') })
    );
    navigation.goBack();
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${existing.name}?`,
      'It is removed from this day. Its logged history stays on the phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await editPlan(planId, (p) => removeExercise(p, dayId, exerciseId));
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{existing ? 'Edit Exercise' : 'New Exercise'}</Text>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(name) => set({ name })}
          placeholder="e.g. Barbell Squat"
          placeholderTextColor={colors.textSecondary}
          autoFocus={!existing}
        />

        <Text style={styles.label}>How it's logged</Text>
        <View style={local.toggleRow}>
          {LOG_TYPE_CHOICES.map(({ type, label }) => (
            <Choice
              key={type}
              local={local}
              label={label}
              active={(form.logType || 'weights') === type}
              onPress={() => set({ logType: type })}
            />
          ))}
        </View>
        <Text style={styles.hint}>{LOG_TYPE_HINTS[form.logType] || LOG_TYPE_HINTS.weights}</Text>

        {!isCheckbox && (
          <>
            <Text style={styles.label}>Sets</Text>
            <View style={local.stepper}>
              <TouchableOpacity
                style={local.stepButton}
                onPress={() => set({ targetSets: Math.max(1, form.targetSets - 1) })}
              >
                <Text style={local.stepButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={local.stepValue}>{form.targetSets}</Text>
              <TouchableOpacity
                style={local.stepButton}
                onPress={() => set({ targetSets: Math.min(MAX_SETS, form.targetSets + 1) })}
              >
                <Text style={local.stepButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.label}>Muscle group</Text>
        <TextInput
          style={styles.input}
          value={form.targetGroup}
          onChangeText={(targetGroup) => set({ targetGroup })}
          placeholder="Type one, or tap below"
          placeholderTextColor={colors.textSecondary}
        />
        <View style={local.chips}>
          {COMMON_GROUPS.map((group) => (
            <TouchableOpacity
              key={group}
              style={[local.chip, form.targetGroup === group && local.chipActive]}
              onPress={() => set({ targetGroup: group })}
            >
              <Text style={[local.chipText, form.targetGroup === group && local.chipTextActive]}>
                {group}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Photo of the machine (optional)</Text>
        {form.photoUri ? (
          <View style={local.mediaRow}>
            <TouchableOpacity onPress={() => setPreviewing('photo')}>
              <Image source={{ uri: form.photoUri }} style={local.photo} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => set({ photoUri: null })}>
              <Text style={local.removeText}>Remove photo</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={local.toggleRow}>
          <SmallButton
            local={local}
            label={busy === 'photo' ? 'Saving…' : form.photoUri ? 'Retake' : 'Take photo'}
            disabled={busy != null}
            onPress={() => addMedia('photo', 'camera')}
          />
          <SmallButton
            local={local}
            label="Choose photo"
            disabled={busy != null}
            onPress={() => addMedia('photo', 'library')}
          />
        </View>
        <Text style={styles.hint}>
          Handy for remembering which machine or setup you use. It shows on the exercise card.
        </Text>

        <Text style={styles.label}>Video (optional)</Text>
        {form.videoUri ? (
          <View style={local.mediaRow}>
            <TouchableOpacity style={local.videoChip} onPress={() => setPreviewing('video')}>
              <Text style={local.videoChipText}>▶ Play video</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => set({ videoUri: null })}>
              <Text style={local.removeText}>Remove video</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={local.toggleRow}>
          <SmallButton
            local={local}
            label={busy === 'video' ? 'Saving…' : 'Record video'}
            disabled={busy != null}
            onPress={() => addMedia('video', 'camera')}
          />
          <SmallButton
            local={local}
            label="Choose video"
            disabled={busy != null}
            onPress={() => addMedia('video', 'library')}
          />
        </View>
        <Text style={styles.hint}>
          Plays on a loop when you tap the exercise's picture. Recording stops at 10 minutes;
          long videos take a lot of space, so for full routines a YouTube link may be better.
        </Text>

        <Text style={styles.label}>YouTube link (optional)</Text>
        <TextInput
          style={styles.input}
          value={form.videoUrl || ''}
          onChangeText={(videoUrl) => set({ videoUrl })}
          placeholder="https://youtu.be/…"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {youtube ? (
          <View style={[local.mediaRow, { marginTop: 10 }]}>
            <TouchableOpacity onPress={() => setPreviewing('youtube')}>
              <Image source={{ uri: youTubeThumbnail(youtube) }} style={local.youtubeThumb} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => set({ videoUrl: '' })}>
              <Text style={local.removeText}>Remove link</Text>
            </TouchableOpacity>
          </View>
        ) : form.videoUrl ? (
          <Text style={local.linkError}>Not a YouTube video link yet.</Text>
        ) : null}
        <Text style={styles.hint}>
          Paste a link from the YouTube app (Share → Copy link). Links with a start time
          (…?t=90) start from that point. Settings → YouTube Videos picks whether it opens in
          the YouTube app or plays here.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={busy != null}>
          <Text style={styles.primaryButtonText}>{existing ? 'Save' : 'Add exercise'}</Text>
        </TouchableOpacity>

        {existing && (
          <TouchableOpacity style={styles.dangerButton} onPress={confirmDelete}>
            <Text style={styles.dangerButtonText}>Delete exercise</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <MediaModal
        visible={previewing != null}
        onClose={() => setPreviewing(null)}
        photoUri={previewing === 'photo' ? form.photoUri : null}
        videoUri={previewing === 'video' ? form.videoUri : null}
        videoUrl={previewing === 'youtube' ? form.videoUrl : null}
      />
    </SafeAreaView>
  );
}

function SmallButton({ local, label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[local.choice, disabled && local.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={local.choiceText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Choice({ local, label, active, onPress }) {
  return (
    <TouchableOpacity style={[local.choice, active && local.choiceActive]} onPress={onPress}>
      <Text style={[local.choiceText, active && local.choiceTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    toggleRow: { flexDirection: 'row', gap: 10 },
    choice: {
      flex: 1,
      paddingVertical: 11,
      paddingHorizontal: 6,
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      alignItems: 'center',
    },
    choiceActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    choiceText: { color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
    choiceTextActive: { color: colors.accent },
    stepper: { flexDirection: 'row', alignItems: 'center' },
    stepButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepButtonText: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
    stepValue: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      width: 56,
      textAlign: 'center',
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.pill,
      borderWidth: 1,
      borderColor: colors.pill,
    },
    chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    chipText: { color: colors.textSecondary, fontSize: 13 },
    chipTextActive: { color: colors.accent, fontWeight: '600' },
    disabled: { opacity: 0.5 },
    mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
    photo: { width: 96, height: 96, borderRadius: 12, backgroundColor: colors.card },
    removeText: { color: colors.danger, fontWeight: '600' },
    youtubeThumb: { width: 128, height: 72, borderRadius: 10, backgroundColor: colors.card },
    linkError: { color: colors.danger, fontSize: 12, marginTop: 6 },
    videoChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
    },
    videoChipText: { color: colors.accent, fontWeight: '700' },
  });
}
