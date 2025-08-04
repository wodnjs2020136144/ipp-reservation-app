import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ReservationItem = ({ time, status, remaining, total, closed = false }) => {
  return (
    <View style={styles.item}>
      <Text style={[styles.time, closed && styles.textClosed]}>{time}</Text>
      <Text style={[styles.status, closed && styles.textClosed]}>{status}</Text>
      {typeof remaining === 'number' && (
        <Text style={[styles.remaining, closed && styles.textClosed]}>
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
  textClosed: {
    color: '#999',
  },
});

export default ReservationItem;