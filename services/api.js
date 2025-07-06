// services/api.js

const BASE_URL = 'http://192.168.219.122:4000'; // ⚠️ 반드시 실제 IP로 변경할 것

export const fetchAllReservations = async () => {
  const types = ['ai', 'earthquake', 'drone'];
  const baseUrl = 'http://localhost:4000/api/reservations';

  const results = await Promise.all(
    types.map(async (type) => {
      try {
        const res = await fetch(`${baseUrl}?type=${type}`);
        const json = await res.json();
        return json.data || [];
      } catch (err) {
        console.error(`${type} 예약 정보 불러오기 실패`, err);
        return [];
      }
    })
  );

  return {
    ai: results[0],
    earthquake: results[1],
    drone: results[2],
  };
};