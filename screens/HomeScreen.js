// screens/HomeScreen.js
import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Platform, StatusBar } from 'react-native';
import ReservationItem from '../components/ReservationItem';
import { fetchAllReservations } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HomeScreen = () => {
  const [reservations, setReservations] = useState({
    ai: [],
    earthquake: [],
    drone: [],
  });
  const [loading, setLoading] = useState(true);
  const [closeMeta, setCloseMeta] = useState({}); // { slotKey: { lastAvail, total } }
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    setRefreshing(true);
    // wait for release bounce, then refresh
    setTimeout(async () => {
      await loadData();
      setRefreshing(false);
    }, 500);
  };

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
    await processClosedSlots(data);
    setLoading(false);
  };

  // 슬롯 고유 키(type + time)
  const makeSlotKey = (type, time) => `${type}-${time}`;

  // 저장/로드
  const saveCloseMeta = async (meta) => {
    try {
      await AsyncStorage.setItem('closeMeta', JSON.stringify(meta));
    } catch (e) {}
  };

  const loadCloseMeta = async () => {
    try {
      const raw = await AsyncStorage.getItem('closeMeta');
      if (raw) setCloseMeta(JSON.parse(raw));
    } catch (e) {}
  };

  // status가 닫힘이면 첫 발견 시 lastAvail/total 저장
  const isClosedStatus = (status) => status === 'closed' || status === '정원마감' || status === '시간마감';

  const processClosedSlots = async (data) => {
    const newMeta = { ...closeMeta };
    ['ai', 'earthquake', 'drone'].forEach(type => {
      (data[type] || []).forEach(slot => {
        if (isClosedStatus(slot.status)) {
          const key = makeSlotKey(type, slot.time);
          if (!newMeta[key]) {
            newMeta[key] = { lastAvail: slot.available, total: slot.total };
          }
        }
      });
    });
    setCloseMeta(newMeta);
    await saveCloseMeta(newMeta);
  };
  useEffect(() => {
    loadCloseMeta();
  }, []);

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
          data.map((slot, idx) => {
            const key = makeSlotKey(type, slot.time);
            const meta = closeMeta[key] || {};
            const closed = isClosedStatus(slot.status);
            const shownRemaining = closed && meta.lastAvail != null ? meta.lastAvail : slot.available;
            const shownTotal = closed && meta.total != null ? meta.total : slot.total;
            return (
              <ReservationItem
                key={`${type}-${idx}`}
                time={slot.time}
                status={slot.status}
                remaining={shownRemaining}
                total={shownTotal}
              />
            );
          })
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>{todayString} 예약 정보</Text>
      </View>

      {/* 본문 */}
      {loading ? (
        <ActivityIndicator size="large" color="#007aff" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView
          overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          alwaysBounceVertical={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#007aff']}
              progressBackgroundColor="#fff"
            />
          }
        >
          {renderGroup('인공지능 로봇 배움터', reservations.ai, 'ai')}
          {renderGroup('지진 VR', reservations.earthquake, 'earthquake')}
          {renderGroup('드론 VR', reservations.drone, 'drone')}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default HomeScreen;

/* --- styles 그대로 --- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingHorizontal: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  emptyText: { textAlign: 'center', fontSize: 16, marginTop: 10, color: '#888' },
  scrollContent: { paddingBottom: 80, paddingHorizontal: 0 },
});