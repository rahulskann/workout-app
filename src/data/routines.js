// EDIT ME: replace exercise lists with your real program.
// Each exercise needs a unique exerciseId (used as the storage key).
// maxWeight is the starting all-time PR (set to 0 if unknown).
// history starts empty - it fills in as you log sessions (max 2 entries, FIFO).

export const ROUTINES = [
  {
    id: 0,
    name: 'Day 1 · Legs',
    exercises: [
      {
        exerciseId: 'warmup_lower_body',
        name: '6 Min Lower Body Warm Up Routine',
        targetGroup: 'Stretching',
        targetSets: 1,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'hip_mobility',
        name: 'Hip Mobility',
        targetGroup: 'Quadriceps',
        targetSets: 1,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'squat_jumps',
        name: 'Squat Jumps',
        targetGroup: 'Quadriceps',
        targetSets: 2,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'barbell_squat',
        name: 'Barbell Squat',
        targetGroup: 'Quadriceps',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'lying_leg_press',
        name: 'Lying Leg Press',
        targetGroup: 'Quadriceps',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'bilateral_leg_extensions',
        name: 'Bilateral Leg Extensions',
        targetGroup: 'Quadriceps',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'hip_thrust',
        name: 'Hip Thrust',
        targetGroup: 'Glutes',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'leg_raise_on_stand',
        name: 'Leg Raise on the Stand',
        targetGroup: 'Abs',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'dumbbell_pull_through',
        name: 'Dumbbell Pull Through',
        targetGroup: 'Abs',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'reverse_crunches',
        name: 'Reverse Crunches',
        targetGroup: 'Abs',
        targetSets: 3,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'standing_incline_calf_raises',
        name: 'Standing Incline Close Stance Machine Calf Raises',
        targetGroup: 'Calves',
        targetSets: 4,
        maxWeight: 0,
        videoUri: null,
        history: [],
      },
      {
        exerciseId: 'cooldown_lower_body',
        name: '8 Min Lower Body Cooldown Routine',
        targetGroup: 'Stretching',
        targetSets: 1,
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
