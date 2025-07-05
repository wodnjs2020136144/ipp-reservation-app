import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import ReservationItem from '../components/ReservationItem';
import { fetchTodayReservations } from '../services/api';

const HomeScreen = () => {
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchTodayReservations();
      setReservations(data);
    };

    loadData();
  }, []);

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
        data={reservations}
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