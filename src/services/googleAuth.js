import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'google_access_token';

// --- FILL THIS IN once you've created your Web application OAuth client
// in Google Cloud Console (see the Settings screen instructions / README
// for the full walkthrough). The Google Sign-In library requires a Web
// client ID even for Android-only sign-in -- that's a quirk of Google's
// setup, not a mistake.
const WEB_CLIENT_ID = '1063323991905-ogm71842jmt96iipv3mj5pn5i22k3uek.apps.googleusercontent.com';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    // drive.file is the narrow, "non-sensitive" scope: the app can only
    // see/edit/create files it makes itself (or ones explicitly opened via
    // a picker) -- not the rest of your Drive. That's why the sign-in flow
    // creates its own spreadsheet rather than asking you to paste an
    // existing one's ID; deleting the sheet is left entirely up to you via
    // sheets.google.com.
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    offlineAccess: false,
  });
  configured = true;
}

export async function signInWithGoogle() {
  ensureConfigured();
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const tokens = await GoogleSignin.getTokens();
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  const email = userInfo?.data?.user?.email || userInfo?.user?.email || null;
  return { email, accessToken: tokens.accessToken };
}

export async function signOutGoogle() {
  ensureConfigured();
  try {
    await GoogleSignin.signOut();
  } catch (e) {
    // ignore -- still clear local token below
  }
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

// Access tokens expire (~1hr). This tries a silent re-sign-in first (Google
// Play Services handles the refresh under the hood), falling back to
// whatever's cached if that fails -- callers should treat a null return as
// "needs a manual sign-in again."
export async function getFreshAccessToken() {
  ensureConfigured();
  try {
    await GoogleSignin.signInSilently();
    const tokens = await GoogleSignin.getTokens();
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
    return tokens.accessToken;
  } catch (e) {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY).catch(() => null);
  }
}

export async function hasPreviousSignIn() {
  ensureConfigured();
  try {
    return await GoogleSignin.hasPreviousSignIn();
  } catch (e) {
    return false;
  }
}
