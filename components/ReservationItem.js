import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ReservationItem = ({ time, status, remaining }) => {
  return (
    <View style={styles.item}>
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.status}>{status}</Text>
      {typeof remaining === 'number' && (
        <Text style={styles.remaining}>{remaining}명</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  time: {
    fontSize: 16,
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007aff',
  },
  remaining: {
    fontSize: 16,
    color: '#555',
  },
});

export default ReservationItem;