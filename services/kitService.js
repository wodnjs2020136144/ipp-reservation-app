import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';

/**
 * Fetch all kits from Firestore
 */
export const fetchKits = async () => {
  const kitsRef = collection(db, 'kits');
  const snapshot = await getDocs(kitsRef);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Save or update a kit in Firestore
 */
export const saveKit = async (kit) => {
  const docRef = doc(db, 'kits', kit.id);
  await setDoc(docRef, kit);
};

/**
 * Save multiple kits in parallel
 */
export const saveMultipleKits = async (kits) => {
  const tasks = kits.map(k => saveKit(k));
  await Promise.all(tasks);
};

/**
 * Delete a kit from Firestore
 */
export const removeKit = async (id) => {
  const docRef = doc(db, 'kits', id);
  await deleteDoc(docRef);
};

/**
 * Fetch kit activity logs
 */
export const fetchLogs = async () => {
  const logRef = doc(db, 'logs', 'kitLogs');
  const snap = await getDoc(logRef);
  return snap.exists() ? (snap.data().entries || []) : [];
};

/**
 * Save kit activity logs
 */
export const saveLogs = async (entries) => {
  const logRef = doc(db, 'logs', 'kitLogs');
  await setDoc(logRef, { entries });
};

/**
 * Subscribe to real-time kits updates
 */
export const subscribeKits = (onUpdate) => {
  const kitsRef = collection(db, 'kits');
  return onSnapshot(kitsRef, (snap) => {
    const kitsData = [];
    snap.forEach((docSnap) => {
      kitsData.push({ id: docSnap.id, ...docSnap.data() });
    });
    onUpdate(kitsData);
  });
};

/**
 * Subscribe to real-time logs updates
 */
export const subscribeLogs = (onUpdate) => {
  const logRef = doc(db, 'logs', 'kitLogs');
  return onSnapshot(logRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data().entries || []);
    } else {
      onUpdate([]);
    }
  });
};