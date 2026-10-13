import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'google_access_token';

// The Web application OAuth client from Google Cloud (see "Google sign-in
// setup" in the README). The Google Sign-In library requires a Web client ID
// even for Android-only sign-in -- that's a quirk of Google's setup, not a
// mistake. Each signing key the app is built with also needs its own Android
// OAuth client in the same project.
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

// Returns { email, accessToken }, or null if the account picker was closed
// without choosing an account.
export async function signInWithGoogle() {
  ensureConfigured();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response?.type === 'cancelled') return null;
  const tokens = await GoogleSignin.getTokens();
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  const email = response?.data?.user?.email || response?.user?.email || null;
  return { email, accessToken: tokens.accessToken };
}

// Google's sign-in errors arrive as bare status codes; this turns the common
// ones into something you can act on.
export function describeSignInError(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  if (code === '10' || message.includes('DEVELOPER_ERROR')) {
    return (
      "Google doesn't recognise this build of the app yet. Its signing key (SHA-1) has to be " +
      'added as an Android OAuth client in Google Cloud. See "Google sign-in setup" in the README.'
    );
  }
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play services is missing or out of date on this phone. Update it from the Play Store and try again.';
  }
  if (code === '7' || message.includes('NETWORK_ERROR')) {
    return "Couldn't reach Google. Check your connection and try again.";
  }
  return message || 'Something went wrong signing in.';
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
