/**
 * firebase.js — Firebase 초기화(앱/Firestore/익명 인증)
 *
 * 목적
 *  - Firebase App 단일 인스턴스 생성(getApps로 중복 방지)
 *  - Firestore 인스턴스(db) 노출
 *  - React Native 환경에서 **익명 인증 + 영속성(AsyncStorage)** 설정
 *  - `ensureAuth()`로 앱 시작 시 인증 보장
 *
 * 주의
 *  - 이 파일은 클라이언트 번들에 포함됩니다. Firebase API Key는 공개 식별자이며
 *    서버 비밀이 아닙니다(보안 비밀을 여기에 두면 안 됨).
 *  - 관리자(서버) SDK, 서비스 계정 키는 절대 클라이언트에 포함하지 마세요.
 *  - 배포 환경(dev/staging/prod)을 분리할 수 있도록 EXPO_PUBLIC_* 환경변수로
 *    오버라이드 가능. .env.example 참고. 환경변수가 없으면 기존 기본값 사용.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously,
  getAuth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// React Native에서의 Auth 영속성 참고
// (구버전 Firebase SDK에서 `firebase/auth/react-native` 모듈이 없던 이슈가 있었음)
// 현재는 `getReactNativePersistence(AsyncStorage)` 로 권장 설정을 사용

// ─────────────────────────────────────────────────────────────
// Firebase 프로젝트 설정
//  - 공개 가능한 클라이언트용 구성
//  - EXPO_PUBLIC_* 환경변수(.env)로 오버라이드 가능, 없으면 기본값 사용
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCEoktV7zrnneZRUlPe181lu_sYVpcBMDM',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'ipp-reservation-app.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'ipp-reservation-app',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'ipp-reservation-app.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '752617619492',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:752617619492:web:e2476b7311b70f2e5bcb1',
};

// Firebase App: 이미 초기화돼 있으면 재사용
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firestore 인스턴스 생성 및 디버그 로깅(필요 시 제거 가능)
const db = getFirestore(app);
console.log('✅ Firestore 인스턴스:', db);

// ─────────────────────────────────────────────────────────────
// Auth 초기화 (익명 로그인 + 영속성)
//  - initializeAuth는 RN에서 앱당 1회만 호출 가능
//  - 이미 초기화되어 있으면 getAuth(app)로 회수
// ─────────────────────────────────────────────────────────────
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // 이미 초기화된 경우 등 예외 처리
  if (e?.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw e;
  }
}

/**
 * ensureAuth — 앱 부팅 시 익명 인증을 보장
 * @returns {Promise<void>}
 *
 * - Firestore 보안 규칙에서 request.auth 를 필요로 할 때 사용
 * - 실패하더라도 UI 진입은 가능(로그 경고만 남김)
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