import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import ReservationItem from '../components/ReservationItem';
import { fetchAllReservations } from '../services/api'; // 수정된 API

const HomeScreen = () => {
  const [reservations, setReservations] = useState({
    ai: [],
    earthquake: [],
    drone: [],
  });
  const [loading, setLoading] = useState(true);

  const todayString = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  useEffect(() => {
    let intervalId;

    const loadData = async () => {
      setLoading(true);
      const data = await fetchAllReservations(); // 3개 타입 모두 불러오기
      setReservations(data);
      setLoading(false);
    };

    loadData();
    intervalId = setInterval(loadData, 30000); // 30초마다 갱신

    return () => clearInterval(intervalId); // 컴포넌트 unmount 시 정리
  }, []);

  const renderGroup = (title, data) => (
    <View style={{ marginBottom: 30 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={styles.emptyText}>예약 정보가 없습니다.</Text>
      ) : (
        data.map((item, index) => (
          <ReservationItem
            key={`${title}-${index}`}
            time={item.time}
            status={item.status}
            remaining={item.remaining}
          />
        ))
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{todayString} 예약 정보</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {renderGroup('인공지능 로봇 배움터', reservations.ai)}
          {renderGroup('지진 VR', reservations.earthquake)}
          {renderGroup('드론 VR', reservations.drone)}
        </ScrollView>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 10,
    color: '#888',
  },
});