import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import ReservationItem from '../components/ReservationItem';
import { fetchTodayReservations } from '../services/api';

const HomeScreen = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  // 오늘 날짜 문자열 생성
  const todayString = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchTodayReservations();
      setReservations(data);
      setLoading(false);
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
      <Text style={styles.title}>{todayString} 예약 정보</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : reservations.length === 0 ? (
        <Text style={styles.emptyText}>예약 정보가 없습니다.</Text>
      ) : (
        <FlatList
          data={reservations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
        />
      )}
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 40,
    color: '#888',
  },
});