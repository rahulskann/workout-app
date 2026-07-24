# 5-Day Workout Cycle — Android MVP

What's working right now:
- Day 1 checklist with your real leg-day exercises (edit `src/data/routines.js` for other days)
- Tap the pencil icon on a card to log a session. Set 1 drives every other set's weight *and*
  reps until you individually nudge one — each set has its own −/+ for both. "+ Add Set" appends
  an extra set beyond the exercise's default count (removable before you log); logging always
  saves however many sets you ended up with
- Warm-up/cooldown/mobility items are simple checkboxes instead of weight logging
- All-time PR auto-updates when you log a heavier top set
- "Last 2" rolling history per exercise (FIFO — 3rd entry pushes the oldest out, which gets sent
  to `exportSessionToSheets()`)
- Tap any day in the row at the top to browse it — this only changes what's on screen, your
  active day (the one "Finish Day" advances from) doesn't change until you tap "Set as Active Day"
  and confirm. 5 days shows as a button row; once you pass 6 it collapses into a dropdown
  (built with custom user-added days in mind)
- "Finish Day" button appears once every exercise is logged, advances to the next day, wraps back
  to Day 1 after Day 5
- Settings screen (gear icon, top right): paste a Google Sheets webhook URL, toggle dark/light
  theme, and choose whether the log form is always visible or hidden behind the pencil icon
- Video modal component wired up (expo-video), just needs an actual `.mp4` per exercise — set
  `videoUri` in `routines.js`

Not built yet (next steps):
- Real Google OAuth login for Sheets (current version is a manual webhook URL paste in Settings —
  functional, just not a "Sign in with Google" flow)
- PDF export via expo-print
- "Clear Stored Data" button that also triggers a full export
- Days 2–5 exercise lists (bring your own, same schema as Day 1)

## Run it tonight (Android)

1. Install [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) on your Android phone.
2. On your computer, in this folder:
   ```
   npm install
   npx expo install --fix
   npx expo start
   ```
   The `expo install --fix` step re-aligns every dependency to the exact versions the SDK expects
   — Expo Go rejects a project if any package is off, even by a patch version, so run this after
   any `npm install`.
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

## Google Sheets sign-in setup

Real Google sign-in requires native code, which means **Expo Go no longer works for this app** --
you need a "development build" instead (a custom APK with the native module baked in, that you
install once and reuse while developing). Here's the full path:

### 1. Create the Google Cloud project + OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a new project (or
   pick an existing one).
2. **APIs & Services → Library** → search "Google Sheets API" → Enable it.
3. **APIs & Services → OAuth consent screen** → set up as "External," fill in the required fields,
   and leave publishing status as **Testing**. Under "Test users," add your own Google account
   *and every friend's Google account* you want to be able to sign in -- while in Testing mode,
   only allowlisted accounts can authenticate. (Publishing to "Production" removes this limit but
   requires Google's verification review, not worth it yet.)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Create a **Web application** type client (name it anything, e.g. "Workout App Web"). You
     won't redirect users through this one directly, but the Android sign-in library requires it
     -- copy the Client ID it gives you.
   - Create an **Android** type client: package name is `com.yourname.workoutcycle` (from
     `app.json` -- change both to match if you rename it), and you'll need your app's SHA-1
     certificate fingerprint. Get that by running this in your project folder once you're set up
     with `eas-cli`:
     ```powershell
     eas credentials
     ```
     Pick Android → your build profile → "Keystore: Manage everything needed to build your project"
     → it'll show the SHA-1. Paste that into the Android OAuth client.

### 2. Drop the Web Client ID into the code

Open `src/services/googleAuth.js` and replace:
```js
const WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
```
with the Web application client ID from step 1.

### 3. Build a development client (one-time, then reuse it)

```powershell
npm install
npx expo install --fix
eas build --platform android --profile development
```
Install that APK on your phone like any other. From now on, instead of `npx expo start` +
Expo Go, run:
```powershell
npx expo start --dev-client
```
and open it from that custom app icon instead of Expo Go. Everything else about your workflow
(editing files, hot reload) stays the same -- this only changes which app you scan the QR code
into.

### 4. Try it

In the app: Settings → Google Sheets Sync → "Sign in with Google." Once signed in, paste your
target spreadsheet's ID (from its URL, the string between `/d/` and `/edit`) and a range like
`Sheet1!A1`, save, and sessions will append as rows once they roll off the 2-session local
history.

The manual webhook field is still there as a no-OAuth fallback if you ever want to skip all of
this.

For sharing a **regular test APK** with friends (no Sheets sign-in needed on their end), keep
using the `preview` profile as before -- that one doesn't require them to be Google test users or
do any setup.

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

## Wiring up the manual webhook fallback

If you'd rather skip Google sign-in entirely, go to Settings → Advanced: Manual Webhook and paste
a Google Apps Script Web App URL that accepts a POST with JSON
`{ routineName, exerciseId, exerciseName, date, weight, sets }` and appends a row to your sheet.
This only gets used when you're not signed in with Google above. The export fires automatically
whenever a 3rd session pushes the oldest one out of local history, matching the spec's
rolling-buffer diagram.
