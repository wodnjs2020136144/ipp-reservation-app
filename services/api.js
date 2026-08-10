/**
 * services/api.js — 예약 서버 REST API 클라이언트 (업데이트)
 *
 * 역할
 * - 프런트엔드에서 fly.io에 배포된 예약 서버의 REST 엔드포인트를 호출합니다.
 * - ✨ [변경] 모든 그룹(IPP, 과학해설사)의 예약 정보를 단일 API 호출로 가져옵니다.
 *
 * 응답 스키마 (서버)
 * - {
 * ipp: { ai: Slot[], earthquake: Slot[], drone: Slot[] },
 * commentator: { science: Slot[], toddler: Slot[], robot: Slot[] }
 * }
 * - Slot = {
 * time: string,                                // 'HH:mm'
 * status: '예약가능' | '정원마감' | '시간마감',
 * available?: number,
 * total?: number
 * }
 *
 * 에러 처리
 * - API 호출 전체가 실패할 경우, 앱이 중단되지 않도록 기본 빈 객체를 반환합니다.
 *
 * BASE_URL은 EXPO_PUBLIC_API_BASE_URL 환경변수로 오버라이드 가능(.env.example 참고).
 * 이 값이 예약 서버 주소의 단일 소스이며, 다른 화면(AiChatScreen 등)은 이 모듈에서 import해서 사용합니다.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://ipp-reservation-server.fly.dev';

// 예약 서버 호출 기본 타임아웃(ms). 서버가 응답을 못 주고 있을 때 로딩이
// 무기한 유지되지 않도록 함
export const DEFAULT_TIMEOUT_MS = 15000;

/**
 * AbortController 기반 타임아웃이 적용된 fetch 래퍼.
 * 다른 화면(AiChatScreen 등)에서도 재사용할 수 있도록 export.
 */
export const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * ✨ [변경] 모든 그룹의 예약 정보를 단일 요청으로 가져옵니다.
 *
 * @returns {Promise<{ ipp: object, commentator: object, fetchError?: boolean }>}
 * - 그룹별 객체를 키로 갖는 객체. (위 스키마 참고)
 * - 호출이 실패하면 fetchError: true와 함께 빈 데이터 구조를 반환해 앱이 중단되지 않도록 함
 */
export const fetchAllReservations = async () => {
  const url = `${BASE_URL}/api/reservations/all`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      // 서버에서 4xx, 5xx 등 에러 상태 코드를 반환한 경우
      throw new Error(`API 서버 응답 오류: ${res.status}`);
    }
    const json = await res.json();
    return { ...json, fetchError: false };
  } catch (err) {
    // 네트워크 오류, 타임아웃 등 fetch 자체가 실패한 경우
    console.error('전체 예약 정보 불러오기 실패', err);
    // 앱의 안정성을 위해 기본 데이터 구조를 반환하되, 실패 여부를 알려 화면에서
    // "데이터 없음"과 "서버 오류"를 구분할 수 있게 함
    return {
      ipp: {},
      commentator: {},
      fetchError: true,
    };
  }
};