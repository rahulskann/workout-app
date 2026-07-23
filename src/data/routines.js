// EDIT ME: replace exercise lists with your real program.
// Each exercise needs a unique exerciseId (used as the storage key).
// maxWeight is the starting all-time PR (set to 0 if unknown).
// history starts empty - it fills in as you log sessions (max 2 entries, FIFO).

export const ROUTINES = [
  {
    id: 0,
    name: 'Day 1 · Push',
    exercises: [
      {
        exerciseId: 'barbell_bench_press',
        name: 'Barbell Bench Press',
        targetGroup: 'Chest',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null, // e.g. require('../../assets/videos/bench.mp4')
        history: [],
      },
      {
        exerciseId: 'overhead_press',
        name: 'Overhead Press',
        targetGroup: 'Shoulders',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'incline_dumbbell_press',
        name: 'Incline Dumbbell Press',
        targetGroup: 'Chest',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'triceps_pushdown',
        name: 'Triceps Pushdown',
        targetGroup: 'Triceps',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'lateral_raise',
        name: 'Lateral Raise',
        targetGroup: 'Shoulders',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
    ],
  },
  {
    id: 1,
    name: 'Day 2 · Pull',
    exercises: [], // TODO: fill in
  },
  {
    id: 2,
    name: 'Day 3 · Legs',
    exercises: [], // TODO: fill in
  },
  {
    id: 3,
    name: 'Day 4 · Upper',
    exercises: [], // TODO: fill in
  },
  {
    id: 4,
    name: 'Day 5 · Lower',
    exercises: [], // TODO: fill in
  },
];
