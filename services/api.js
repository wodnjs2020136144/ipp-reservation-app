// services/api.js

// 더미 데이터 (임시)
export const fetchTodayReservations = async () => {
  // 실제 구현에서는 fetch("https://your-server.com/api/reservations/today") 같은 식으로 대체됨
  return [
    { id: '1', time: '10:00', status: '신청마감', remaining: 0 },
    { id: '2', time: '13:10', status: '예약 가능', remaining: 10 },
    { id: '3', time: '15:00', status: '예약 가능', remaining: 8 },
  ];
};