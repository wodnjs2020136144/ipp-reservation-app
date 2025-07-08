// screens/ScheduleScreen.js
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const isWeekend = dateStr => {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday(0) or Saturday(6)
};

const dummy = {
  김무현: [
    { id: '1', date: '2025-07-08', period: '오전', zone: '인공지능' },
    { id: '2', date: '2025-07-09', period: '오후', zone: 'VR체험 및 수학체험센터' },
  ],
  김운빈: [
    { id: '3', date: '2025-07-08', period: '오전', zone: 'VR체험 및 수학체험센터' },
    { id: '4', date: '2025-07-10', period: '오후', zone: '로봇배움터' },
  ],
  황재원: [
    { id: '5', date: '2025-07-08', period: '오전', zone: '로봇배움터' },
    { id: '6', date: '2025-07-11', period: '오후', zone: '인공지능' },
  ],
};

const zoneColors = {
  인공지능: '#FFB74D', // orange
  'VR체험 및 수학체험센터': '#4FC3F7', // light blue
  로봇배움터: '#81C784', // green
};

const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];

const people = ['김무현', '김운빈', '황재원'];

const ScheduleScreen = () => {
  const [selected, setSelected] = useState('김무현');
  const [viewMode, setViewMode] = useState('week'); // 'week' 또는 'month'

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.card,
        { borderLeftColor: zoneColors[item.zone] || '#007aff' },
      ]}
    >
      <Text style={styles.date}>
        {`${item.date} (${weekdayNames[new Date(item.date).getDay()]}요일)`}
      </Text>
      {item.name && <Text style={styles.name}>{item.name}</Text>}
      <Text
        style={[
          styles.zone,
          { color: zoneColors[item.zone] || '#000' },
        ]}
      >
        {isWeekend(item.date) ? `${item.period} ${item.zone}` : item.zone}
      </Text>
    </View>
  );

  const today = new Date();
  const monthData = useMemo(() => {
    if (viewMode !== 'month') return [];
    const items = [];
    dummy[selected].forEach(it => {
      const d = new Date(it.date);
      if (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth()
      ) {
        items.push(it); // {id, date, period, zone}
      }
    });
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    return items;
  }, [viewMode, selected]);

  const calendarData = useMemo(() => {
    if (viewMode !== 'month') return [];
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-index
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun)~6
    const lastDate = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ empty: true, key: `e${i}` });
    }
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const schedules = monthData
        .filter(it => it.date === dateStr)
        .map(it => ({
          label: isWeekend(it.date) ? `${it.period} ${it.zone}` : it.zone,
          zone: it.zone,
        }));
      cells.push({ day: d, date: dateStr, schedules, key: dateStr });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ empty: true, key: `e${cells.length}` });
    }
    return cells;
  }, [viewMode, monthData, isWeekend]);

  const filteredData = dummy[selected].filter(item => {
    const date = new Date(item.date);
    if (viewMode === 'week') {
      const diff = (date - today) / 86400000; // 일 단위 차이
      return diff >= 0 && diff < 7;
    }
    if (viewMode === 'month') {
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth()
      );
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.selector}>
        {people.map(name => (
          <TouchableOpacity
            key={name}
            style={[
              styles.navItem,
              selected === name && styles.navItemActive,
            ]}
            onPress={() => setSelected(name)}
          >
            <Text
              style={[
                styles.navText,
                selected === name && styles.navTextActive,
              ]}
            >
              {name}
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
            {today.getFullYear()}년 {String(today.getMonth() + 1).padStart(2, '0')}월
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
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>스케줄이 없습니다.</Text>}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  );
};

export default ScheduleScreen;

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
  name: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
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
  calName: { fontSize: 10 },
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
});