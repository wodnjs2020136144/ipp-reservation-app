/**
 * services/api.js — 예약 서버 REST API 클라이언트
 *
 * 역할
 *  - 프런트엔드에서 fly.io에 배포된 예약 서버의 REST 엔드포인트를 호출합니다.
 *  - 오늘 날짜 기준 각 체험 타입(인공지능, 지진VR, 드론VR)의 회차 목록을 병렬로 가져옵니다.
 *
 * 응답 스키마 (서버)
 *  - { message: string, data: Slot[] }
 *  - Slot = {
 *      time: string,                                // 'HH:mm'
 *      status: '예약가능' | '정원마감' | '시간마감',     // 서버에서 판별
 *      available?: number,                          // 신청 인원
 *      total?: number                               // 정원 (없을 수 있음)
 *    }
 *
 * 에러 처리
 *  - 개별 타입이 실패해도 다른 타입까지 막지 않도록, 해당 타입만 빈 배열([])로 대체합니다.
 *  - 전체 UI가 비는 것을 방지하고, 화면은 가능한 범위에서 최신 데이터를 유지합니다.
 */
const BASE_URL = 'https://ipp-reservation-server.fly.dev';

/**
 * 모든 체험 타입의 회차를 병렬로 가져옵니다.
 *
 * @returns {Promise<{ ai: Array, earthquake: Array, drone: Array }>} 
 *   - 타입별 배열을 키로 갖는 객체. 각 배열은 Slot[] (위 스키마 참고)
 */
export const fetchAllReservations = async () => {
  // 서버에서 지원하는 체험 타입 키 — 서버측 reservationMap 과 일치해야 함
  const types = ['ai', 'earthquake', 'drone'];
  const baseUrl = `${BASE_URL}/api/reservations`;

  // 각 타입을 병렬 요청하여 성능을 확보합니다.
  const results = await Promise.all(
    types.map(async (type) => {
      try {
        const res = await fetch(`${baseUrl}?type=${type}`);
        const json = await res.json();
        // 서버는 { data: Slot[] } 형태로 내려줌. 방어적으로 기본값 처리
        return json.data || [];
      } catch (err) {
        // 개별 타입 실패 시에도 나머지 타입은 계속 표시되도록 빈 배열로 대체
        console.error(`${type} 예약 정보 불러오기 실패`, err);
        return [];
      }
    })
  );

  // 호출 순서(types)와 반환 구조의 인덱스를 일치시켜 매핑
  return {
    ai: results[0],
    earthquake: results[1],
    drone: results[2],
  };
};