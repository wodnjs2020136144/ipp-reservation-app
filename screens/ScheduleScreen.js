/**
 * ScheduleScreen
 * =====================================================
 * 근무 스케줄 관리 화면 (UI/UX 및 아키텍처 고도화)
 *
 * 기능 요약:
 * - 월간/주간 근무 스케줄 자동 로테이션 계산
 * - 일별 근무 메모 및 월차(연차) 등록 및 동기화 (AsyncStorage ↔ Firestore)
 * - scheduleService 모듈을 통한 데이터 관심사 분리 완료
 * - Premium UI: Slate & Blue 디자인 톤, 세련된 캘린더 디자인, 커스텀 모달
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  Platform,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import dayjs from 'dayjs';
import {
  saveScheduleConfig,
  subscribeScheduleConfig
} from '../services/scheduleService';

// =====================================================
// # Design Tokens & Constants
// =====================================================
const COLORS = {
  primary: '#0F172A',       // Slate 900
  primaryLight: '#475569',  // Slate 600
  accent: '#007AFF',        // Blue
  accentLight: '#E0F2FE',   // Light Blue
  danger: '#EF4444',        // Red
  dangerLight: '#FEE2E2',   // Light Red
  success: '#10B981',       // Green
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
};

const isWeekend = dateStr => {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
};

const HOLIDAYS = {
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석',
  '2025-10-06': '추석',
  '2025-10-07': '추석',
  '2025-10-08': '대체 휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '크리스마스',
};

const isHoliday = (dateStr) => HOLIDAYS.hasOwnProperty(dateStr);

const zones = ['인공지능배움터', 'VR체험', '로봇배움터'];

const zoneColors = {
  인공지능배움터: '#FF9F0A', // Orange
  VR체험: '#0A84FF',       // Blue
  로봇배움터: '#30D158',     // Green
};

const zoneIcons = {
  인공지능배움터: { lib: 'fa', name: 'brain' },
  VR체험: { lib: 'fa', name: 'vr-cardboard' },
  로봇배움터: { lib: 'fa', name: 'robot' },
};

const TASKS = ['인공지능배움터', 'VR체험', '로봇배움터'];
const START_DATE = '2025-07-01';
const WEEKEND_TASKS = ['인공지능배움터', 'VR체험'];
const START_MONTH = '2025-07';

const ScheduleScreen = () => {
  const [employees, setEmployees] = useState(['', '', '']);
  const [dateMemos, setDateMemos] = useState(() => Array.from({ length: 3 }, () => ({})));
  const [loading, setLoading] = useState(true);

  // 모달 상태
  const [modalDate, setModalDate] = useState(null);
  const [modalMemo, setModalMemo] = useState('');
  const [modalOverrideZones, setModalOverrideZones] = useState([]);
  const [modalLeave, setModalLeave] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [inputName, setInputName] = useState('');

  // 캘린더 및 주간 오프셋
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekScrollRef = useRef(null);

  // 초기 마운트 시: 1) AsyncStorage 캐시로 즉시 화면을 채우고
  // 2) Firestore를 단일 소스로 삼아 실시간 구독을 시작한다.
  // 예전에는 최초 로드(fetchScheduleConfig 1회 조회)와 실시간 구독(onSnapshot)이
  // 각자 AsyncStorage.multiSet을 호출해 두 비동기 쓰기가 겹치면 값이 순간적으로
  // 되돌아가는 경합 조건이 있었다. 이제는 AsyncStorage 쓰기가 onSnapshot
  // 콜백 한 곳에서만 일어나도록 통합했다.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const emps = await AsyncStorage.getItem('employees');
        const memos = await AsyncStorage.getItem('dateMemos');
        if (cancelled) return;

        const localEmps = emps ? JSON.parse(emps) : null;
        const localDateMemos = memos ? JSON.parse(memos) : null;

        if (localEmps) {
          setEmployees(localEmps);
          // 로컬 캐시가 있으면 네트워크를 기다리지 않고 화면을 먼저 보여준다.
          // 이후 onSnapshot이 도착하면 Firestore 값으로 갱신된다.
          setLoading(false);
        }
        if (localDateMemos) {
          const sanitized = (localEmps || ['', '', '']).map((_, i) => localDateMemos[i] || {});
          setDateMemos(sanitized);
        } else if (localEmps) {
          setDateMemos(localEmps.map(() => ({})));
        }
      } catch (e) {
        console.warn('로컬 스케줄 캐시 불러오기 실패:', e);
      }
    })();

    const unsubscribe = subscribeScheduleConfig(async (data) => {
      if (cancelled || !data) {
        if (!cancelled) setLoading(false);
        return;
      }

      const nextEmps = data.employees || ['', '', ''];
      const nextDateMemos = nextEmps.map((_, i) => (data.dateMemos || [])[i] || {});

      setEmployees(nextEmps);
      setDateMemos(nextDateMemos);
      setLoading(false);

      try {
        await AsyncStorage.multiSet([
          ['employees', JSON.stringify(nextEmps)],
          ['dateMemos', JSON.stringify(nextDateMemos)],
        ]);
      } catch (e) {
        console.warn('스케줄 데이터 로컬 캐시 저장 실패:', e);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // 연차 사용일수 실시간 계산
  const leaveCounts = useMemo(() =>
    dateMemos.map(dm => Object.values(dm || {}).filter(v => v && v.isLeave).length),
    [dateMemos]
  );

  useEffect(() => {
    setWeekOffset(0);
    if (weekScrollRef.current) {
      weekScrollRef.current.scrollTo({ x: 0, animated: false });
    }
  }, [monthOffset]);

  useEffect(() => {
    if (weekScrollRef.current) {
      weekScrollRef.current.scrollTo({ x: 0, animated: false });
    }
  }, [weekOffset]);

  useEffect(() => {
    if (editNameModalVisible) {
      setInputName(employees[selectedIndex] || '');
    }
  }, [editNameModalVisible]);

  const saveName = async () => {
    const newEmps = [...employees];
    newEmps[selectedIndex] = inputName.trim();
    setEmployees(newEmps);

    await AsyncStorage.setItem('employees', JSON.stringify(newEmps));
    await saveScheduleConfig(newEmps, dateMemos);
    setEditNameModalVisible(false);
  };

  const monthDiffFromStart = (year, month) => {
    const start = dayjs(START_MONTH + '-01');
    const cur = dayjs(new Date(year, month, 1));
    return cur.diff(start, 'month');
  };

  const getWeekendRoleMapping = (year, month) => {
    const diff = monthDiffFromStart(year, month);
    const base = [0, 1, 2];
    const rotated = base.map(i => (i + diff) % 3);
    return {
      sun: rotated[0],
      satA: rotated[1],
      satB: rotated[2],
    };
  };

  const getSaturdaySwapStartWeek = (saturdayCount) => (saturdayCount === 4 ? 3 : 4);

  const base = dayjs();
  const baseMonth = base.month();
  const baseYear = base.year();

  const minMonthOffset = useMemo(() => {
    const curMonthStart = dayjs(new Date(baseYear, baseMonth, 1)).startOf('month');
    const startMonthStart = dayjs(START_MONTH + '-01').startOf('month');
    return startMonthStart.diff(curMonthStart, 'month');
  }, [baseYear, baseMonth]);

  const displayMonthIndex = baseMonth + monthOffset;
  const displayYear = baseYear + Math.floor(displayMonthIndex / 12);
  const displayMonth = displayMonthIndex % 12;
  const today = dayjs();

  const baseStart = monthOffset === 0 ? today : dayjs(new Date(displayYear, displayMonth, 1));

  const earliestWeekOffset = useMemo(() => {
    const earliest = dayjs(START_MONTH + '-01').startOf('week');
    const baseWeek = baseStart.startOf('week');
    return earliest.diff(baseWeek, 'week');
  }, [baseStart]);

  const getZoneForDate = (empIndex, dateStr) => {
    const target = dayjs(dateStr);
    const start = dayjs(START_DATE);
    if (target.isBefore(start, 'day')) return TASKS[empIndex % TASKS.length];

    let weekdayCount = 0;
    for (let d = start; d.isBefore(target, 'day') || d.isSame(target, 'day'); d = d.add(1, 'day')) {
      const dow = d.day();
      if (dow >= 2 && dow <= 5) {
        weekdayCount += 1;
      }
    }
    const offset = empIndex;
    const idx = ((weekdayCount - 1) + offset) % TASKS.length;
    return TASKS[idx];
  };

  // 스케줄 계산 데이터 유도
  const scheduleData = useMemo(() => {
    const list = [];
    const month = displayMonth;
    const year = displayYear;
    const lastDate = dayjs(new Date(year, month + 1, 0)).date();

    // 1) 평일(화~금) 로직
    for (let date = 1; date <= lastDate; date++) {
      const current = dayjs(new Date(year, month, date));
      const dow = current.day();
      if (dow >= 2 && dow <= 5) {
        const ds = current.format('YYYY-MM-DD');
        const zone = getZoneForDate(selectedIndex, ds);
        list.push({ date: ds, zone });
      }
    }

    // 2) 주말(토/일) 로직
    const saturdays = [];
    for (let d = 1; d <= lastDate; d++) {
      const cur = dayjs(new Date(year, month, d));
      if (cur.day() === 6) saturdays.push(cur);
    }
    const saturdayCount = saturdays.length;
    const swapStartWeek = getSaturdaySwapStartWeek(saturdayCount);

    const sundays = [];
    for (let d = 1; d <= lastDate; d++) {
      const cur = dayjs(new Date(year, month, d));
      if (cur.day() === 0) sundays.push(cur);
    }

    const { sun: sunIdx, satA: satAIdx, satB: satBIdx } = getWeekendRoleMapping(year, month);
    const patternA = ['인공지능배움터', 'VR체험'];
    const patternB = ['VR체험', '인공지능배움터'];

    saturdays.forEach((satDate, idx) => {
      const weekNum = idx + 1;
      const beforeSwap = weekNum < swapStartWeek;
      const thisPatternA = beforeSwap ? patternA : patternB;
      const thisPatternB = beforeSwap ? patternB : patternA;
      const ds = satDate.format('YYYY-MM-DD');

      if (selectedIndex === satAIdx) {
        list.push({ date: ds, zone: thisPatternA[0] });
        list.push({ date: ds, zone: thisPatternA[1] });
      }
      if (selectedIndex === satBIdx) {
        list.push({ date: ds, zone: thisPatternB[0] });
        list.push({ date: ds, zone: thisPatternB[1] });
      }
    });

    sundays.forEach(sunDate => {
      const ds = sunDate.format('YYYY-MM-DD');
      if (selectedIndex === sunIdx) {
        list.push({ date: ds, zone: WEEKEND_TASKS[0] });
        list.push({ date: ds, zone: WEEKEND_TASKS[1] });
      }
    });

    return list;
  }, [selectedIndex, displayMonth, displayYear, monthOffset]);

  // 달력 격자 구성
  const calendarData = useMemo(() => {
    const year = displayYear;
    const month = displayMonth;
    const firstDay = dayjs(new Date(year, month, 1)).day();
    const lastDate = dayjs(new Date(year, month + 1, 0)).date();

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ empty: true, key: `e${i}` });
    }
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const schedules = scheduleData
        .filter(it => it.date === dateStr)
        .map(it => ({ label: it.zone, zone: it.zone }));
      
      const overrideZones = (dateMemos[selectedIndex] || {})[dateStr]?.overrideZones;
      if (Array.isArray(overrideZones)) {
        schedules.splice(0, schedules.length);
        overrideZones.forEach(z => {
          schedules.push({ label: z, zone: z });
        });
      }

      const holidayName = HOLIDAYS[dateStr];
      const hasMemo = !!((dateMemos[selectedIndex] || {})[dateStr]?.memo?.trim());
      cells.push({
        day: d,
        date: dateStr,
        schedules,
        key: dateStr,
        isHoliday: !!holidayName,
        holidayName,
        hasMemo
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ empty: true, key: `e${cells.length}` });
    }
    return cells;
  }, [scheduleData, displayYear, displayMonth, dateMemos, selectedIndex]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 캘린더 연월 조작 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          disabled={monthOffset <= minMonthOffset}
          onPress={() => setMonthOffset(prev => Math.max(minMonthOffset, prev - 1))}
          style={styles.headerNavBtn}
        >
          <Ionicons name="chevron-back" size={22} color={monthOffset <= minMonthOffset ? '#CBD5E1' : COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {displayYear}년 {String(displayMonth + 1).padStart(2, '0')}월 스케줄
        </Text>
        <TouchableOpacity
          disabled={monthOffset === (11 - baseMonth)}
          onPress={() => setMonthOffset(prev => prev + 1)}
          style={styles.headerNavBtn}
        >
          <Ionicons name="chevron-forward" size={22} color={monthOffset === (11 - baseMonth) ? '#CBD5E1' : COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* 연차/메모 변경 모달 */}
      <Modal visible={modalDate !== null} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>{modalDate} 일정 수정</Text>
              <TouchableOpacity onPress={() => setModalDate(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* 메모 입력 */}
              <Text style={styles.modalLabel}>일정 메모</Text>
              <TextInput
                placeholder="오늘의 특이사항 또는 메모 입력"
                placeholderTextColor="#94A3B8"
                value={modalMemo}
                onChangeText={setModalMemo}
                style={styles.input}
              />

              {/* 연차(월차) 관리 */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>월차(연차) 신청</Text>
                  <Text style={styles.switchSubLabel}>사용한 월차 누적: {leaveCounts[selectedIndex]}일</Text>
                </View>
                <Switch
                  value={modalLeave}
                  onValueChange={setModalLeave}
                  trackColor={{ false: '#CBD5E1', true: COLORS.accent }}
                />
              </View>

              {/* 직무 선택 */}
              <Text style={styles.modalLabel}>담당 직무 편집 (커스텀)</Text>
              {(() => {
                if (!modalDate) return null;
                const weekend = isWeekend(modalDate);
                const candidateZones = weekend ? WEEKEND_TASKS : TASKS;

                const toggleZone = (z) => {
                  setModalOverrideZones(prev => 
                    prev.includes(z) ? prev.filter(v => v !== z) : [...prev, z]
                  );
                };

                return (
                  <View style={styles.modalZones}>
                    {candidateZones.map(z => {
                      const active = modalOverrideZones.includes(z);
                      return (
                        <TouchableOpacity
                          key={z}
                          onPress={() => toggleZone(z)}
                          style={[
                            styles.zonePill,
                            active && styles.zonePillActive
                          ]}
                        >
                          <Text style={[styles.zonePillText, active && styles.zonePillTextActive]}>{z}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => setModalDate(null)}
              >
                <Text style={styles.btnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave]}
                onPress={async () => {
                  const updatedAll = [...dateMemos];
                  const empMemos = { ...(updatedAll[selectedIndex] || {}) };
                  empMemos[modalDate] = { memo: modalMemo, isLeave: modalLeave, overrideZones: modalOverrideZones };
                  updatedAll[selectedIndex] = empMemos;

                  const sanitized = updatedAll.map(v => v || {});
                  setDateMemos(sanitized);

                  await AsyncStorage.setItem('dateMemos', JSON.stringify(sanitized));
                  await saveScheduleConfig(employees, sanitized);
                  setModalDate(null);
                }}
              >
                <Text style={styles.btnSaveText}>저장하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 직원 이름 수정 모달 */}
      <Modal visible={editNameModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>직원 이름 수정</Text>
              <TouchableOpacity onPress={() => setEditNameModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>{`직원 ${selectedIndex + 1}의 새 이름`}</Text>
              <TextInput
                placeholder="이름 입력"
                placeholderTextColor="#94A3B8"
                value={inputName}
                onChangeText={setInputName}
                style={styles.input}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setEditNameModalVisible(false)}>
                <Text style={styles.btnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={saveName}>
                <Text style={styles.btnSaveText}>저장하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 직원 탭 바 */}
      <View style={styles.tabBar}>
        {employees.map((name, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.tabItem, selectedIndex === idx && styles.tabItemActive]}
            onPress={() => setSelectedIndex(idx)}
            onLongPress={() => {
              setSelectedIndex(idx);
              setEditNameModalVisible(true);
            }}
          >
            <Text style={[styles.tabText, selectedIndex === idx && styles.tabTextActive]}>
              {name || `직원 ${idx + 1}`}
            </Text>
            {selectedIndex === idx && <View style={styles.tabLine} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loaderText}>근무 스케줄 동기화 중...</Text>
        </View>
      ) : (
        <ScrollView style={styles.mainScroll} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {/* 달력 카드 */}
          <View style={styles.calendarCard}>
            <View style={styles.weekHeader}>
              {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                <Text key={day} style={[styles.weekHeaderCell, (idx === 0 || idx === 6) && styles.weekendHeaderCell]}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarData.map(cell =>
                cell.empty ? (
                  <View key={cell.key} style={styles.calCellEmpty} />
                ) : (
                  <TouchableOpacity
                    key={cell.key}
                    onPress={() => {
                      setModalDate(cell.date);
                      const currentMemos = dateMemos[selectedIndex] || {};
                      setModalMemo(currentMemos[cell.date]?.memo || '');
                      setModalLeave(currentMemos[cell.date]?.isLeave || false);
                      const origZones = scheduleData.filter(it => it.date === cell.date).map(it => it.zone);
                      const overrideData = (dateMemos[selectedIndex] || {})[cell.date]?.overrideZones;
                      setModalOverrideZones(Array.isArray(overrideData) ? overrideData : origZones);
                    }}
                    style={[
                      styles.calCell,
                      isWeekend(cell.date) && styles.calCellWeekend,
                      cell.isHoliday && styles.calCellHoliday,
                      cell.date === today.format('YYYY-MM-DD') && styles.calCellToday,
                      (dateMemos[selectedIndex]?.[cell.date]?.isLeave) && styles.calCellLeave,
                    ]}
                  >
                    <View style={styles.cellHeader}>
                      <Text style={[
                        styles.calDate,
                        isWeekend(cell.date) && styles.weekendText,
                        cell.isHoliday && styles.holidayText
                      ]}>
                        {cell.day}
                      </Text>
                      {cell.hasMemo && <View style={styles.memoIndicatorDot} />}
                    </View>
                    
                    {cell.isHoliday ? (
                      <Text style={styles.holidayLabel} numberOfLines={1}>{cell.holidayName}</Text>
                    ) : (
                      <View style={styles.calIconRow}>
                        {cell.schedules.map((sch, idx) => {
                          const icon = zoneIcons[sch.zone] || {};
                          return (
                            <FontAwesome5
                              key={idx}
                              name={icon.name}
                              size={10}
                              color={zoneColors[sch.zone] || '#94A3B8'}
                              style={styles.calIcon}
                            />
                          );
                        })}
                      </View>
                    )}
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>

          {/* 주간 근무 상세 카드 */}
          <View style={styles.weekCard}>
            <View style={styles.weekHeaderRow}>
              <TouchableOpacity
                onPress={() => setWeekOffset(w => Math.max(earliestWeekOffset, w - 1))}
                disabled={weekOffset <= earliestWeekOffset}
                style={styles.weekPagerBtn}
              >
                <Ionicons name="chevron-back" size={18} color={weekOffset <= earliestWeekOffset ? '#CBD5E1' : COLORS.primary} />
              </TouchableOpacity>
              
              {(() => {
                const weekStart = baseStart.add(weekOffset * 7, 'day');
                const weekEnd = weekStart.add(6, 'day');
                const monthFirst = dayjs(new Date(displayYear, displayMonth, 1));
                const monthLast = dayjs(new Date(displayYear, displayMonth + 1, 0));

                const displayStart = weekStart.isBefore(monthFirst) ? monthFirst : weekStart;
                const displayEnd = weekEnd.isAfter(monthLast) ? monthLast : weekEnd;

                return (
                  <Text style={styles.weekRangeText}>
                    {displayStart.format('MM/DD')} - {displayEnd.format('MM/DD')} 주간 직무
                  </Text>
                );
              })()}

              <TouchableOpacity
                onPress={() => setWeekOffset(w => w + 1)}
                disabled={baseStart.add((weekOffset + 1) * 7, 'day').isAfter(dayjs(new Date(displayYear, displayMonth + 1, 0)), 'day')}
                style={styles.weekPagerBtn}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={
                    baseStart.add((weekOffset + 1) * 7, 'day').isAfter(dayjs(new Date(displayYear, displayMonth + 1, 0)), 'day')
                      ? '#CBD5E1'
                      : COLORS.primary
                  }
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekGrid}
              ref={weekScrollRef}
            >
              {Array.from({ length: 7 }).map((_, i) => {
                const d = baseStart.add(weekOffset * 7 + i, 'day');
                if (d.month() !== displayMonth) {
                  return <View key={d.format('YYYY-MM-DD') + '_empty'} style={styles.weekCellPlaceholder} />;
                }

                const dateStr = d.format('YYYY-MM-DD');
                const hName = HOLIDAYS[dateStr];
                let zonesForDay = scheduleData.filter(it => it.date === dateStr).map(it => it.zone);
                const overrideZones = (dateMemos[selectedIndex] || {})[dateStr]?.overrideZones;
                if (Array.isArray(overrideZones)) {
                  zonesForDay = overrideZones;
                }
                const currentMemos = dateMemos[selectedIndex] || {};
                
                return (
                  <TouchableOpacity
                    key={dateStr}
                    onPress={() => {
                      setModalDate(dateStr);
                      setModalMemo(currentMemos[dateStr]?.memo || '');
                      setModalLeave(currentMemos[dateStr]?.isLeave || false);
                      const origZones = scheduleData.filter(it => it.date === dateStr).map(it => it.zone);
                      const overrideData = (dateMemos[selectedIndex] || {})[dateStr]?.overrideZones;
                      setModalOverrideZones(Array.isArray(overrideData) ? overrideData : origZones);
                    }}
                    style={[
                      styles.weekCell,
                      hName && styles.weekCellHoliday,
                      dateStr === today.format('YYYY-MM-DD') && styles.weekCellToday,
                      currentMemos[dateStr]?.isLeave && styles.weekCellLeave,
                    ]}
                  >
                    <Text style={styles.weekCellDate}>{d.format('MM/DD (dd)')}</Text>
                    
                    {hName ? (
                      <Text style={styles.weekHolidayLabel}>{hName}</Text>
                    ) : (
                      <View style={styles.weekBadges}>
                        {zonesForDay.map((z, idx) => (
                          <View key={idx} style={[styles.badge, { backgroundColor: zoneColors[z] }]}>
                            <Text style={styles.badgeText}>{z}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {currentMemos[dateStr]?.memo ? (
                      <View style={styles.weekMemoBox}>
                        <Text style={styles.weekCellMemo} numberOfLines={2}>{currentMemos[dateStr].memo}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default ScheduleScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  headerNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  tabItemActive: {
    // Active style
  },
  tabText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  tabTextActive: {
    color: COLORS.accent,
  },
  tabLine: {
    position: 'absolute',
    bottom: 0,
    width: '60%',
    height: 3,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  mainScroll: {
    flex: 1,
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 3,
  },
  weekHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  weekHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    color: COLORS.primaryLight,
    fontSize: 12,
  },
  weekendHeaderCell: {
    color: '#94A3B8',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: '14.28%',
    height: 54,
    padding: 4,
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderColor: '#F1F5F9',
  },
  calCellEmpty: {
    width: '14.28%',
    height: 54,
    backgroundColor: '#FAFAFA',
    borderWidth: 0.5,
    borderColor: '#F1F5F9',
  },
  calCellWeekend: {
    backgroundColor: '#F8FAFC',
  },
  calCellToday: {
    borderColor: COLORS.accent,
    borderWidth: 1.5,
    borderRadius: 4,
  },
  calCellLeave: {
    backgroundColor: '#FEF3C7', // Amber 100
  },
  calCellHoliday: {
    backgroundColor: '#FEE2E2', // Red 100
  },
  cellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calDate: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  weekendText: {
    color: '#64748B',
  },
  holidayText: {
    color: COLORS.danger,
  },
  memoIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },
  holidayLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.danger,
    textAlign: 'center',
  },
  calIconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  calIcon: {
    margin: 1,
  },
  weekCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 3,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 8,
  },
  weekPagerBtn: {
    padding: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  weekRangeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  weekGrid: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  weekCell: {
    width: 110,
    height: 110,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekCellToday: {
    borderColor: COLORS.accent,
    borderWidth: 1.5,
  },
  weekCellLeave: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  weekCellHoliday: {
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
  },
  weekCellPlaceholder: {
    width: 0,
  },
  weekCellDate: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  weekHolidayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger,
  },
  weekBadges: {
    gap: 3,
    width: '100%',
  },
  badge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  weekMemoBox: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '100%',
    paddingTop: 4,
    alignItems: 'center',
  },
  weekCellMemo: {
    fontSize: 9,
    color: COLORS.primaryLight,
    textAlign: 'center',
  },
  modalBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '85%',
    maxWidth: 360,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  modalBody: {
    gap: 12,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.primary,
    backgroundColor: '#F8FAFC',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  switchSubLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  modalZones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  zonePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  zonePillActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
  },
  zonePillText: {
    fontSize: 12,
    color: COLORS.primaryLight,
    fontWeight: '600',
  },
  zonePillTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#F1F5F9',
  },
  btnCancelText: {
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  btnSave: {
    backgroundColor: COLORS.accent,
  },
  btnSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
});
