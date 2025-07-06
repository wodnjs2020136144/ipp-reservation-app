// kitService.js
import { db } from '../firebase';        // ← 모듈러 Firestore 인스턴스
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

export const fetchKits = async () => {
  const kitsRef = collection(db, 'kits');     // db 타입 OK
  const snapshot = await getDocs(kitsRef);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateKit = async (id, data) => {
  const docRef = doc(db, 'kits', id);
  await updateDoc(docRef, data);
};

export const resetAllKits = async initialKits => {
  const tasks = initialKits.map(k =>
    setDoc(doc(db, 'kits', k.id), k)
  );
  await Promise.all(tasks);
};