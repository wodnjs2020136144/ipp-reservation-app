// services/api.js

const BASE_URL = 'http://192.168.219.122:4000'; // ⚠️ 반드시 실제 IP로 변경할 것

export const fetchTodayReservations = async (type = 'ai') => {
  try {
    const response = await fetch(`${BASE_URL}/api/reservations?type=${type}`);
    const result = await response.json();

    // 서버 응답 형식이 { message, data: [ { time, status, available } ] } 형태임
    return result.data.map((item, index) => ({
      id: String(index + 1),
      time: item.time,
      status: item.status,
      remaining: item.available,
    }));
  } catch (error) {
    console.error('예약 정보 불러오기 실패:', error);
    return [];
  }
};