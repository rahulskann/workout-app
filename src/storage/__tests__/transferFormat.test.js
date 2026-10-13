import {
  planToShareFile,
  planFromShareFile,
  buildBackup,
  parseBackup,
  withPhotoPaths,
  summarizeBackup,
  isSafeFileName,
  TransferError,
} from '../transferFormat';
import { makeDefaultPlan } from '../../data/defaultPlan';

const plan = {
  id: 'p1',
  name: 'Push Pull',
  days: [
    {
      id: 'd1',
      name: 'Push',
      exercises: [
        {
          exerciseId: 'ex1',
          name: 'Bench Press',
          targetGroup: 'Chest',
          targetSets: 4,
          logType: 'weights',
          photoUri: 'file:///data/files/media/media_abc.jpg',
          videoUri: 'file:///data/files/media/media_def.mp4',
          videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
        },
        { exerciseId: 'ex2', name: 'Stretch', targetGroup: '', targetSets: 1, logType: 'checkbox' },
      ],
    },
  ],
};

describe('shared plans', () => {
  it('shares the program and YouTube links but no IDs, photos or video files', () => {
    const file = planToShareFile(plan);
    const text = JSON.stringify(file);

    expect(file).toMatchObject({ app: 'workout-cycle', kind: 'plan', version: 1 });
    expect(file.plan.days[0].exercises[0]).toEqual({
      name: 'Bench Press',
      targetGroup: 'Chest',
      targetSets: 4,
      logType: 'weights',
      videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
    expect(text).not.toMatch(/ex1|d1|p1|media_abc|media_def|file:/);
  });

  it('imports as a new plan with fresh IDs everywhere', () => {
    const imported = planFromShareFile(planToShareFile(plan));

    expect(imported.id).not.toBe('p1');
    expect(imported.days[0].id).not.toBe('d1');
    expect(imported.days[0].exercises.map((e) => e.exerciseId)).not.toContain('ex1');
    expect(imported.days[0].exercises[0]).toMatchObject({
      name: 'Bench Press',
      targetGroup: 'Chest',
      targetSets: 4,
      logType: 'weights',
      photoUri: null,
      videoUri: null,
      videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
  });

  it('round-trips the whole 5-Day Cycle', () => {
    const original = makeDefaultPlan();
    const imported = planFromShareFile(JSON.parse(JSON.stringify(planToShareFile(original))));

    const shape = (p) =>
      p.days.map((d) => [d.name, d.exercises.map((e) => [e.name, e.targetSets, e.logType, e.videoUrl])]);
    expect(shape(imported)).toEqual(shape(original));
  });

  it('renames an import that clashes with an existing plan', () => {
    expect(planFromShareFile(planToShareFile(plan), ['Push Pull']).name).toBe('Push Pull (2)');
    expect(planFromShareFile(planToShareFile(plan), ['Push Pull', 'Push Pull (2)']).name).toBe(
      'Push Pull (3)'
    );
  });

  it('cleans up odd values instead of trusting the file', () => {
    const file = planToShareFile(plan);
    file.plan.days[0].exercises = [
      { name: '  Squat  ', targetSets: 99, logType: 'weights', videoUrl: 'https://evil.example/x' },
      { name: 'Hold', targetSets: 5, logType: 'checkbox' },
      { name: '', targetSets: 3 },
      { targetSets: 3 },
      { name: 'Curl', targetSets: 'three', logType: 'something' },
      { name: 'Plank', targetSets: 2, logType: 'timed' },
    ];

    const [squat, hold, curl, plank, ...rest] = planFromShareFile(file).days[0].exercises;

    expect(rest).toEqual([]);
    expect(plank).toMatchObject({ targetSets: 2, logType: 'timed' });
    expect(squat).toMatchObject({ name: 'Squat', targetSets: 10, videoUrl: null });
    expect(hold).toMatchObject({ targetSets: 5, logType: 'checkbox' });
    expect(curl).toMatchObject({ targetSets: 3, logType: 'weights' });
  });

  it.each([
    [null, "isn't a plan or backup"],
    [{ hello: 'world' }, "isn't a plan or backup"],
    [{ app: 'workout-cycle', kind: 'backup', version: 1 }, 'full backup, not a single plan'],
    [{ app: 'workout-cycle', kind: 'plan', version: 99, plan: {} }, 'newer version'],
    [{ app: 'workout-cycle', kind: 'plan', version: 1, plan: { name: 'x' } }, 'damaged'],
  ])('rejects %p with a readable message', (data, message) => {
    expect(() => planFromShareFile(data)).toThrow(TransferError);
    expect(() => planFromShareFile(data)).toThrow(message);
  });
});

describe('backups', () => {
  const planState = { plans: [plan], activePlanId: 'p1', progress: { p1: { activeDayIndex: 0, visitId: 'v1' } } };
  const exercises = {
    ex1: { history: [{ date: '2026-10-01', sets: [{ weight: 135, reps: 8 }] }], maxWeight: 135, today: null },
    ex2: { history: [], maxWeight: 0, today: { visitId: 'v1' } },
  };
  const settings = { themeMode: 'light', googleAccountEmail: 'me@example.com', googleSheetsSpreadsheetId: 'sheet1' };
  const photos = { 'media_abc.jpg': 'BASE64DATA' };

  const backup = () =>
    buildBackup({ planState, exercises, pendingExports: [{ id: 'row1' }], settings, photos });

  it('keeps everything needed to carry on, minus video files and the signed-in account', () => {
    const file = backup();
    const ex = file.planState.plans[0].days[0].exercises[0];

    expect(file).toMatchObject({ app: 'workout-cycle', kind: 'backup', version: 1 });
    expect(file.exercises).toEqual(exercises);
    expect(file.pendingExports).toEqual([{ id: 'row1' }]);
    expect(file.settings).toEqual({ themeMode: 'light', googleSheetsSpreadsheetId: 'sheet1' });
    expect(ex.photoUri).toBe('media_abc.jpg');
    expect(ex.videoUri).toBeNull();
    expect(ex.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
  });

  it('restores photo paths to wherever the files were written on the new phone', () => {
    const parsed = parseBackup(JSON.parse(JSON.stringify(backup())));
    const restored = withPhotoPaths(parsed.planState, 'file:///new/files/media', ['media_abc.jpg']);

    expect(restored.plans[0].days[0].exercises[0].photoUri).toBe('file:///new/files/media/media_abc.jpg');
    expect(restored.plans[0].days[0].exercises[1].photoUri).toBeNull();
    expect(restored.progress).toEqual(planState.progress);
  });

  it('drops a photo reference when its file could not be written', () => {
    const parsed = parseBackup(backup());
    const restored = withPhotoPaths(parsed.planState, 'file:///new/media/', []);

    expect(restored.plans[0].days[0].exercises[0].photoUri).toBeNull();
  });

  it('summarizes what a backup holds', () => {
    expect(summarizeBackup(parseBackup(backup()))).toMatchObject({
      planCount: 1,
      loggedExercises: 1,
      photoCount: 1,
    });
  });

  it('rejects a plan file offered as a backup', () => {
    expect(() => parseBackup(planToShareFile(plan))).toThrow('single plan, not a backup');
  });

  it('only accepts plain photo file names', () => {
    expect(isSafeFileName('media_abc123.jpg')).toBe(true);
    expect(isSafeFileName('../../databases/RKStorage')).toBe(false);
    expect(isSafeFileName('.hidden')).toBe(false);
    expect(isSafeFileName('a/b.jpg')).toBe(false);
  });
});
