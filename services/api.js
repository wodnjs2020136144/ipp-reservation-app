// services/api.js

const BASE_URL = 'https://ipp-reservation-server.fly.dev';

export const fetchAllReservations = async () => {
  const types = ['ai', 'earthquake', 'drone'];
  const baseUrl = `${BASE_URL}/api/reservations`;

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