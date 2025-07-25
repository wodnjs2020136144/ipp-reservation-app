// screens/KitsScreens.js

import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Switch, TextInput, Alert, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { initialKits } from '../services/dummyData';
import uuid from 'react-native-uuid';
import dayjs from 'dayjs';

const COLORS = {
  primary: '#555555',  // 다크 그레이
  accent: '#777777',  // 중간 그레이
  danger: '#E53935',  // 빨간색 (휴지통 등)
  success: '#007AFF',  // 파란색 (확인/저장 등)
};

const KitsScreen = () => {
  const [kits, setKits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(0);
  const LOGS_PER_PAGE = 10;
  const LOG_HISTORY_LIMIT = 100;   // 최대 저장 로그 개수
  const [loading, setLoading] = useState(true);
  const [memoDrafts, setMemoDrafts] = useState({});
  const [newKitName, setNewKitName] = useState('');
  const [nameDrafts, setNameDrafts] = useState({});
  const [editingName, setEditingName] = useState({});
  const [qtyDrafts, setQtyDrafts] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  // 실시간 Firestore 동기화
  useEffect(() => {
    const unsubscribeKits = onSnapshot(collection(db, 'kits'), snap => {
      const kitsData = [];
      const drafts = {};
      const nameDraftTemp = {};
      snap.forEach(docSnap => {
        const data = docSnap.data();
        kitsData.push(data);
        drafts[data.id] = data.memo || '';
        nameDraftTemp[data.id] = data.name || '';
      });
      setKits(kitsData);
      setMemoDrafts(drafts);
      setNameDrafts(nameDraftTemp);
    });

    const unsubscribeLogs = onSnapshot(doc(db, 'logs', 'kitLogs'), snap => {
      if (snap.exists()) {
        setLogs(snap.data().entries || []);
      } else {
        setLogs([]);
      }
    });

    return () => {
      unsubscribeKits();
      unsubscribeLogs();
    };
  }, []);

  useEffect(() => {
    setPage(0);   // 새 로그가 오면 첫 페이지로
  }, [logs]);

  const loadData = async () => {
    try {
      const kitsSnapshot = await getDocs(collection(db, 'kits'));
      const kitsData = [];
      const drafts = {};
      const nameDraftInit = {};
      kitsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        kitsData.push(data);
        drafts[data.id] = data.memo || '';
        nameDraftInit[data.id] = data.name || '';
      });
      setKits(kitsData);
      setMemoDrafts(drafts);
      setNameDrafts(nameDraftInit);

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
    const now = dayjs();    // local time
    const timestamp = now.format('HH:mm');
    const date = now.format('YYYY-MM-DD');
    return `[${date} ${timestamp}] ${name} ${action}`;
  };

  const changeQuantity = (id, diff) => {
    const kit = kits.find((k) => k.id === id);
    if (!kit) return;

    const oldQty = kit.quantity;
    const newQty = Math.max(0, oldQty + diff);

    const updated = kits.map((k) =>
      k.id === id ? { ...k, quantity: newQty } : k
    );

    setKits(updated);
    saveData(updated);

    const log = createLog(kit.name, `수량 ${oldQty}→${newQty}`);
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
    const trimmed = newKitName.trim();
    if (!trimmed) {
      Alert.alert('오류', '교구 이름을 입력해주세요.');
      return;
    }
    if (kits.some(k => k.name === trimmed)) {
      Alert.alert('오류', '이미 존재하는 교구 이름입니다.');
      return;
    }
    const newId = uuid.v4();
    const newKit = {
      id: newId,
      name: trimmed,
      quantity: 0,
      repairing: false,
      memo: '',
    };
    const updated = [newKit, ...kits];
    setKits(updated);
    setMemoDrafts((prev) => ({ ...prev, [newKit.id]: '' }));
    setNewKitName('');
    await setDoc(doc(db, 'kits', newId), newKit);

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

  const startEditName = (id) => {
    const target = kits.find(k => k.id === id);
    setEditingName(prev => ({ ...prev, [id]: true }));
    setNameDrafts(prev => ({ ...prev, [id]: target?.name || '' }));
    setQtyDrafts(prev => ({ ...prev, [id]: String(target?.quantity ?? 0) }));
  };

  const cancelEditName = (id) => {
    const target = kits.find(k => k.id === id);
    setEditingName(prev => ({ ...prev, [id]: false }));
    setNameDrafts(prev => ({ ...prev, [id]: target?.name || '' }));
    setQtyDrafts(prev => ({ ...prev, [id]: String(target?.quantity ?? 0) }));
  };

  const saveKitName = async (id) => {
    const draftName = (nameDrafts[id] || '').trim();
    if (!draftName) {
      Alert.alert('오류', '교구 이름을 입력해주세요.');
      return;
    }
    if (kits.some(k => k.name === draftName && k.id !== id)) {
      Alert.alert('오류', '이미 존재하는 교구 이름입니다.');
      return;
    }

    let rawQty = qtyDrafts[id];
    let parsedQty = parseInt(rawQty, 10);
    if (isNaN(parsedQty) || parsedQty < 0) {
      Alert.alert('오류', '수량은 0 이상의 숫자로 입력해주세요.');
      return;
    }

    const oldKit = kits.find(k => k.id === id);
    const updated = kits.map(k => (k.id === id ? { ...k, name: draftName, quantity: parsedQty } : k));
    setKits(updated);
    await saveData(updated);

    let actionMsgParts = [];
    if (oldKit.name !== draftName) actionMsgParts.push(`이름 변경 → ${draftName}`);
    if (oldKit.quantity !== parsedQty) actionMsgParts.push(`수량 ${oldKit.quantity}→${parsedQty}`);
    const actionMsg = actionMsgParts.length ? actionMsgParts.join(', ') : '수정됨';

    const log = createLog(oldKit.name, actionMsg);
    const newLogs = [log, ...logs.slice(0, LOG_HISTORY_LIMIT - 1)];
    setLogs(newLogs);
    await saveLogs(newLogs);

    setEditingName(prev => ({ ...prev, [id]: false }));
  };

  const renderKit = ({ item }) => (
    <View style={styles.kitCard}>
      <View style={styles.kitHeader}>
        <View style={styles.kitTitleBox}>
          {editingName[item.id] ? (
            <TextInput
              style={styles.nameInput}
              value={nameDrafts[item.id] || ''}
              onChangeText={(t) => setNameDrafts(prev => ({ ...prev, [item.id]: t }))}
            />
          ) : (
            <Text style={styles.kitName}>{item.name}</Text>
          )}
        </View>
        <View style={styles.kitHeaderRight}>
          {editingName[item.id] ? (
            <TextInput
              style={styles.quantityInput}
              keyboardType="number-pad"
              value={qtyDrafts[item.id] || ''}
              onChangeText={(t) => setQtyDrafts(prev => ({ ...prev, [item.id]: t }))}
            />
          ) : (
            <Text style={styles.kitQuantity}>{item.quantity}개</Text>
          )}

          {editingName[item.id] ? (
            <View style={styles.nameEditButtons}>
              <TouchableOpacity onPress={() => saveKitName(item.id)} style={styles.nameSaveBtn}>
                <Ionicons name="checkmark-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => cancelEditName(item.id)} style={styles.nameCancelBtn}>
                <Ionicons name="close-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => startEditName(item.id)} style={styles.nameEditBtn}>
              <Ionicons name="create-outline" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.actionRow}>
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
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        <View style={{ flex: 1 }}>
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
          <FlatList
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
        </View>
      )}
    </SafeAreaView>
  );
};

export default KitsScreen;

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
  addKitButton: { marginLeft: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: COLORS.primary, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
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
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  button: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  deleteButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  repairRow: { flexDirection: 'row', alignItems: 'center' },
  repairLabel: { fontSize: 14, marginRight: 10 },
  memoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  memoInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, fontSize: 14, minHeight: 40 },
  memoConfirmButton: { marginLeft: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: COLORS.success, borderRadius: 6 },
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
  nameInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 120,
    fontSize: 16,
  },
  nameEditButtons: {
    flexDirection: 'row',
    marginLeft: 8,
    alignItems: 'center',
  },
  nameSaveBtn: {
    marginLeft: 6,
    padding: 5,
    backgroundColor: COLORS.success,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameCancelBtn: {
    marginLeft: 6,
    padding: 5,
    backgroundColor: COLORS.danger,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameEditBtn: {
    marginLeft: 8,
    padding: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kitTitleBox: {
    flex: 1,
    marginRight: 8,
  },
  kitHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 16,
    textAlign: 'center',
    marginRight: 6,
  },
});

