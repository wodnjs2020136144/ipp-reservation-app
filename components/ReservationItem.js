import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ReservationItem = ({ time, status, remaining }) => {
  const getStylesByStatus = (status) => {
    if (status === '신청마감') {
      return {
        container: styles.closed,
        text: styles.closedText,
      };
    }

    // 기본: 예약 가능
    return {
      container: styles.open,
      text: styles.openText,
    };
  };

  const statusStyle = getStylesByStatus(status);

  return (
    <View style={[styles.item, statusStyle.container]}>
      <Text style={styles.time}>{time}</Text>
      <Text style={[styles.status, statusStyle.text]}>
        {status} ({remaining}명 남음)
      </Text>
    </View>
  );
};

export default ReservationItem;

const styles = StyleSheet.create({
  item: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  open: {
    backgroundColor: '#e0f0ff',
  },
  closed: {
    backgroundColor: '#e0e0e0',
  },
  time: {
    fontSize: 18,
    fontWeight: '600',
  },
  status: {
    fontSize: 16,
    marginTop: 4,
  },
  openText: {
    color: '#007aff',
  },
  closedText: {
    color: '#888',
  },
});