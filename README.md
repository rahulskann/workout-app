# SplitCycle

An Android app (Expo / React Native) for following a workout split that cycles through its days:
open it at the gym, it shows today's exercises, you log them, tap **Finish Day**, and next time it's
on the next day. Everything is stored on the phone and works offline.

- **Plans:** start from the built-in 5-Day Cycle or from scratch, keep several plans, and edit
  days and exercises in the app (Settings → Plans).
- **Three ways to log an exercise:** weight × reps per set, a checkbox (warm-ups, mobility), or a
  stopwatch per set (planks, hangs). The last two sessions and your PR show on each card.
- **Today's log stays editable** until you finish the day: untick a box, reopen an exercise to
  change it, or undo it.
- **Media:** a photo of the machine, a recorded video, and/or a YouTube link per exercise. The
  warm-ups, cool-downs, stretches and mobility drills in the 5-Day Cycle come with YouTube videos.
- **Google Sheets:** every session is appended to a spreadsheet when you finish the day, so the
  sheet is a complete log. Anything that can't be sent (offline, not signed in) waits in a queue
  and retries.
- **Sharing and backups:** share a plan as a file someone can import, or back up everything to
  restore on a new phone.

The original design spec is `workout_app_summary.pdf` (kept outside the repo).

## Running it on your phone

Builds are local, like `flutter run`: plug the phone in with USB debugging on.

One-time setup on Windows: install Android Studio (it brings the Android SDK and a Java 17+
runtime), then point `JAVA_HOME` at Android Studio's Java, since an older Java on the `PATH`
won't work:

```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
```

Then, in this folder:

```powershell
npm install
npm run android
```

`npm run android` builds the app, installs it on the phone, opens it and starts the dev server, so
code changes appear on the phone straight away. The first build takes a few minutes; later ones
only rebuild what changed. A full rebuild is only needed after adding or upgrading a package with
native code. If Google Play Protect asks to scan the app during install, answer it on the phone
or the install waits.

Run the tests with `npm test`.

The app was called "5-Day Workout Cycle" (package `com.rahulkannan.workoutcycle`) before it was
renamed. Backups and shared plans from that version still open in SplitCycle. The Expo project
slug is still `workout-cycle-app`, since it ties the app to its existing expo.dev project.

## Building an APK to share

For an APK family can install without a computer, use Expo's build service (needs a free
[expo.dev](https://expo.dev) account):

```powershell
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

It gives a download link to an `.apk`. On the phone, allow installs from that source the first
time. For Google sign-in to work in that APK, its signing key needs registering too (below).

## Google sign-in setup

Signing in lets the app create its own workout spreadsheet and write to it. It asks only for the
`drive.file` permission, which covers files the app creates and nothing else in your Drive.

Everything here is in [Google Cloud Console](https://console.cloud.google.com), in the project
that owns the Web client ID in `src/services/googleAuth.js`.

1. **APIs & Services → Library:** make sure **Google Sheets API** is enabled.
2. **Google Auth Platform → Audience:** leave the app in **Testing** and add every Google account
   that should be able to sign in (yours and your family's) under **Test users**. Up to 100.
3. **Google Auth Platform → Clients:** keep the existing **Web application** client (that's the
   ID in the code). Add one **Android** client per signing key the app is built with, all with
   package name `com.rahulkannan.splitcycle`:

   | Build | SHA-1 |
   | --- | --- |
   | Local builds (`npm run android`) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
   | EAS builds (`eas build`) | run `eas credentials` → Android → Keystore |
   | Play Store installs | Play Console → App integrity → App signing key certificate |

   The local-build SHA-1 is React Native's standard debug key, which is the same on every machine,
   so it's fine for testing but shouldn't be what a public release relies on.

New clients can take a few minutes to start working. Then in the app: Settings → Google Sheets
Sync → **Sign in with Google** → **Create Workout Sheet**.

If sign-in says Google doesn't recognise the build, the signing key of the APK on the phone isn't
registered (step 3). If Google says access is blocked, the account isn't a test user (step 2).

Opening sign-in to everyone means publishing the app in **Audience** (because `drive.file` is a
non-sensitive scope, it doesn't need Google's full review) plus brand verification for the app
name and logo, which needs a homepage and privacy policy.

### Webhook instead of sign-in

Settings → Advanced: Manual Webhook takes a Google Apps Script web app URL instead. It receives a
POST with `{ routineName, exerciseId, exerciseName, date, weight, sets }` for each session and
should append a row. It's only used when you're not signed in.

## Where things are

| Path | What |
| --- | --- |
| `src/data/routines.js` | The built-in 5-Day Cycle (what new installs and "Reset 5-Day Cycle" use) |
| `src/storage/plans.js`, `planEdits.js` | Plans, which one is active, day/visit tracking, plan edits |
| `src/storage/storage.js` | Logged history, PRs, today's drafts, and the Sheets export queue |
| `src/storage/transferFormat.js`, `src/services/transfer.js` | Plan sharing and backups |
| `src/services/` | Google sign-in and Sheets, photos/videos, YouTube links |
| `src/screens/`, `src/components/` | The screens and exercise cards |
