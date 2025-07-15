import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ReservationItem = ({ time, status, remaining, total }) => {
  return (
    <View style={styles.item}>
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.status}>{status}</Text>
      {typeof remaining === 'number' && (
        <Text style={styles.remaining}>
          {total != null ? `${remaining}/${total}명` : `${remaining}명`}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  time: {
    fontSize: 16,
    flex: 1,
    textAlign: 'left',
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007aff',
    flex: 1,
    textAlign: 'center',
  },
  remaining: {
    fontSize: 16,
    color: '#555',
    flex: 1,
    textAlign: 'right',
  },
});

export default ReservationItem;