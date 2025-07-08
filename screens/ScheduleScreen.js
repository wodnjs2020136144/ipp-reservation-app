// screens/ScheduleScreen.js
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, TextInput, Button } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';

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
  const [employees, setEmployees] = useState(['', '', '']);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [inputName, setInputName] = useState('');
  const [viewMode, setViewMode] = useState('week');

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

  const saveName = () => {
    const newEmps = [...employees];
    newEmps[selectedIndex] = inputName.trim();
    setEmployees(newEmps);
    const newOffsets = [...startOffsets];
    newOffsets[selectedIndex] = tempOffset;
    setStartOffsets(newOffsets);
    setModalVisible(false);
  };

  const today = dayjs();
  // Generate schedule data with weekend logic
  const scheduleData = useMemo(() => {
    const list = [];
    const month = today.month();
    const year = today.year();
    const lastDate = dayjs(new Date(year, month + 1, 0)).date();
    let weekdayCounter = 0;
    for (let date = 1; date <= lastDate; date++) {
      const d = dayjs(new Date(year, month, date));
      const dow = d.day();
      // Skip Monday
      if (dow === 1) continue;
      // Weekday (Tue- Fri)
      if (dow >= 2 && dow <= 5) {
        list.push({
          date: d.format('YYYY-MM-DD'),
          zone: zones[(weekdayCounter + startOffsets[selectedIndex]) % zones.length],
        });
        weekdayCounter++;
        continue;
      }
      // Saturday
      if (dow === 6) {
        // determine week index (0-based)
        const weekIndex = Math.ceil(date / 7) - 1;
        const monthWeeks = Math.ceil(lastDate / 7);
        const initWeeks = monthWeeks === 5 ? 3 : 2;
        let firstZone, secondZone;
        const offset = startOffsets[selectedIndex];
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
        if (startOffsets[selectedIndex] === 0) {
          list.push({ date: d.format('YYYY-MM-DD'), zone: zones[0] });
          list.push({ date: d.format('YYYY-MM-DD'), zone: zones[1] });
        }
      }
    }
    return list;
  }, [selectedIndex, viewMode]);

  // Week view filtered data with weekend grouping
  const filteredData = useMemo(() => {
    if (viewMode !== 'week') return [];
    const weekItems = scheduleData.filter(item => {
      const diff = dayjs(item.date).diff(today, 'day');
      return diff >= 0 && diff < 7;
    });
    // group by date, combining weekend slots
    const grouped = weekItems.reduce((acc, item) => {
      const idx = acc.findIndex(x => x.date === item.date);
      if (idx > -1) {
        acc[idx].zones.push(item.zone);
      } else {
        acc.push({ date: item.date, zones: [item.zone] });
      }
      return acc;
    }, []);
    // sort by date
    return grouped.sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
  }, [scheduleData, viewMode]);

  // Month view uses scheduleData for calendarData building
  const monthData = scheduleData;

  const calendarData = useMemo(() => {
    if (viewMode !== 'month') return [];
    const year = today.year();
    const month = today.month(); // 0-index
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
  }, [viewMode, monthData]);

  return (
    <View style={styles.container}>
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
              style={{ marginBottom: 12 }}
            >
              {zones.map((z, i) => (
                <Picker.Item key={z} label={z} value={i} />
              ))}
            </Picker>
            <Button title="저장" onPress={saveName} />
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

      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.iconToggle, viewMode === 'week' && styles.iconToggleActive]}
          onPress={() => setViewMode('week')}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={viewMode === 'week' ? '#fff' : '#888'}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.iconText, viewMode === 'week' && styles.iconTextActive]}>
            주간
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconToggle, viewMode === 'month' && styles.iconToggleActive]}
          onPress={() => setViewMode('month')}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={viewMode === 'month' ? '#fff' : '#888'}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.iconText, viewMode === 'month' && styles.iconTextActive]}>
            월간
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'month' ? (
        <>
          <Text style={styles.monthLabel}>
            {today.year()}년 {String(today.month() + 1).padStart(2, '0')}월
          </Text>

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
                  <View
                    key={cell.key}
                    style={[
                      styles.calCell,
                      isWeekend(cell.date) && styles.calCellWeekend,
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
                  </View>
                )
              )}
            </View>
          </View>
        </>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={item => item.date}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                {
                  borderLeftColor: isWeekend(item.date)
                    ? weekendBorderColor
                    : zoneColors[item.zones[0]],
                },
              ]}
            >
              <Text style={styles.date}>
                {`${item.date} (${['일','월','화','수','목','금','토'][new Date(item.date).getDay()]}요일)`}
              </Text>
              <View style={styles.badgeContainer}>
                {item.zones.map((z, i) => (
                  <View
                    key={i}
                    style={[
                      styles.badge,
                      {
                        backgroundColor: isWeekend(item.date)
                          ? weekendZoneColors[z]
                          : zoneColors[z],
                      },
                    ]}
                  >
                    <Text style={styles.badgeText}>{z}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>스케줄이 없습니다.</Text>}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  );
};

export default ScheduleScreen;

const zoneColors = {
  인공지능: '#FFB74D', // orange
  'VR체험 및 수학체험센터': '#4FC3F7', // light blue
  로봇배움터: '#81C784', // green
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#fff' },
  selector: { flexDirection: 'row', marginBottom: 8, borderBottomWidth: 1, borderColor: '#ddd' },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
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
  },
  badge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
});