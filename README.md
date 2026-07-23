# 5-Day Workout Cycle — Android MVP

What's working right now:
- Day 1 checklist with 5 placeholder exercises (edit `src/data/routines.js`)
- Tap `+` on a card to log weight/reps for a session
- All-time PR auto-updates when you log a heavier weight
- "Last 2" rolling history per exercise (FIFO — 3rd entry pushes the oldest out)
- When the oldest entry gets pushed out, it's sent to `exportSessionToSheets()` — currently a
  console.log stub, ready to swap in a real Google Apps Script URL
- "Finish Day" button appears once every exercise is logged, advances to Day 2 (currently empty —
  add exercises to unlock it), wraps back to Day 1 after Day 5
- Dark theme (#121212) matching the spec
- Video modal component wired up (expo-av), just needs an actual `.mp4` per exercise — set
  `videoUri` in `routines.js`

Not built yet (next steps, not needed to test tonight):
- Real Google Sheets webhook (`SHEETS_WEBHOOK_URL` in `src/storage/storage.js`)
- PDF export via expo-print
- "Clear Stored Data" button that also triggers a full export
- Days 2–5 exercise lists

## Run it tonight (Android)

1. Install [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) on your Android phone.
2. On your computer, in this folder:
   ```
   npm install
   npx expo start
   ```
3. Scan the QR code with the Expo Go app (Android: use the in-app "Scan QR code" button).

That's it — no Android Studio or emulator needed for tonight. (You'll need Android Studio /
a dev build later once you add MMKV or other native-only modules, but AsyncStorage works fine
in Expo Go.)

## Building a real .apk to sideload (no Expo Go needed)

VS Code doesn't compile anything itself — you need either Expo's cloud build service (EAS) or a
local Android SDK + Gradle. EAS is the fast path and needs nothing installed beyond Node.

### Option A — EAS Build (recommended, ~10–15 min, no Android Studio)

1. Create a free account at [expo.dev](https://expo.dev).
2. In this project folder:
   ```
   npm install -g eas-cli
   eas login
   eas build:configure
   ```
   (this will detect the `eas.json` already included here — keep the existing "preview" profile,
   which is set to output a `.apk` instead of the store-only `.aab` format)
3. Kick off the build:
   ```
   eas build --platform android --profile preview
   ```
4. Wait for it to finish in Expo's cloud (you'll get a live log link). When done, you get a
   download link — grab the `.apk` from there.
5. Transfer the `.apk` to your phone (email, Drive, USB, whatever) and tap it to install. You may
   need to allow "install from unknown sources" the first time.

### Option B — Fully local build with Android Studio

Only do this if you want zero cloud dependency or plan to add native modules later (like MMKV).

1. Install [Android Studio](https://developer.android.com/studio), open it once so it installs the
   SDK, and install a JDK 17 (Android Studio can do this for you in Settings → SDK).
2. Generate the native Android project:
   ```
   npx expo prebuild --platform android
   ```
3. Build the APK:
   ```
   cd android
   ./gradlew assembleRelease
   ```
   (use `assembleDebug` instead if release signing isn't set up yet — a debug APK still installs
   and runs fine for testing)
4. The APK lands at `android/app/build/outputs/apk/release/app-release.apk` (or `debug/` for the
   debug variant).

### Swapping the routine after you have an APK

Right now, routine data lives in `src/data/routines.js` and gets bundled into the app at build
time — so changing it means editing that file and rerunning the build step above. For EAS this is
just rerunning `eas build ... --profile preview` (~10 min), no reinstalling of tools needed.

If you'd rather not rebuild every time you tweak a routine, I can add a simple in-app screen where
you paste/edit the routine JSON directly on the phone and it saves to local storage — no rebuild
required. Let me know if you want that added.

## Editing Day 1's actual exercises

Open `src/data/routines.js` and edit the first routine's `exercises` array. Each exercise:

```js
{
  exerciseId: 'unique_snake_case_id',  // storage key, must be unique
  name: 'Display Name',
  targetGroup: 'Chest',
  targetSets: 3,
  maxWeight: 0,        // starting PR, 0 if unknown
  videoUri: null,       // require('../../assets/videos/x.mp4') once you have clips
  history: [],          // leave empty, fills in automatically
}
```

## Wiring up the real Google Sheets export

In `src/storage/storage.js`, set `SHEETS_WEBHOOK_URL` to a Google Apps Script Web App URL
that accepts a POST with JSON `{ routineName, exerciseId, exerciseName, date, weight, reps }`
and appends a row to your sheet. The export already fires automatically whenever a 3rd session
pushes the oldest one out, matching the spec's rolling-buffer diagram.
