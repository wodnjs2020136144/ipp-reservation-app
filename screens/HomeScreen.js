/**
 * HomeScreen.js
 * =====================================================
 * 예약 현황 확인 메인 화면 (UI/UX 프리미엄 고도화)
 *
 * 기능 요약:
 * 1. 서버에서 IPP/과학해설사 그룹별 예약 정보를 가져와 표시
 * 2. 그룹 간 전환이 가능한 애니메이션 토글 UI 제공
 * 3. 1분 간격 자동 새로고침 및 Pull-to-refresh(당겨서 새로고침) 기능
 * 4. 마감된 예약의 마지막 인원 수를 로컬(AsyncStorage)에 저장 및 표시
 * 5. 각 예약 정보 카드에서 공식 예약 페이지로 바로 이동하는 링크 제공
 * 6. 고급스러운 그라데이션 및 현대적인 카드 레이아웃
 * =====================================================
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar,
  TouchableOpacity,
  Linking,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAllReservations } from '../services/api';
import ReservationItem from '../components/ReservationItem';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/theme';
import LoadingView from '../components/LoadingView';

// =====================================================
// # Constants & Config
// =====================================================
const CONFIG = {
  links: {
    ai: 'https://www.cnse.or.kr/main/reserve/experience_calendar.action?q=1f960d474357a0fac696373aa47231c9819814b7d50f96cb7e020bd713813353',
    earthquake: 'https://www.cnse.or.kr/main/reserve/experience_calendar.action?q=836d40ad6724f3585ecc91c192de8f29d7b34b85db4c936465070bb8a1d25af5',
    drone: 'https://www.cnse.or.kr/main/reserve/experience_calendar.action?q=33152e18b25f10571da6b0aa11ccf9f07e6211fe37567968e6c591f23fa5c429',
    science: 'https://www.cnse.or.kr/main/reserve/guide_calendar.action?q=399c727ae1585fb2c8ac05f7295f26d0b761f9927b66e8ae3cdfc42b8534895d',
    toddler: 'https://www.cnse.or.kr/main/reserve/experience_calendar.action?q=fc018295988dd7a5d5492bc11a0bd1b31d314419ee6dca65debf4a97ef02f8bb',
    robot: 'https://www.cnse.or.kr/main/reserve/guide_calendar.action?q=cbc435e029c9390985c5e31542b88464a21905bdc4584bb7549414974b78147a',
  },
  titles: {
    ai: '인공지능 로봇 배움터',
    earthquake: '지진 VR',
    drone: '드론 VR',
    science: '기초과학해설',
    toddler: '유아과학관 자유체험',
    robot: '로봇댄스',
  },
};

const HomeScreen = () => {
  const [reservations, setReservations] = useState({ ipp: {}, commentator: {} });
  const [activeGroup, setActiveGroup] = useState('ipp');
  const [loading, setLoading] = useState(true);
  const [closeMeta, setCloseMeta] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  const linePosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(linePosition, {
      toValue: activeGroup === 'ipp' ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [activeGroup]);

  const lineLeft = linePosition.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  const todayString = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
  const todayDay = new Date().getDay();

  const loadData = useCallback(async () => {
    if (!refreshing) setLoading(true);
    try {
      const data = await fetchAllReservations();
      setReservations(data);
      setFetchFailed(!!data.fetchError);
      await processClosedSlots(data);
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
      setFetchFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const makeSlotKey = (type, time) => `${type}-${time}`;
  const isClosedStatus = (status) => status === 'closed' || status === '정원마감' || status === '시간마감';
  const isClosed = (slot) => isClosedStatus(slot.status);

  const saveCloseMeta = async (meta) => {
    try {
      await AsyncStorage.setItem('closeMeta', JSON.stringify(meta));
    } catch (e) { console.error('AsyncStorage 저장 실패:', e); }
  };

  const loadCloseMeta = async () => {
    try {
      const raw = await AsyncStorage.getItem('closeMeta');
      if (raw) setCloseMeta(JSON.parse(raw));
    } catch (e) { console.error('AsyncStorage 로드 실패:', e); }
  };

  const processClosedSlots = async (data) => {
    const newMeta = { ...closeMeta };
    Object.values(data).forEach(group => {
      Object.keys(group).forEach(type => {
        (group[type] || []).forEach(slot => {
          if (isClosedStatus(slot.status)) {
            const key = makeSlotKey(type, slot.time);
            if (!newMeta[key]) {
              newMeta[key] = { lastBooked: slot.available, total: slot.total };
            }
          }
        });
      });
    });
    setCloseMeta(newMeta);
    await saveCloseMeta(newMeta);
  };

  useEffect(() => {
    loadCloseMeta();
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60_000);
    return () => clearInterval(id);
  }, [loadData]);

  const renderGroup = (title, data, type) => {
    let special = '';
    if (todayDay === 1) special = '월요일은 과학교육원 휴관일입니다.';
    else if (todayDay === 0 && type === 'earthquake')
      special = '일요일은 지진 VR을 운영하지 않습니다.';

    return (
      <View key={type} style={styles.groupCard}>
        {/* 카드 헤더 */}
        <View style={styles.titleRow}>
          <View style={styles.titleWithIcon}>
            <View style={styles.titleIndicator} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          {CONFIG.links[type] && (
            <TouchableOpacity 
              onPress={() => Linking.openURL(CONFIG.links[type])}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>예약하기</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.accent} />
            </TouchableOpacity>
          )}
        </View>

        {/* 예약 정보 본문 */}
        <View style={styles.slotsContainer}>
          {special ? (
            <View style={styles.specialContainer}>
              <Ionicons name="information-circle-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
              <Text style={styles.specialText}>{special}</Text>
            </View>
          ) : !data || data.length === 0 ? (
            <Text style={styles.emptyText}>현재 표시할 예약 정보가 없습니다.</Text>
          ) : (
            data.map((slot, idx) => {
              const key = makeSlotKey(type, slot.time);
              const meta = closeMeta[key] || {};
              const closed = isClosedStatus(slot.status);
              const shownBooked = closed && meta.lastBooked != null ? meta.lastBooked : slot.available;
              const shownTotal = closed && meta.total != null ? meta.total : slot.total;
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
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 상단 날짜 및 헤더 카드 */}
      <View style={styles.header}>
        <Text style={styles.dateLabel}>{todayString}</Text>
        <Text style={styles.headerTitle}>예약 현황 대시보드</Text>
      </View>

      {/* IPP / 과학해설사 토글 메뉴 */}
      <View style={styles.toggleWrapper}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setActiveGroup('ipp')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, activeGroup === 'ipp' && styles.activeText]}>IPP 예약</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setActiveGroup('commentator')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, activeGroup === 'commentator' && styles.activeText]}>과학해설사 예약</Text>
          </TouchableOpacity>
          <Animated.View style={[styles.activeUnderline, { left: lineLeft }]} />
        </View>
      </View>

      {/* 서버 연결 실패 안내 배너 (데이터가 없는 것과 구분) */}
      {!loading && fetchFailed && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color="#B45309" />
          <Text style={styles.errorBannerText}>
            서버와 연결하지 못했습니다. 아래로 당겨서 다시 시도해주세요.
          </Text>
        </View>
      )}

      {/* 로딩 인디케이터 또는 컨텐츠 */}
      {loading ? (
        <LoadingView text="최신 예약 현황 수집 중..." bold />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.accent]} />
          }
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {reservations[activeGroup] && Object.keys(reservations[activeGroup]).map(type =>
            renderGroup(
              CONFIG.titles[type],
              reservations[activeGroup][type],
              type
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  dateLabel: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 2,
  },
  // --- 토글 UI 스타일 ---
  toggleWrapper: {
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  toggleContainer: {
    flexDirection: 'row',
    position: 'relative',
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  toggleText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  activeText: {
    color: COLORS.accent,
  },
  activeUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '50%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#FDE68A',
  },
  errorBannerText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  // --- 컨텐츠 스크롤 및 카드 스타일 ---
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  groupCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIndicator: {
    width: 4,
    height: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
  slotsContainer: {
    marginTop: 4,
  },
  specialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  specialText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#94A3B8',
    paddingVertical: 20,
  },
});