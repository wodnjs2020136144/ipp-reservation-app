// ✅ firebase.js (통일본)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC60tV7nmeZRU1P81tLU_sVYpcBWDM",
  authDomain: "ipp-reservation-app.firebaseapp.com",
  projectId: "ipp-reservation-app",
  storageBucket: "ipp-reservation-app.appspot.com",
  messagingSenderId: "752617619492",
  appId: "1:752617619492:web:e2476b7311b70f2e5bcb1",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
console.log('✅ Firestore 인스턴스:', db);
export { db };