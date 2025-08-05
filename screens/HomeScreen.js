/**
 * HomeScreen
 * =====================================================
 * 기능 요약
 * -----------------------------------------------------
 * 1. 1분 간격으로 오늘(인공지능·지진 VR·드론 VR) 예약 현황 갱신
 * 2. "닫힘" 시점의 신청인원/정원 값을 AsyncStorage 에 스냅샷 저장
 * 3. 직무별 카드 + 외부 링크 아이콘 제공 (모바일 브라우저로 연결)
 * 4. Pull‑to‑refresh + 자동 새로고침 UI
 */
import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Platform, StatusBar, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReservationItem from '../components/ReservationItem';
import { fetchAllReservations } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 각 직무별 웹 예약 캘린더 URL (외부 브라우저로 열기용)
const reservationLinks = {
  ai: 'https://www.cnse.or.kr/main/reserve/experience_calendar.action?q=1f960d474357a0fac696373aa47231c9819814b7d50f96cb7e020bd713813353',
  earthquake: 'https://www.cnse.or.kr/main/reserve/experience_calendar.action?q=836d40ad6724f3585ecc91c192de8f29d7b34b85db4c936465070bb8a1d25af5',
  drone: 'https://www.cnse.or.kr/main/reserve/experience_calendar.action?q=33152e18b25f10571da6b0aa11ccf9f07e6211fe37567968e6c591f23fa5c429',
};

// =====================================================
// State
// =====================================================
const HomeScreen = () => {
  const [reservations, setReservations] = useState({
    ai: [],
    earthquake: [],
    drone: [],
  });
  const [loading, setLoading] = useState(true);
  const [closeMeta, setCloseMeta] = useState({}); // { slotKey: { lastBooked, total } }
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    // iOS pull‑bounce 후 0.5초 기다리고 새로고침
    setTimeout(async () => {
      await loadData();
      setRefreshing(false);
    }, 500);
  };

  // =====================================================
  // Today Helpers
  // =====================================================
  const todayString = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
  const todayDay = new Date().getDay();        // 0=일 … 6=토

  // =====================================================
  // API & 데이터 로드
  // =====================================================
  const loadData = async () => {
    setLoading(true);
    const data = await fetchAllReservations(); // { ai:[{time,available,total,…}], … }
    setReservations(data);
    await processClosedSlots(data);
    setLoading(false);
  };

  // -----------------------------------------------------
  // Utils
  // -----------------------------------------------------
  // 고유 key : 'ai-15:10' 형태 (직무+시작시각)
  const makeSlotKey = (type, time) => `${type}-${time}`;

  // AsyncStorage helpers ─ 마감 스냅샷 { lastBooked, total } 저장/로드
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

// 닫힘 상태 식별 (정원마감·시간마감)
const isClosedStatus = (status) => status === 'closed' || status === '정원마감' || status === '시간마감';
// true ⇢ closed (정원마감/시간마감)  false ⇢ 예약가능
const isClosed = (slot) => isClosedStatus(slot.status);

  // -----------------------------------------------------
  // 닫힌 슬롯 스냅샷 처리
  // -----------------------------------------------------
  const processClosedSlots = async (data) => {
    const newMeta = { ...closeMeta };
    ['ai', 'earthquake', 'drone'].forEach(type => {
      (data[type] || []).forEach(slot => {
        if (isClosedStatus(slot.status)) {
          const key = makeSlotKey(type, slot.time);
          if (!newMeta[key]) {
            newMeta[key] = { lastBooked: slot.available, total: slot.total };
          }
        }
      });
    });
    setCloseMeta(newMeta);
    await saveCloseMeta(newMeta);
  };
  // 화면 진입: 로컬 저장된 마감 스냅샷 로드

  // =====================================================
  // Effects
  // =====================================================
  useEffect(() => {
    loadCloseMeta();
  }, []);

  useEffect(() => {
    // 최초 로드 + 60초 간격 자동 갱신
    loadData();
    const id = setInterval(loadData, 60_000);
    return () => clearInterval(id);
  }, []);

  // =====================================================
  // Render Helpers
  // =====================================================
  /**
   * renderGroup
   * -----------
   * title      : 카드 제목
   * data       : [{time, status, available, total}]
   * type       : 'ai' | 'earthquake' | 'drone'
   */
  const renderGroup = (title, data, type) => {
    // 요일별 특수 안내
    let special = '';
    if (todayDay === 1) special = '월요일은 휴관입니다.';
    else if (todayDay === 0 && type === 'earthquake')
      special = '일요일은 지진 VR 미운영';

    return (
      <View style={styles.groupCard}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(reservationLinks[type])}
            accessibilityRole="link"
            accessibilityLabel="예약 페이지 열기"
          >
            <Ionicons name="link-outline" size={18} color="#007aff" />
          </TouchableOpacity>
        </View>

        {special ? (
          <Text style={styles.emptyText}>{special}</Text>
        ) : data.length === 0 ? (
          <Text style={styles.emptyText}>예약 정보가 없습니다.</Text>
        ) : (
          data.map((slot, idx) => {
            const key = makeSlotKey(type, slot.time);
            const meta = closeMeta[key] || {};
            const closed = isClosedStatus(slot.status);
            const shownBooked = closed && meta.lastBooked != null ? meta.lastBooked : slot.available;
            const shownTotal  = closed && meta.total      != null ? meta.total      : slot.total;
            return (
              <ReservationItem
                key={`${type}-${idx}`}
                time={slot.time}
                status={slot.status}
                remaining={shownBooked}
                total={shownTotal}
                closed={isClosed(slot)}
              />
            );
          })
        )}
      </View>
    );
  };

  // =====================================================
  // JSX
  // =====================================================
  return (
    <SafeAreaView style={styles.container}>
      {/* ---- Top Date Header ---- */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>{todayString} 예약 정보</Text>
      </View>

      {/* ---- Reservation Cards ---- */}
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

// =====================================================
// Styles
// =====================================================
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  emptyText: { textAlign: 'center', fontSize: 16, marginTop: 10, color: '#888' },
  scrollContent: { paddingBottom: 80, paddingHorizontal: 0 },
});