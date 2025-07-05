import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ReservationItem = ({ time, status, remaining }) => {
  const isClosed = status === '신청마감';

  return (
    <View style={[styles.item, isClosed && styles.closed]}>
      <Text style={styles.time}>{time}</Text>
      <Text style={[styles.status, isClosed && styles.closedText]}>
        {status} ({remaining}명 남음)
      </Text>
    </View>
  );
};

export default ReservationItem;

const styles = StyleSheet.create({
  item: {
    padding: 16,
    backgroundColor: '#e2f0ff',
    marginBottom: 12,
    borderRadius: 8,
  },
  closed: {
    backgroundColor: '#dcdcdc',
  },
  time: {
    fontSize: 18,
    fontWeight: '600',
  },
  status: {
    fontSize: 16,
    marginTop: 4,
    color: '#333',
  },
  closedText: {
    color: '#888',
  },
});