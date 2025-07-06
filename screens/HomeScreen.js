import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import ReservationItem from '../components/ReservationItem';
import { fetchTodayReservations } from '../services/api';

const reservationTypes = [
  { key: 'ai', title: '인공지능 로봇 배움터' },
  { key: 'earthquake', title: '지진 VR' },
  { key: 'drone', title: '드론 VR' },
];

const HomeScreen = () => {
  const [allReservations, setAllReservations] = useState({});
  const [loading, setLoading] = useState(true);

  const todayString = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  useEffect(() => {
    const loadAllReservations = async () => {
      const results = {};
      for (const type of reservationTypes) {
        const data = await fetchTodayReservations(type.key);
        results[type.key] = data;
      }
      setAllReservations(results);
      setLoading(false);
    };

    loadAllReservations();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{todayString} 예약 정보</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        reservationTypes.map(({ key, title }) => (
          <View key={key} style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {allReservations[key]?.length > 0 ? (
              allReservations[key].map((item) => (
                <ReservationItem
                  key={`${key}-${item.id}`}
                  time={item.time}
                  status={item.status}
                  remaining={item.remaining}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>예약 정보가 없습니다.</Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
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
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#007aff',
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    marginBottom: 10,
  },
});