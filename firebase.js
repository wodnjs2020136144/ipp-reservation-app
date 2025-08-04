// ✅ firebase.js (통일본)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously,
  getAuth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
// NOTE: Older firebase versions (< 9.6) don’t ship `firebase/auth/react-native`.
//       If you upgrade the SDK later, you can re‑add persistence with:
//       import { getReactNativePersistence } from 'firebase/auth/react-native';
//       import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCEoktV7zrnneZRUlPe181lu_sYVpcBMDM",
  authDomain: "ipp-reservation-app.firebaseapp.com",
  projectId: "ipp-reservation-app",
  storageBucket: "ipp-reservation-app.appspot.com",
  messagingSenderId: "752617619492",
  appId: "1:752617619492:web:e2476b7311b70f2e5bcb1",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
console.log('✅ Firestore 인스턴스:', db);

// ---------- Auth (익명 로그인) ----------
let auth;

try {
  // initializeAuth can be called only once per app.
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // If it was already initialised elsewhere, fallback to getAuth.
  if (e?.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw e;
  }
}

/**
 * ensureAuth()
 * 앱 부팅 시 호출해 익명 로그인 상태를 보장한다.
 */
export async function ensureAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
      console.log('✅ Firebase anonymous sign‑in:', auth.currentUser.uid);
    } catch (e) {
      console.warn('⚠️ Firebase sign‑in failed:', e);
    }
  }
}

export { db, auth };