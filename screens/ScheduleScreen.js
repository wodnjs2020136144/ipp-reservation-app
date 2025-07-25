// screens/ScheduleScreen.js
import React, { useState, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, TextInput, Button, ScrollView, Switch } from 'react-native';
import { StatusBar, Platform } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const isWeekend = dateStr => {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday(0) or Saturday(6)
};

const zones = ['인공지능배움터', 'VR체험', '로봇배움터'];

const weekendZoneColors = {
  인공지능배움터: '#FFA726', // deep orange
  VR체험: '#42A5F5', // vivid blue
  로봇배움터: '#66BB6A', // medium green
};

// 직무별 아이콘 (Ionicons)
const zoneIcons = {
  인공지능배움터: { lib: 'fa', name: 'brain' },               // FontAwesome5
  VR체험: { lib: 'fa', name: 'vr-cardboard' }, // FontAwesome5
  로봇배움터: { lib: 'fa', name: 'robot' },              // FontAwesome5
};

const weekendBorderColor = '#8E24AA'; // purple for weekend entries

const ScheduleScreen = () => {
  // Load saved employees and offsets
  useEffect(() => {
    (async () => {
      try {
        // Load local
        const emps = await AsyncStorage.getItem('employees');
        const memos = await AsyncStorage.getItem('dateMemos');
        let localEmps = emps ? JSON.parse(emps) : null;
        let localDateMemos = memos ? JSON.parse(memos) : null;
        // Load Firestore
        const docRef = doc(db, 'settings', 'scheduleConfig');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.employees) localEmps = data.employees;
          if (data.dateMemos) localDateMemos = data.dateMemos;
          // Persist to local
          await AsyncStorage.setItem('employees', JSON.stringify(localEmps));
          await AsyncStorage.setItem('dateMemos', JSON.stringify(localDateMemos));
        }
        if (localEmps) setEmployees(localEmps);
        // dateMemos is now per‑employee array of objects
        if (localDateMemos) {
          // 인덱스가 비어있으면 빈 객체로 채워서 undefined 제거
          const sanitized = (localEmps || ['', '', '']).map((_, i) => localDateMemos[i] || {});
          setDateMemos(sanitized);
        } else {
          // per‑employee date memos: array of objects for each employee
          setDateMemos((localEmps || ['', '', '']).map(() => ({})));
        }
      } catch (e) {
        console.warn('Failed to load schedule settings', e);
      }
    })();
  }, []);
  // Firestore 실시간 동기화: 다른 사용자가 수정해도 즉시 반영
  useEffect(() => {
    const configRef = doc(db, 'settings', 'scheduleConfig');
    const unsubscribe = onSnapshot(configRef, async snap => {
      if (!snap.exists()) return;
      const data = snap.data();

      // 상태 업데이트
      if (data.employees) setEmployees(data.employees);

      if (data.dateMemos) {
        const sanitized = (data.employees || ['', '', '']).map(
          (_, i) => data.dateMemos[i] || {}
        );
        setDateMemos(sanitized);
      }

      // 로컬 캐시도 갱신
      await AsyncStorage.multiSet([
        ['employees', JSON.stringify(data.employees)],
        ['dateMemos', JSON.stringify(data.dateMemos)],
      ]);
    });

    return () => unsubscribe();
  }, []);
  const [employees, setEmployees] = useState(['', '', '']);
  // 각 직원마다 독립된 빈 객체를 생성해 동일 레퍼런스 문제 방지
  const [dateMemos, setDateMemos] = useState(() =>
    Array.from({ length: (employees && employees.length) || 3 }, () => ({}))
  );
  const [modalDate, setModalDate] = useState(null);       // currently selected date string
  const [modalMemo, setModalMemo] = useState('');
  const [modalOverrideZones, setModalOverrideZones] = useState([]);
  const [modalLeave, setModalLeave] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [inputName, setInputName] = useState('');
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, up to 11 - baseMonth
  const [weekOffset, setWeekOffset] = useState(0);
  const weekScrollRef = useRef(null);

  // Reset weekOffset to 0 whenever monthOffset changes
  useEffect(() => {
    setWeekOffset(0);
    if (weekScrollRef.current) {
      weekScrollRef.current.scrollTo({ x: 0, animated: false });
    }
  }, [monthOffset]);

  // 수평 스크롤: 주간이 바뀔 때마다 첫 카드로 스크롤
  useEffect(() => {
    if (weekScrollRef.current) {
      weekScrollRef.current.scrollTo({ x: 0, animated: false });
    }
  }, [weekOffset]);

  // 평일 직무 순환 리스트 (인공지능배움터 -> VR체험 -> 로봇)
  const TASKS = ['인공지능배움터', 'VR체험', '로봇배움터'];
  // 직무 순환 시작 기준일 (직원1이 인공지능으로 시작하는 날짜)
  const START_DATE = '2025-07-01'; // YYYY-MM-DD
  // 주말 전용 직무 (로봇배움터 제외)
  const WEEKEND_TASKS = ['인공지능배움터', 'VR체험'];
  const START_MONTH = '2025-07'; // YYYY-MM (7월을 기준으로 월 단위 로테이션 계산)

  // START_MONTH로부터 현재 월까지의 차이를 구해 직원 로테이션에 사용
  const monthDiffFromStart = (year, month) => {
    const start = dayjs(START_MONTH + '-01');
    const cur = dayjs(new Date(year, month, 1));
    return cur.diff(start, 'month');
  };

  // 이번 달의 주말 역할(일요일 담당, 토요일 슬롯A, 슬롯B)을 직원 인덱스에 매핑
  // 초기(2025-07): sun=직원1(0), satA=직원2(1), satB=직원3(2)
  const getWeekendRoleMapping = (year, month) => {
    const diff = monthDiffFromStart(year, month);
    // base order [0,1,2] => rotate by diff
    const base = [0, 1, 2];
    const rotated = base.map(i => (i + diff) % 3);
    return {
      sun: rotated[0],  // 일요일 담당 직원 인덱스
      satA: rotated[1], // 토요일 오전 AI/오후 VR 패턴 담당 직원 인덱스 (초기 기준)
      satB: rotated[2], // 토요일 오전 VR/오후 AI 패턴 담당 직원 인덱스 (초기 기준)
    };
  };

  // 토요일 개수(4 or 5)에 따라 교대 시작 주차를 반환 (1-based)
  const getSaturdaySwapStartWeek = (saturdayCount) => (saturdayCount === 4 ? 3 : 4);

  useEffect(() => {
    if (modalVisible) {
      setInputName(employees[selectedIndex] || '');
    }
  }, [modalVisible]);

  // Handle name input
  const onSelectTab = index => {
    setSelectedIndex(index);
  };

  const saveName = async () => {
    const newEmps = [...employees];
    newEmps[selectedIndex] = inputName.trim();
    setEmployees(newEmps);
    // persist changes
    await AsyncStorage.setItem('employees', JSON.stringify(newEmps));
    await AsyncStorage.setItem('dateMemos', JSON.stringify(dateMemos));
    // persist to Firestore (undefined 제거)
    const configRef = doc(db, 'settings', 'scheduleConfig');
    await setDoc(configRef, {
      employees: newEmps,
      dateMemos: dateMemos.map(v => v || {}),
    });
    setModalVisible(false);
  };

  // Compute displayed month/year based on offset
  const base = dayjs();
  const baseMonth = base.month();      // zero-based
  const baseYear = base.year();
  const displayMonthIndex = baseMonth + monthOffset;
  const displayYear = baseYear + Math.floor(displayMonthIndex / 12);
  const displayMonth = displayMonthIndex % 12;
  const today = dayjs();
  // For weekly schedule base (start of week), depends on monthOffset
  const baseStart = monthOffset === 0
    ? today
    : dayjs(new Date(displayYear, displayMonth, 1));
  // 화~금 평일만 카운트하여 순환 인덱스를 계산
  const getZoneForDate = (empIndex, dateStr) => {
    const target = dayjs(dateStr);
    const start = dayjs(START_DATE);
    if (target.isBefore(start, 'day')) return TASKS[empIndex % TASKS.length];

    let weekdayCount = 0; // 화~금 근무일 카운트
    for (let d = start; d.isBefore(target, 'day') || d.isSame(target, 'day'); d = d.add(1, 'day')) {
      const dow = d.day();
      if (dow >= 2 && dow <= 5) {
        weekdayCount += 1;
      }
    }
    // 첫 근무일(START_DATE)도 포함해서 계산했으므로 -1 보정 후 offset
    const offset = empIndex; // 직원1=0, 직원2=1, 직원3=2
    const idx = ((weekdayCount - 1) + offset) % TASKS.length;
    return TASKS[idx];
  };

  const scheduleData = useMemo(() => {
    const list = [];
    const month = displayMonth;
    const year = displayYear;
    const lastDate = dayjs(new Date(year, month + 1, 0)).date();

    // 1) 평일(화~금) 스케줄: 기존 로직 그대로
    for (let date = 1; date <= lastDate; date++) {
      const current = dayjs(new Date(year, month, date));
      const dow = current.day();
      if (dow >= 2 && dow <= 5) { // Tue~Fri
        const ds = current.format('YYYY-MM-DD');
        const zone = getZoneForDate(selectedIndex, ds);
        list.push({ date: ds, zone });
      }
    }

    // 2) 주말(토/일) 스케줄: 평일 로직과 완전히 분리하여 처리
    // 토요일은 2명 근무, 일요일은 1명 근무. 로봇배움터 제외.
    // 주말 직원 포지션은 달 단위로 로테이션.

    // 토요일 목록 추출 및 주차 계산
    const saturdays = [];
    for (let d = 1; d <= lastDate; d++) {
      const cur = dayjs(new Date(year, month, d));
      if (cur.day() === 6) saturdays.push(cur);
    }
    const saturdayCount = saturdays.length;
    const swapStartWeek = getSaturdaySwapStartWeek(saturdayCount); // 3 or 4

    // 일요일 목록 추출
    const sundays = [];
    for (let d = 1; d <= lastDate; d++) {
      const cur = dayjs(new Date(year, month, d));
      if (cur.day() === 0) sundays.push(cur);
    }

    // 이번 달 역할 매핑 (직원 인덱스)
    const { sun: sunIdx, satA: satAIdx, satB: satBIdx } = getWeekendRoleMapping(year, month);

    // 토요일 패턴 정의
    const patternA = ['인공지능배움터', 'VR체험']; // 오전 AI, 오후 VR
    const patternB = ['VR체험', '인공지능배움터']; // 오전 VR, 오후 AI

    // 토요일 처리
    saturdays.forEach((satDate, idx) => {
      // idx: 0-based (첫 토요일이 idx=0) → weekNum = idx+1
      const weekNum = idx + 1;
      const beforeSwap = weekNum < swapStartWeek; // 교대 전 구간
      const afterSwap = !beforeSwap;              // 교대 후 구간

      // 교대 전/후에 따라 패턴을 적용
      const thisPatternA = beforeSwap ? patternA : patternB; // slotA 담당자의 패턴
      const thisPatternB = beforeSwap ? patternB : patternA; // slotB 담당자의 패턴

      const ds = satDate.format('YYYY-MM-DD');

      // 선택된 직원(selectedIndex)에 따라 해당 날짜에 자신이 맡은 직무를 list에 추가
      if (selectedIndex === satAIdx) {
        // 오전, 오후 두 개 등록
        list.push({ date: ds, zone: thisPatternA[0] });
        list.push({ date: ds, zone: thisPatternA[1] });
      }
      if (selectedIndex === satBIdx) {
        list.push({ date: ds, zone: thisPatternB[0] });
        list.push({ date: ds, zone: thisPatternB[1] });
      }
    });

    // 일요일 처리: 한 명이 두 직무 모두 담당 (오전/오후 구분 없음이지만, 아이콘/표시를 위해 두 개로 넣어도 됨)
    sundays.forEach(sunDate => {
      const ds = sunDate.format('YYYY-MM-DD');
      if (selectedIndex === sunIdx) {
        // 두 직무 모두 등록 (표시용)
        list.push({ date: ds, zone: WEEKEND_TASKS[0] });
        list.push({ date: ds, zone: WEEKEND_TASKS[1] });
      }
    });

    return list;
  }, [selectedIndex, displayMonth, displayYear, monthOffset]);

  // Month view uses scheduleData for calendarData building
  const monthData = scheduleData;

  const calendarData = useMemo(() => {
    const year = displayYear;
    const month = displayMonth; // 0-index
    const firstDay = dayjs(new Date(year, month, 1)).day(); // 0 (Sun)~6
    const lastDate = dayjs(new Date(year, month + 1, 0)).date();

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ empty: true, key: `e${i}` });
    }
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const schedules = monthData
        .filter(it => it.date === dateStr)
        .map(it => ({
          label: isWeekend(it.date) ? `${it.zone}` : it.zone,
          zone: it.zone,
        }));
      const overrideZones = (dateMemos[selectedIndex] || {})[dateStr]?.overrideZones;
      if (overrideZones && Array.isArray(overrideZones) && overrideZones.length > 0) {
        schedules.splice(0, schedules.length);
        overrideZones.forEach(z => {
          schedules.push({ label: isWeekend(dateStr) ? `${z}` : z, zone: z });
        });
      }
      cells.push({ day: d, date: dateStr, schedules, key: dateStr });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ empty: true, key: `e${cells.length}` });
    }
    return cells;
  }, [monthData, displayYear, displayMonth]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          disabled={monthOffset === 0}
          onPress={() => setMonthOffset(prev => prev - 1)}
        >
          <Ionicons name="chevron-back" size={24} color={monthOffset === 0 ? '#CCC' : '#000'} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {displayYear}년 {String(displayMonth + 1).padStart(2, '0')}월
        </Text>
        <TouchableOpacity
          disabled={monthOffset === (11 - baseMonth)}
          onPress={() => setMonthOffset(prev => prev + 1)}
        >
          <Ionicons name="chevron-forward" size={24} color={monthOffset === (11 - baseMonth) ? '#CCC' : '#000'} />
        </TouchableOpacity>
      </View>
      {/* Date Memo/Leave Modal */}
      <Modal visible={modalDate !== null} transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={{ marginBottom: 8 }}>{modalDate} 수정</Text>
            <TextInput
              placeholder="메모 입력"
              value={modalMemo}
              onChangeText={setModalMemo}
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text>월차</Text>
              <Switch value={modalLeave} onValueChange={setModalLeave} />
            </View>
            {/* 직무 수정 영역 */}
            <Text style={{ marginBottom: 6 }}>직무</Text>
            {(() => {
              if (!modalDate) return null;
              const weekend = isWeekend(modalDate);
              const candidateZones = weekend ? WEEKEND_TASKS : TASKS;

              const toggleZone = (z) => {
                setModalOverrideZones(prev => {
                  if (prev.includes(z)) {
                    return prev.filter(v => v !== z);
                  } else {
                    return [...prev, z];
                  }
                });
              };

              return (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                  {candidateZones.map(z => (
                    <TouchableOpacity
                      key={z}
                      onPress={() => toggleZone(z)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: modalOverrideZones.includes(z) ? '#007aff' : '#ccc',
                        backgroundColor: modalOverrideZones.includes(z) ? '#E3F2FD' : '#fff',
                        marginRight: 6,
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ color: '#000', fontSize: 12 }}>{z}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={async () => {
                  const updatedAll = [...dateMemos];
                  const empMemos = { ...(updatedAll[selectedIndex] || {}) };
                  empMemos[modalDate] = { memo: modalMemo, isLeave: modalLeave, overrideZones: modalOverrideZones };
                  updatedAll[selectedIndex] = empMemos;

                  // undefined → {} 로 정규화
                  const sanitized = updatedAll.map(v => v || {});
                  setDateMemos(sanitized);

                  await AsyncStorage.setItem('dateMemos', JSON.stringify(sanitized));
                  const configRef = doc(db, 'settings', 'scheduleConfig');
                  await setDoc(configRef, { dateMemos: sanitized }, { merge: true });

                  setModalDate(null);
                }}>
                <Text style={styles.modalButtonText}>저장</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                onPress={() => setModalDate(null)}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={{ marginBottom: 8, fontSize: 16, fontWeight: '600' }}>
              {`직원 ${selectedIndex + 1} 이름 수정`}
            </Text>
            <TextInput
              placeholder="직원 이름 입력"
              value={inputName}
              onChangeText={setInputName}
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity style={styles.modalButton} onPress={saveName}>
                <Text style={styles.modalButtonText}>저장</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.selector}>
        {employees.map((name, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.navItem, selectedIndex === idx && styles.navItemActive]}
            onPress={() => onSelectTab(idx)}
            onLongPress={() => setModalVisible(true)}
          >
            <Text style={[styles.navText, selectedIndex === idx && styles.navTextActive]}>
              {name || `직원 ${idx + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.verticalScroll} contentContainerStyle={{ paddingBottom: 80 }}>

        {/* Monthly calendar always shown */}
        <View style={styles.calendarCard}>
          <View style={styles.weekHeader}>
            {['일', '월', '화', '수', '목', '금', '토'].map(day => (
              <Text key={day} style={styles.weekHeaderCell}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.calendar}>
            {calendarData.map(cell =>
              cell.empty ? (
                <View key={cell.key} style={styles.calCellEmpty} />
              ) : (
                (() => {
                  return (
                    <TouchableOpacity
                      key={cell.key}
                      onPress={() => {
                        setModalDate(cell.date);
                        // Per-employee dateMemos
                        const currentEmployeeMemos = dateMemos[selectedIndex] || {};
                        setModalMemo(currentEmployeeMemos[cell.date]?.memo || '');
                        setModalLeave(currentEmployeeMemos[cell.date]?.isLeave || false);
                        const origZones = scheduleData.filter(it => it.date === cell.date).map(it => it.zone);
                        const overrideData = (dateMemos[selectedIndex] || {})[cell.date]?.overrideZones;
                        setModalOverrideZones(overrideData && Array.isArray(overrideData) ? overrideData : origZones);
                      }}
                      style={[
                        styles.calCell,
                        isWeekend(cell.date) && styles.calCellWeekend,
                        cell.date === today.format('YYYY-MM-DD') && styles.calCellToday,
                        (dateMemos[selectedIndex]?.[cell.date]?.isLeave) && styles.leaveCell,
                      ]}
                    >
                      <Text style={styles.calDate}>{cell.day}</Text>
                      <View style={styles.calIconRow}>
                        {cell.schedules.map((sch, idx) => {
                          const icon = zoneIcons[sch.zone] || {};
                          if (icon.lib === 'fa') {
                            return (
                              <FontAwesome5
                                key={idx}
                                name={icon.name}
                                size={11}
                                color={zoneColors[sch.zone] || '#888'}
                                style={styles.calIcon}
                              />
                            );
                          }
                          return (
                            <Ionicons
                              key={idx}
                              name={icon.name || 'ellipse'}
                              size={12}
                              color={zoneColors[sch.zone] || '#888'}
                              style={styles.calIcon}
                            />
                          );
                        })}
                      </View>
                    </TouchableOpacity>
                  );
                })()
              )
            )}
          </View>
        </View>

        {/* Weekly schedule for current month */}
        <View style={styles.weekHeaderRow}>
          <TouchableOpacity
            onPress={() => setWeekOffset(w => w - 1)}
            disabled={weekOffset === 0}
          >
            <Ionicons name="chevron-back" size={20} color={weekOffset === 0 ? '#CCC' : '#000'} />
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
                {displayStart.format('MM/DD')} - {displayEnd.format('MM/DD')}
              </Text>
            );
          })()}
          <TouchableOpacity
            onPress={() => setWeekOffset(w => w + 1)}
            disabled={
              (() => {
                const lastDateInMonth = dayjs(new Date(displayYear, displayMonth + 1, 0));
                const nextWeekStart = baseStart.add((weekOffset + 1) * 7, 'day');
                // 마지막 날 이후로 넘어가면 비활성화
                return nextWeekStart.isAfter(lastDateInMonth, 'day');
              })()
            }
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                (() => {
                  const lastDateInMonth = dayjs(new Date(displayYear, displayMonth + 1, 0));
                  const nextWeekStart = baseStart.add((weekOffset + 1) * 7, 'day');
                  return nextWeekStart.isAfter(lastDateInMonth, 'day') ? '#CCC' : '#000';
                })()
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
            // 해당 월이 아니면 빈 칸
            if (d.month() !== displayMonth) {
              return (
                <View
                  key={d.format('YYYY-MM-DD') + '_empty'}
                  style={styles.weekCellPlaceholder}
                />
              );
            }

            const dateStr = d.format('YYYY-MM-DD');
            let zonesForDay = scheduleData.filter(it => it.date === dateStr).map(it => it.zone);
            const overrideZones = (dateMemos[selectedIndex] || {})[dateStr]?.overrideZones;
            if (overrideZones && Array.isArray(overrideZones) && overrideZones.length > 0) {
              zonesForDay = overrideZones;
            }
            const currentEmployeeMemos = dateMemos[selectedIndex] || {};
            return (
              <TouchableOpacity
                key={dateStr}
                onPress={() => {
                  setModalDate(dateStr);
                  const currentEmployeeMemos = dateMemos[selectedIndex] || {};
                  setModalMemo(currentEmployeeMemos[dateStr]?.memo || '');
                  setModalLeave(currentEmployeeMemos[dateStr]?.isLeave || false);
                  const origZones = scheduleData.filter(it => it.date === dateStr).map(it => it.zone);
                  const overrideData = (dateMemos[selectedIndex] || {})[dateStr]?.overrideZones;
                  setModalOverrideZones(overrideData && Array.isArray(overrideData) ? overrideData : origZones);
                }}
                style={[
                  styles.weekCell,
                  dateStr === today.format('YYYY-MM-DD') && styles.weekCellToday,
                  currentEmployeeMemos[dateStr]?.isLeave && styles.leaveCell,
                ]}
              >
                <Text style={styles.weekCellDate}>{d.format('MM/DD (dd)')}</Text>
                {zonesForDay.map((z, idx) => (
                  <View key={idx} style={[styles.badge, { backgroundColor: zoneColors[z] }]}>
                    <Text style={styles.badgeText}>{z}</Text>
                  </View>
                ))}
                {currentEmployeeMemos[dateStr]?.memo ? (
                  <Text style={styles.weekCellMemo}>{currentEmployeeMemos[dateStr].memo}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ScheduleScreen;

const zoneColors = {
  인공지능배움터: '#FFB74D', // orange
  VR체험: '#4FC3F7', // light blue
  로봇배움터: '#81C784', // green
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 80,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  selector: { flexDirection: 'row', marginBottom: 8, borderBottomWidth: 1, borderColor: '#ddd' },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginVertical: 8,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
  },
  date: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  zone: { fontSize: 14, fontWeight: '600' }, // override earlier zone style
  empty: { textAlign: 'center', marginTop: 20, color: '#888' },
  viewToggle: { flexDirection: 'row', marginBottom: 12, justifyContent: 'center' },
  iconToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#888',
  },
  iconToggleActive: {
    backgroundColor: '#888',
  },
  iconText: { fontSize: 13, color: '#888', fontWeight: '600' },
  iconTextActive: { color: '#fff' },
  monthLabel: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginHorizontal: -6, /* stretch edge‑to‑edge inside padding */
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    flexBasis: '14.28%',
    maxWidth: '14.28%',
    padding: 4,
    minHeight: 60,
    justifyContent: 'flex-start',
    borderWidth: 0.5,
    borderColor: '#ECECEC',
  },
  calCellEmpty: {
    flexBasis: '14.28%',
    maxWidth: '14.28%',
    padding: 4,
    minHeight: 60,
    borderWidth: 0.5,
    borderColor: '#ECECEC',
  },
  calCellWeekend: { backgroundColor: '#F1F7FF' }, /* subtle light‑blue tint */
  calDate: { fontSize: 12, fontWeight: '700' },
  calDetail: { fontSize: 10 },
  calBadge: {
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginTop: 2,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  calBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  calDotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 2,
  },
  calDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    margin: 1,
  },
  weekHeader: { flexDirection: 'row' },
  weekHeaderCell: {
    flexBasis: '14.28%',
    maxWidth: '14.28%',
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  navItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007aff',
  },
  navText: { fontSize: 15, color: '#555', fontWeight: '600' },
  navTextActive: { color: '#007aff' },

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    width: '80%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  weekHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#ddd',
  },
  weekNavButton: { padding: 6 },
  weekRangeText: { fontSize: 16, fontWeight: '600' },
  weekGrid: { paddingVertical: 12, paddingHorizontal: 10, paddingBottom: 80, marginTop: 8, flexWrap: 'nowrap' },
  // 주간 셀 스타일 변경
  weekCell: {
    minWidth: 120,
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
    minHeight: 120,        // 고정 height 대신 minHeight 사용
    flexDirection: 'column',
    justifyContent: 'flex-start',
    // width: 120 제거
  },
  weekCellPlaceholder: {
    width: 0,
    minWidth: 0,
    marginRight: 0,
  },

  // 메모 텍스트 스타일에 줄 바꿈 허용
  weekCellMemo: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    color: '#666',
    flexWrap: 'wrap',      // 줄 바꿈 허용
  },
  weekCellToday: { borderColor: '#007aff', borderWidth: 2 },
  calCellToday: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  weekCellDate: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  verticalScroll: {
    flex: 1,
  },
  leaveBadge: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#D32F2F',
    textAlign: 'center'
  },
  leaveCell: {
    backgroundColor: '#FFF3E0', // light peach for leave days
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#007aff',
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  calIconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 2,
  },
  calIcon: {
    marginHorizontal: 1,
  },
});
