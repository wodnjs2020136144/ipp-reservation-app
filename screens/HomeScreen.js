import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import ReservationItem from '../components/ReservationItem';

const dummyReservations = [
  { id: '1', time: '10:00', status: '신청마감', remaining: 0 },
  { id: '2', time: '13:10', status: '예약 가능', remaining: 10 },
  { id: '3', time: '15:00', status: '예약 가능', remaining: 8 },
];

const HomeScreen = () => {
  const renderItem = ({ item }) => (
    <ReservationItem
      time={item.time}
      status={item.status}
      remaining={item.remaining}
    />
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
});