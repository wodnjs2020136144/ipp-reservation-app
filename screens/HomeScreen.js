import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // 아이콘 사용
import ReservationItem from '../components/ReservationItem';
import { fetchAllReservations } from '../services/api';

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

  const loadData = async () => {
    setLoading(true);
    const data = await fetchAllReservations();
    setReservations(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const renderGroup = (title, data) => (
    <View style={{ marginBottom: 30, paddingHorizontal: 10 }}>
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{todayString} 예약 정보</Text>
          <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
            <Ionicons name="refresh" size={18} color="#007aff" />
            <Text style={styles.refreshText}>새로고침</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#007aff" style={{ marginTop: 20 }} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {renderGroup('인공지능 로봇 배움터', reservations.ai)}
            {renderGroup('지진 VR', reservations.earthquake)}
            {renderGroup('드론 VR', reservations.drone)}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007aff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshText: {
    color: '#007aff',
    fontWeight: '500',
    marginLeft: 6,
    fontSize: 14,
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
  scrollContent: {
    paddingBottom: 30,
  },
});