// screens/KitsScreens.js

import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Switch, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { initialKits } from '../services/dummyData';
import uuid from 'react-native-uuid';
import dayjs from 'dayjs';

const KitsScreen = () => {
  const [kits, setKits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(0);
  const LOGS_PER_PAGE = 10;
  const LOG_HISTORY_LIMIT = 100;   // 최대 저장 로그 개수
  const [loading, setLoading] = useState(true);
  const [memoDrafts, setMemoDrafts] = useState({});
  const [newKitName, setNewKitName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(0);   // 새 로그가 오면 첫 페이지로
  }, [logs]);

  const loadData = async () => {
    try {
      const kitsSnapshot = await getDocs(collection(db, 'kits'));
      const kitsData = [];
      const drafts = {};
      kitsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        kitsData.push(data);
        drafts[data.id] = data.memo || '';
      });
      setKits(kitsData);
      setMemoDrafts(drafts);

      const logDoc = await getDoc(doc(db, 'logs', 'kitLogs'));
      if (logDoc.exists()) {
        setLogs(logDoc.data().entries || []);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error('Firebase 데이터 불러오기 실패', e);
      setKits(initialKits);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async (updated) => {
    try {
      await Promise.all(
        updated.map((kit) => setDoc(doc(db, 'kits', kit.id), kit))
      );
    } catch (e) {
      console.error('Firebase 저장 실패', e);
    }
  };

  const saveLogs = async (updatedLogs) => {
    try {
      await setDoc(doc(db, 'logs', 'kitLogs'), { entries: updatedLogs });
    } catch (e) {
      console.error('로그 저장 실패', e);
    }
  };

const createLog = (name, action) => {
  const now = dayjs().utcOffset(9);  // apply +9 hour offset for KST
  const timestamp = now.format('HH:mm');
  const date = now.format('YYYY-MM-DD');
  return `[${date} ${timestamp}] ${name} ${action}`;
};

  const changeQuantity = (id, diff) => {
    const kit = kits.find((k) => k.id === id);
    if (!kit) return;

    const updated = kits.map((k) =>
      k.id === id ? { ...k, quantity: Math.max(0, k.quantity + diff) } : k
    );

    setKits(updated);
    saveData(updated);

    const log = createLog(kit.name, `${diff > 0 ? '+' : '-'}${Math.abs(diff)}`);
    const newLogs = [log, ...logs.slice(0, LOG_HISTORY_LIMIT - 1)];
    setLogs(newLogs);
    saveLogs(newLogs);
  };

  const toggleRepair = (id) => {
    const kit = kits.find((k) => k.id === id);
    const updated = kits.map((k) =>
      k.id === id ? { ...k, repairing: !k.repairing } : k
    );
    setKits(updated);
    saveData(updated);

    const status = !kit.repairing ? '수리 시작' : '수리 완료';
    const log = createLog(kit.name, status);
    const newLogs = [log, ...logs.slice(0, LOG_HISTORY_LIMIT - 1)];
    setLogs(newLogs);
    saveLogs(newLogs);
  };

  const updateMemo = (id) => {
    const draft = memoDrafts[id];
    const updated = kits.map((k) => (k.id === id ? { ...k, memo: draft } : k));
    setKits(updated);
    saveData(updated);

    const kit = kits.find((k) => k.id === id);
    const log = createLog(kit.name, '메모 수정');
    const newLogs = [log, ...logs.slice(0, LOG_HISTORY_LIMIT - 1)];
    setLogs(newLogs);
    saveLogs(newLogs);
  };

  const addNewKit = async () => {
    if (!newKitName.trim()) return;
    const newKit = {
      id: uuid.v4(),
      name: newKitName.trim(),
      quantity: 0,
      repairing: false,
      memo: '',
    };
    const updated = [newKit, ...kits];
    setKits(updated);
    setMemoDrafts((prev) => ({ ...prev, [newKit.id]: '' }));
    setNewKitName('');
    await saveData(updated);

    const log = createLog(newKit.name, '추가됨');
    const newLogs = [log, ...logs.slice(0, LOG_HISTORY_LIMIT - 1)];
    setLogs(newLogs);
    await saveLogs(newLogs);
  };

  const deleteKit = async (id) => {
    const kit = kits.find((k) => k.id === id);
    Alert.alert('삭제 확인', `${kit.name}을(를) 삭제할까요?`, [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const updated = kits.filter((k) => k.id !== id);
          setKits(updated);
          await deleteDoc(doc(db, 'kits', id));
          const log = createLog(kit.name, '삭제됨');
          const newLogs = [log, ...logs.slice(0, LOG_HISTORY_LIMIT - 1)];
          setLogs(newLogs);
          await saveLogs(newLogs);
        },
      },
    ]);
  };

  const start = page * LOGS_PER_PAGE;
  const end = start + LOGS_PER_PAGE;
  const currentLogs = logs.slice(start, end);
  const hasPrev = page > 0;
  const hasNext = end < logs.length;

  const renderKit = ({ item }) => (
    <View style={styles.kitCard}>
      <View style={styles.kitHeader}>
        <Text style={styles.kitName}>{item.name}</Text>
        <Text style={styles.kitQuantity}>{item.quantity}개</Text>
      </View>

      <View style={styles.kitButtons}>
        <View style={styles.repairRow}>
          <Text style={styles.repairLabel}>수리 중</Text>
          <Switch
            value={item.repairing || false}
            onValueChange={() => toggleRepair(item.id)}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity onPress={() => changeQuantity(item.id, -1)} style={styles.button}>
            <Text style={styles.btnText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeQuantity(item.id, 1)} style={styles.button}>
            <Text style={styles.btnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteKit(item.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.memoRow}>
        <TextInput
          style={styles.memoInput}
          placeholder="메모 입력..."
          value={memoDrafts[item.id] || ''}
          onChangeText={(text) =>
            setMemoDrafts((prev) => ({ ...prev, [item.id]: text }))
          }
          multiline
        />
        <TouchableOpacity onPress={() => updateMemo(item.id)} style={styles.memoConfirmButton}>
          <Ionicons name="checkmark-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>교구 관리</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
            <Ionicons name="refresh" size={18} color="#007aff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 16 }} />

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        <FlatList
          ListHeaderComponent={() => (
            <View style={styles.addKitRow}>
              <TextInput
                style={styles.addKitInput}
                placeholder="새 교구 이름 입력"
                value={newKitName}
                onChangeText={setNewKitName}
              />
              <TouchableOpacity onPress={addNewKit} style={styles.addKitButton}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          data={kits}
          renderItem={renderKit}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <View style={styles.logCard}>
              <Text style={styles.logTitle}>변경 로그</Text>
              <View style={styles.logContainer}>
                <View style={{ maxHeight: 220 }}>
                  <FlatList
                    data={currentLogs}
                    keyExtractor={(_, index) => index.toString()}
                    renderItem={({ item }) => <Text style={styles.logItem}>{item}</Text>}
                  />
                </View>
                {logs.length > LOGS_PER_PAGE && (
                  <View style={styles.pagerRow}>
                    <TouchableOpacity
                      disabled={!hasPrev}
                      onPress={() => hasPrev && setPage((p) => p - 1)}
                      style={[styles.pagerButton, !hasPrev && { opacity: 0.3 }]}
                    >
                      <Ionicons name="chevron-back" size={20} color="#007aff" />
                    </TouchableOpacity>
                    <Text style={styles.pagerText}>
                      {page + 1} / {Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE))}
                    </Text>
                    <TouchableOpacity
                      disabled={!hasNext}
                      onPress={() => hasNext && setPage((p) => p + 1)}
                      style={[styles.pagerButton, !hasNext && { opacity: 0.3 }]}
                    >
                      <Ionicons name="chevron-forward" size={20} color="#007aff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default KitsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  resetIconButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ff3b30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addKitRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,       // add space below header
    marginBottom: 16,
    alignItems: 'center',
  },
  addKitInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  addKitButton: { marginLeft: 10, padding: 8, backgroundColor: '#007aff', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  kitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,     // vertical spacing between cards
    marginHorizontal: 20,  // horizontal inset from edges
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  kitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',   // 수직 중앙 정렬
  },
  kitName: { fontSize: 17, fontWeight: '600' }, 
  kitQuantity: {
    fontSize: 20,           // 더 크게
    fontWeight: '700',
    color: '#333',
  },
  kitButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, alignItems: 'center' },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  button: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#007aff', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  deleteButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ff3b30', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  repairRow: { flexDirection: 'row', alignItems: 'center' },
  repairLabel: { fontSize: 14, marginRight: 10 },
  memoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  memoInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, fontSize: 14, minHeight: 40 },
  memoConfirmButton: { marginLeft: 10, padding: 8, backgroundColor: '#007aff', borderRadius: 8 },
  logCard: {
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
  logContainer: { 
    marginTop: 8,
    paddingHorizontal: 4,
  },
  logTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  logItem: { fontSize: 14, color: '#444', marginBottom: 4 },
  pagerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  pagerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pagerText: {
    fontSize: 14,
    color: '#007aff',
    fontWeight: '600',
    marginHorizontal: 4,
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
});