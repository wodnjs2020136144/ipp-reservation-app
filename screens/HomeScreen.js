import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

// 더미 예약 데이터
const dummyReservations = [
  { id: '1', time: '10:00', status: '신청마감', remaining: 0 },
  { id: '2', time: '13:10', status: '예약 가능', remaining: 10 },
  { id: '3', time: '15:00', status: '예약 가능', remaining: 8 },
];

const HomeScreen = () => {
  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.time}>{item.time}</Text>
      <Text style={styles.status}>
        {item.status} ({item.remaining}명 남음)
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>오늘의 예약 정보</Text>
      <FlatList
        data={dummyReservations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  item: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
    borderRadius: 8,
  },
  time: {
    fontSize: 18,
    fontWeight: '600',
  },
  status: {
    fontSize: 16,
    marginTop: 4,
  },
});