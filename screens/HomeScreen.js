// screens/HomeScreen.js
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
import { Ionicons } from '@expo/vector-icons';
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
  const todayDay = new Date().getDay();        // 0=일 … 6=토

  /** API 호출 */
  const loadData = async () => {
    setLoading(true);
    const data = await fetchAllReservations(); // { ai:[{time,available,total,…}], … }
    setReservations(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();                                // 최초
    const id = setInterval(loadData, 60_000);  // 1 분 주기 새로고침
    return () => clearInterval(id);
  }, []);

  /** 목록 카드 렌더 */
  const renderGroup = (title, data, type) => {
    // 요일별 특수 안내
    let special = '';
    if (todayDay === 1) special = '월요일은 휴관입니다.';
    else if (todayDay === 0 && type === 'earthquake')
      special = '일요일은 지진 VR 미운영';

    return (
      <View style={styles.groupCard}>
        <Text style={styles.sectionTitle}>{title}</Text>

        {special ? (
          <Text style={styles.emptyText}>{special}</Text>
        ) : data.length === 0 ? (
          <Text style={styles.emptyText}>예약 정보가 없습니다.</Text>
        ) : (
          data.map((slot, idx) => (
            <ReservationItem
              key={`${type}-${idx}`}
              time={slot.time}
              status={slot.status}
              remaining={slot.available} // ← 잔여 인원
              total={slot.total}         // ← 정원
            />
          ))
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>{todayString} 예약 정보</Text>
          <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
            <Ionicons name="refresh" size={18} color="#007aff" />
            <Text style={styles.refreshText}>새로고침</Text>
          </TouchableOpacity>
        </View>

        {/* 본문 */}
        {loading ? (
          <ActivityIndicator size="large" color="#007aff" style={{ marginTop: 20 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {renderGroup('인공지능 로봇 배움터', reservations.ai, 'ai')}
            {renderGroup('지진 VR', reservations.earthquake, 'earthquake')}
            {renderGroup('드론 VR', reservations.drone, 'drone')}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default HomeScreen;

/* --- styles 그대로 --- */
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold' },
  refreshButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#007aff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  refreshText: { color: '#007aff', fontWeight: '500', marginLeft: 6, fontSize: 14 },
  groupCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  emptyText: { textAlign: 'center', fontSize: 16, marginTop: 10, color: '#888' },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 4 },
});