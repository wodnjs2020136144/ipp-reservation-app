import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const CONFIG_DOC_PATH = ['settings', 'scheduleConfig'];

/**
 * Fetch schedule configuration from Firestore
 */
export const fetchScheduleConfig = async () => {
  const docRef = doc(db, CONFIG_DOC_PATH[0], CONFIG_DOC_PATH[1]);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
};

/**
 * Save schedule configuration (employees list and date memos) to Firestore
 */
export const saveScheduleConfig = async (employees, dateMemos) => {
  const docRef = doc(db, CONFIG_DOC_PATH[0], CONFIG_DOC_PATH[1]);
  await setDoc(docRef, {
    employees: employees || ['', '', ''],
    dateMemos: (dateMemos || []).map(v => v || {}),
  }, { merge: true });
};

/**
 * Subscribe to real-time updates for schedule configuration
 */
export const subscribeScheduleConfig = (onUpdate) => {
  const docRef = doc(db, CONFIG_DOC_PATH[0], CONFIG_DOC_PATH[1]);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data());
    } else {
      onUpdate(null);
    }
  });
};
