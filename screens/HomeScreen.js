/**
 * HomeScreen.js
 * =====================================================
 * 예약 현황 확인 메인 화면
 *
 * 기능 요약:
 * 1. 서버에서 IPP/과학해설사 그룹별 예약 정보를 가져와 표시
 * 2. 그룹 간 전환이 가능한 애니메이션 토글 UI 제공
 * 3. 1분 간격 자동 새로고침 및 Pull-to-refresh(당겨서 새로고침) 기능
 * 4. 마감된 예약의 마지막 인원 수를 로컬(AsyncStorage)에 저장 및 표시
 * 5. 각 예약 정보 카드에서 공식 예약 페이지로 바로 이동하는 링크 제공
 * =====================================================
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Platform, StatusBar, TouchableOpacity, Linking, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReservationItem from '../components/ReservationItem';
import { fetchAllReservations } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =====================================================
// # Constants & Config
// - 컴포넌트 전역에서 사용되는 설정 데이터입니다.
// =====================================================

/**
 * 모든 예약 타입의 외부 링크 URL과 화면에 표시될 제목을 관리하는 객체.
 * - 새로운 예약 타입을 추가/수정할 때 이 객체만 변경하면 됩니다.
 */
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
  // =====================================================
  // # State
  // - 컴포넌트의 상태를 관리하는 Hooks입니다.
  // =====================================================

  // 서버에서 받아온 전체 예약 정보를 그룹별로 저장하는 상태
  const [reservations, setReservations] = useState({ ipp: {}, commentator: {} });
  // 현재 선택된 그룹('ipp' 또는 'commentator')을 추적하는 상태
  const [activeGroup, setActiveGroup] = useState('ipp');
  // 데이터 로딩 상태 (초기 로딩 시 ActivityIndicator 표시용)
  const [loading, setLoading] = useState(true);
  // 마감된 슬롯의 마지막 인원/정원 정보를 저장하는 상태 ('type-HH:mm': {lastBooked, total})
  const [closeMeta, setCloseMeta] = useState({});
  // '당겨서 새로고침' UI의 활성화 상태
  const [refreshing, setRefreshing] = useState(false);

  // =====================================================
  // # Animations
  // - 토글 UI의 애니메이션을 관리합니다.
  // =====================================================

  // 토글 밑줄의 위치 값(0 또는 1)을 저장하고 애니메이션을 적용하기 위한 참조
  const linePosition = useRef(new Animated.Value(0)).current;

  // activeGroup 상태가 변경될 때마다 밑줄의 위치를 애니메이션으로 업데이트
  useEffect(() => {
    Animated.timing(linePosition, {
      toValue: activeGroup === 'ipp' ? 0 : 1, // 'ipp'는 0, 'commentator'는 1
      duration: 250,      // 0.25초 동안 애니메이션
      useNativeDriver: false, // 'left' 스타일은 네이티브 드라이버를 사용할 수 없음
    }).start();
  }, [activeGroup]);

  // linePosition 값(0~1)을 실제 CSS left 값('0%' ~ '50%')으로 변환
  const lineLeft = linePosition.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  // =====================================================
  // # Handlers & Utils
  // - 데이터 처리, 이벤트 핸들링, 유틸리티 함수들입니다.
  // =====================================================

  // 오늘 날짜를 'YYYY년 M월 D일 (요일)' 형식의 문자열로 생성
  const todayString = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
  // 오늘 요일을 숫자로 가져옴 (0: 일요일, 1: 월요일, ...)
  const todayDay = new Date().getDay();

  /**
   * 서버로부터 모든 예약 데이터를 비동기적으로 가져와 상태를 업데이트합니다.
   * - useCallback을 사용해 불필요한 함수 재생성을 방지합니다.
   */
  const loadData = useCallback(async () => {
    if (!refreshing) setLoading(true); // '당겨서 새로고침'이 아닐 때만 전체 로딩 UI 표시
    try {
      const data = await fetchAllReservations(); // API 호출
      setReservations(data);
      await processClosedSlots(data); // 마감된 슬롯 처리
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  /**
   * '당겨서 새로고침' 제스처가 발생했을 때 호출되는 핸들러.
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // 슬롯의 고유 키 생성 ('ai-15:10' 형식)
  const makeSlotKey = (type, time) => `${type}-${time}`;
  // 마감 상태인지 확인
  const isClosedStatus = (status) => status === 'closed' || status === '정원마감' || status === '시간마감';
  const isClosed = (slot) => isClosedStatus(slot.status);

  /**
   * 마감 스냅샷 데이터를 AsyncStorage에 저장합니다.
   */
  const saveCloseMeta = async (meta) => {
    try {
      await AsyncStorage.setItem('closeMeta', JSON.stringify(meta));
    } catch (e) { console.error('AsyncStorage 저장 실패:', e); }
  };

  /**
   * AsyncStorage에서 마감 스냅샷 데이터를 불러옵니다.
   */
  const loadCloseMeta = async () => {
    try {
      const raw = await AsyncStorage.getItem('closeMeta');
      if (raw) setCloseMeta(JSON.parse(raw));
    } catch (e) { console.error('AsyncStorage 로드 실패:', e); }
  };

  /**
   * API 응답 데이터에서 마감된 슬롯을 찾아 closeMeta 상태를 업데이트합니다.
   * - 이미 저장된 슬롯은 덮어쓰지 않습니다.
   */
  const processClosedSlots = async (data) => {
    const newMeta = { ...closeMeta };
    // 'ipp', 'commentator' 등 모든 그룹을 순회
    Object.values(data).forEach(group => {
      // 'ai', 'earthquake' 등 그룹 내 모든 타입을 순회
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

  // =====================================================
  // # Effects
  // - 컴포넌트의 생명주기와 관련된 부수 효과를 처리합니다.
  // =====================================================

  // 컴포넌트가 처음 마운트될 때 로컬 스냅샷 데이터를 불러옴
  useEffect(() => {
    loadCloseMeta();
  }, []);

  // 컴포넌트 마운트 시 최초 데이터를 로드하고, 60초마다 자동 갱신 설정
  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60_000);
    // 컴포넌트 언마운트 시 인터벌 정리
    return () => clearInterval(id);
  }, [loadData]);

  // =====================================================
  // # Render Helpers
  // - JSX 렌더링에 사용되는 헬퍼 함수입니다.
  // =====================================================

  /**
   * 예약 정보 카드 하나를 렌더링하는 함수.
   * @param {string} title - 카드 제목 (예: '인공지능 로봇 배움터')
   * @param {Array} data - 해당 타입의 예약 슬롯 데이터 배열
   * @param {string} type - 예약 타입 키 (예: 'ai')
   */
  const renderGroup = (title, data, type) => {
    let special = '';
    if (todayDay === 1) special = '월요일은 휴관입니다.';
    else if (todayDay === 0 && type === 'earthquake')
      special = '일요일은 지진 VR 미운영';

    return (
      <View key={type} style={styles.groupCard}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {CONFIG.links[type] && (
            <TouchableOpacity onPress={() => Linking.openURL(CONFIG.links[type])}>
              <Ionicons name="link-outline" size={18} color="#007aff" />
            </TouchableOpacity>
          )}
        </View>

        {special ? (
          <Text style={styles.emptyText}>{special}</Text>
        ) : !data || data.length === 0 ? (
          <Text style={styles.emptyText}>예약 정보가 없습니다.</Text>
        ) : (
          data.map((slot, idx) => {
            const key = makeSlotKey(type, slot.time);
            const meta = closeMeta[key] || {};
            const closed = isClosedStatus(slot.status);
            // 마감된 슬롯이면 저장된 값을, 아니면 현재 값을 보여줌
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
    );
  };

  // =====================================================
  // # Component Return
  // - 최종적으로 화면에 렌더링될 JSX입니다.
  // =====================================================
  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 날짜 헤더 */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>{todayString} 예약 정보</Text>
      </View>

      {/* IPP / 과학해설사 토글 메뉴 */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setActiveGroup('ipp')}>
          <Text style={[styles.toggleText, activeGroup === 'ipp' && styles.activeText]}>IPP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setActiveGroup('commentator')}>
          <Text style={[styles.toggleText, activeGroup === 'commentator' && styles.activeText]}>과학해설사</Text>
        </TouchableOpacity>
        {/* 선택된 그룹에 따라 움직이는 애니메이션 밑줄 */}
        <Animated.View style={[styles.activeUnderline, { left: lineLeft }]} />
      </View>

      {/* 로딩 중일 때는 로딩 아이콘, 로딩 완료 후에는 예약 목록 표시 */}
      {loading ? (
        <ActivityIndicator size="large" color="#007aff" style={{ flex: 1 }} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#007aff']} />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* 현재 활성화된 그룹의 데이터만 동적으로 렌더링 */}
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

// =====================================================
// # Styles
// - 컴포넌트의 스타일시트입니다.
// =====================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  // --- 토글 UI 스타일 ---
  toggleContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    position: 'relative', // 자식의 absolute 위치 기준점
  },
  toggleButton: {
    flex: 1, // 두 버튼이 공간을 1:1로 나누어 가짐
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleText: {
    fontSize: 15,
    color: '#555',
    fontWeight: '600',
  },
  activeText: {
    color: '#007aff', // 활성화된 탭의 텍스트 색상
  },
  activeUnderline: {
    position: 'absolute', // 컨테이너 기준으로 절대 위치
    bottom: -1, // 컨테이너 하단 경계선에 위치
    height: 2,
    width: '50%', // 항상 컨테이너 너비의 50%
    backgroundColor: '#007aff',
  },
  // --- 컨텐츠 스크롤 및 카드 스타일 ---
  scrollContent: {
    paddingBottom: 40,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333'
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 10,
    color: '#888'
  },
});