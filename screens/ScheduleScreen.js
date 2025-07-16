// screens/ScheduleScreen.js
import React, { useState, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, TextInput, Button, ScrollView, Switch } from 'react-native';
import { StatusBar, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const isWeekend = dateStr => {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday(0) or Saturday(6)
};

const zones = ['인공지능', 'VR체험 및 수학체험센터', '로봇배움터'];

const weekendZoneColors = {
  인공지능: '#FFA726', // deep orange
  'VR체험 및 수학체험센터': '#42A5F5', // vivid blue
  로봇배움터: '#66BB6A', // medium green
};

const weekendBorderColor = '#8E24AA'; // purple for weekend entries

const ScheduleScreen = () => {
  // Load saved employees and offsets
  useEffect(() => {
    (async () => {
      try {
        // Load local
        const emps = await AsyncStorage.getItem('employees');
        const offs = await AsyncStorage.getItem('startOffsets');
        const memos = await AsyncStorage.getItem('dateMemos');
        let localEmps = emps ? JSON.parse(emps) : null;
        let localOffs = offs ? JSON.parse(offs) : null;
        let localDateMemos = memos ? JSON.parse(memos) : null;
        // Load Firestore
        const docRef = doc(db, 'settings', 'scheduleConfig');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.employees) localEmps = data.employees;
          if (data.startOffsets) localOffs = data.startOffsets;
          if (data.dateMemos) localDateMemos = data.dateMemos;
          // Persist to local
          await AsyncStorage.setItem('employees', JSON.stringify(localEmps));
          await AsyncStorage.setItem('startOffsets', JSON.stringify(localOffs));
          await AsyncStorage.setItem('dateMemos', JSON.stringify(localDateMemos));
        }
        if (localEmps) setEmployees(localEmps);
        if (localOffs) setStartOffsets(localOffs);
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
      if (data.startOffsets) setStartOffsets(data.startOffsets);

      if (data.dateMemos) {
        const sanitized = (data.employees || ['', '', '']).map(
          (_, i) => data.dateMemos[i] || {}
        );
        setDateMemos(sanitized);
      }

      // 로컬 캐시도 갱신
      await AsyncStorage.multiSet([
        ['employees', JSON.stringify(data.employees)],
        ['startOffsets', JSON.stringify(data.startOffsets)],
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

  const [startOffsets, setStartOffsets] = useState([0, 0, 0]);
  const [tempOffset, setTempOffset] = useState(0);

  useEffect(() => {
    if (modalVisible) {
      setInputName(employees[selectedIndex] || '');
      setTempOffset(startOffsets[selectedIndex] || 0);
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
    const newOffsets = [...startOffsets];
    newOffsets[selectedIndex] = tempOffset;
    setStartOffsets(newOffsets);
    // persist changes
    await AsyncStorage.setItem('employees', JSON.stringify(newEmps));
    await AsyncStorage.setItem('startOffsets', JSON.stringify(newOffsets));
    await AsyncStorage.setItem('dateMemos', JSON.stringify(dateMemos));
    // persist to Firestore (undefined 제거)
    const configRef = doc(db, 'settings', 'scheduleConfig');
    await setDoc(configRef, {
      employees: newEmps,
      startOffsets: newOffsets,
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
  // Generate schedule data with weekend logic, using displayMonth/displayYear
  const scheduleData = useMemo(() => {
    const list = [];
    const month = displayMonth;
    const year = displayYear;
    const lastDate = dayjs(new Date(year, month + 1, 0)).date();
    // Collect all Saturdays in the month
    const saturdayDates = [];
    for (let d2 = 1; d2 <= lastDate; d2++) {
      if (dayjs(new Date(year, month, d2)).day() === 6) {
        saturdayDates.push(d2);
      }
    }
    const saturdayCount = saturdayDates.length;
    // Determine initial non-swapping weeks: if 5 saturdays, first 3; if 4 saturdays, first 2
    const initWeeks = saturdayCount === 5 ? 3 : 2;
    let weekdayCounter = 0;
    // effective weekend offset shifts by monthOffset each month, reversed direction
    const effOffset = ((startOffsets[selectedIndex] - monthOffset) % zones.length + zones.length) % zones.length;
    for (let date = 1; date <= lastDate; date++) {
      const d = dayjs(new Date(year, month, date));
      const dow = d.day();
      // Skip Monday
      if (dow === 1) continue;
      // Weekday (Tue- Fri)
      if (dow >= 2 && dow <= 5) {
        list.push({
          date: d.format('YYYY-MM-DD'),
          zone: zones[(weekdayCounter + effOffset) % zones.length],
        });
        weekdayCounter++;
        continue;
      }
      // Saturday
      if (dow === 6) {
        // determine week index (0-based)
        const weekIndex = Math.ceil(date / 7) - 1;
        let firstZone, secondZone;
        const offset = effOffset;
        if (offset === 1) {
          if (weekIndex < initWeeks) {
            firstZone = zones[0];
            secondZone = zones[1];
          } else {
            firstZone = zones[1];
            secondZone = zones[0];
          }
        } else if (offset === 2) {
          if (weekIndex < initWeeks) {
            firstZone = zones[1];
            secondZone = zones[0];
          } else {
            firstZone = zones[0];
            secondZone = zones[1];
          }
        }
        if (offset !== 0) {
          list.push({ date: d.format('YYYY-MM-DD'), zone: firstZone });
          list.push({ date: d.format('YYYY-MM-DD'), zone: secondZone });
        }
        continue;
      }
      // Sunday
      if (dow === 0) {
        if (effOffset === 0) {
          list.push({ date: d.format('YYYY-MM-DD'), zone: zones[0] });
          list.push({ date: d.format('YYYY-MM-DD'), zone: zones[1] });
        }
      }
    }
    return list;
  }, [selectedIndex, displayMonth, displayYear, startOffsets, monthOffset]);

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
            <Text style={{ marginBottom: 8 }}>{modalDate} 메모 및 월차</Text>
            <TextInput
              placeholder="메모 입력"
              value={modalMemo}
              onChangeText={setModalMemo}
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text>월차</Text>
              <Switch value={modalLeave} onValueChange={setModalLeave} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={async () => {
                  const updatedAll = [...dateMemos];
                  const empMemos = { ...(updatedAll[selectedIndex] || {}) };
                  empMemos[modalDate] = { memo: modalMemo, isLeave: modalLeave };
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
            <TextInput
              placeholder="직원 이름 입력"
              value={inputName}
              onChangeText={setInputName}
              style={styles.input}
            />
            <Text style={{ marginBottom: 8 }}>첫날 직무 선택</Text>
            <Picker
              selectedValue={tempOffset}
              onValueChange={setTempOffset}
              style={{ marginBottom: 12, color: '#000' }}   // 글씨 보이도록 색 지정
            >
              {zones.map((z, i) => (
                <Picker.Item key={z} label={z} value={i} color="#000" />
              ))}
            </Picker>

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
                      }}
                      style={[
                        styles.calCell,
                        isWeekend(cell.date) && styles.calCellWeekend,
                        cell.date === today.format('YYYY-MM-DD') && styles.calCellToday,
                        (dateMemos[selectedIndex]?.[cell.date]?.isLeave) && styles.leaveCell,
                      ]}
                    >
                      <Text style={styles.calDate}>{cell.day}</Text>
                      {cell.schedules.map((sch, idx) => (
                        <Text
                          key={idx}
                          style={[
                            styles.calDetail,
                            { color: zoneColors[sch.zone] || '#000' },
                          ]}
                        >
                          {sch.label}
                        </Text>
                      ))}
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
            const monthLast  = dayjs(new Date(displayYear, displayMonth + 1, 0));

            const displayStart = weekStart.isBefore(monthFirst) ? monthFirst : weekStart;
            const displayEnd   = weekEnd.isAfter(monthLast)     ? monthLast   : weekEnd;

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
            const zonesForDay = scheduleData.filter(it => it.date === dateStr).map(it => it.zone);
            const currentEmployeeMemos = dateMemos[selectedIndex] || {};
            return (
              <TouchableOpacity
                key={dateStr}
                onPress={() => {
                  setModalDate(dateStr);
                  const currentEmployeeMemos = dateMemos[selectedIndex] || {};
                  setModalMemo(currentEmployeeMemos[dateStr]?.memo || '');
                  setModalLeave(currentEmployeeMemos[dateStr]?.isLeave || false);
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
  인공지능: '#FFB74D', // orange
  'VR체험 및 수학체험센터': '#4FC3F7', // light blue
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
});
