import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * ReservationItem — 예약 슬롯 행 컴포넌트
 *
 * 표기 형식:  [시간]  [상태]  [신청인원/정원명]
 *
 * Props
 *  - time      {string}   : 시작 시각 (예: '11:10')
 *  - status    {string}   : '예약가능' | '정원마감' | '시간마감'
 *  - remaining {number?}  : 신청 인원(서버 available 값을 전달)
 *  - total     {number?}  : 정원 (없으면 신청 인원만 표시)
 *  - closed    {boolean}  : 마감 슬롯 여부 (색상 약화 처리)
 *
 * Note
 *  - total이 null/undefined면 `remaining명` 형식으로만 출력합니다.
 *  - 닫힌 슬롯(closed=true)은 텍스트 컬러를 회색으로 낮춰 가독성 보조합니다.
 */
const ReservationItem = ({ time, status, remaining, total, closed = false }) => {
  return (
    <View style={styles.item}>
      {/* 시간 */}
      <Text style={[styles.time, closed && styles.textClosed]}>{time}</Text>

      {/* 상태 (예약가능/정원마감/시간마감) */}
      <Text style={[styles.status, closed && styles.textClosed]}>{status}</Text>

      {/* 신청 인원/정원: total이 없으면 신청 인원만 표시 */}
      {typeof remaining === 'number' && (
        <Text style={[styles.remaining, closed && styles.textClosed]}>
          {total != null ? `${remaining}/${total}명` : `${remaining}명`}
        </Text>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // 행 레이아웃: 좌-중-우 3열
  item: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  // 좌측: 시간
  time: {
    fontSize: 16,
    flex: 1,
    textAlign: 'left',
  },
  // 가운데: 상태 배지 느낌(파란색 강조)
  status: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007aff',
    flex: 1,
    textAlign: 'center',
  },
  // 우측: 신청 인원/정원
  remaining: {
    fontSize: 16,
    color: '#555',
    flex: 1,
    textAlign: 'right',
  },
  // 마감 슬롯 컬러 약화(공통)
  textClosed: {
    color: '#999',
  },
});

export default ReservationItem;