import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * ReservationItem — 예약 슬롯 행 컴포넌트 (디자인 개선 버전)
 *
 * Props
 *  - time      {string}   : 시작 시각 (예: '11:10')
 *  - status    {string}   : '예약가능' | '정원마감' | '시간마감'
 *  - remaining {number?}  : 신청 인원(서버 available 값을 전달)
 *  - total     {number?}  : 정원 (없으면 신청 인원만 표시)
 *  - closed    {boolean}  : 마감 슬롯 여부 (색상 약화 처리)
 */
const ReservationItem = ({ time, status, remaining, total, closed = false }) => {
  const isAvailable = status === '예약가능';

  return (
    <View style={[styles.item, closed && styles.itemClosed]}>
      {/* 좌측: 시간 */}
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, closed && styles.textClosed]}>{time}</Text>
      </View>

      {/* 중앙: 상태 배지 */}
      <View style={styles.statusContainer}>
        <View style={[
          styles.statusBadge, 
          isAvailable ? styles.badgeAvailable : styles.badgeClosed
        ]}>
          <Text style={[
            styles.statusText, 
            isAvailable ? styles.textAvailable : styles.textClosedBadge
          ]}>
            {status}
          </Text>
        </View>
      </View>

      {/* 우측: 인원 정보 */}
      <View style={styles.remainingContainer}>
        {typeof remaining === 'number' && (
          <Text style={[styles.remainingText, closed && styles.textClosed]}>
            {total != null ? `${remaining}/${total}명` : `${remaining}명`}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  itemClosed: {
    opacity: 0.7,
  },
  timeContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  timeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusContainer: {
    flex: 1.2,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAvailable: {
    backgroundColor: '#D1FAE5', // Light Green
  },
  badgeClosed: {
    backgroundColor: '#F1F5F9', // Light Gray
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  textAvailable: {
    color: '#059669', // Emerald Green
  },
  textClosedBadge: {
    color: '#64748B', // Slate Gray
  },
  remainingContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  textClosed: {
    color: '#94A3B8',
    textDecorationLine: 'none',
  },
});

export default ReservationItem;