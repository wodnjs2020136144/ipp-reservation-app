/**
 * KitsScreen — 교구 관리 화면
 * Firestore:
 *   - 컬렉션 'kits'  : 교구 목록(이름/수량/수리여부/메모)
 *   - 문서   'logs/kitLogs' : 변경 이력 문자열 배열
 * 주요 기능:
 *   1) 교구 목록 조회/추가/이름·수량 수정/삭제
 *   2) 수리 상태 토글 및 메모 저장
 *   3) 모든 변경에 대한 로그 기록(최대 100개, 페이징)
 * 주의:
 *   - Firestore 보안 규칙에서 인증 사용자에게만 쓰기 허용해야 함
 *   - 네트워크 오류 시 initialKits로 안전 폴백
 */

import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Switch, TextInput, Alert, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';   // auth: 디버그용 UID 확인
import { initialKits } from '../services/dummyData';
import uuid from 'react-native-uuid';
import dayjs from 'dayjs';

// ─────────────────────────────────────────────────────────────
// UI 컬러 토큰 (일관된 버튼/배지 색상)
// ─────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#555555',  // 다크 그레이
  accent: '#777777',  // 중간 그레이
  danger: '#E53935',  // 빨간색 (휴지통 등)
  success: '#007AFF',  // 파란색 (확인/저장 등)
};

const KitsScreen = () => {
  /** 상태 관리
   * kits            : 교구 목록
   * logs            : 변경 이력 문자열 배열
   * page            : 로그 페이징 인덱스
   * LOGS_PER_PAGE   : 페이지당 로그 개수
   * LOG_HISTORY_LIMIT: 로그 저장 상한(최신 n개만 유지)
   * loading         : 초기 로딩 스피너 제어
   * memoDrafts      : 각 교구 메모 입력 임시값 {id: string}
   * newKitName      : 새 교구 이름 입력값
   * nameDrafts      : 이름 편집 임시값 {id: string}
   * editingName     : 이름 편집 모드 {id: boolean}
   * qtyDrafts       : 수량 편집 임시값(문자열) {id: string}
   */
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

  /** 개발 빌드에서만 로그 출력 (릴리즈에서는 무음) */
  const debugLog = (...args) => {
    if (__DEV__) console.log('[KitsScreen]', ...args);
  };

  // 초기 마운트: 인증 UID 디버그 출력 및 1회 데이터 로드
  useEffect(() => {
    debugLog('current auth uid =', auth.currentUser?.uid);
    loadData();
  }, []);

  // 실시간 동기화: Firestore 구독 (kits, logs)
  //  - kits 변경 시 목록·입력 임시값 동기화
  //  - logs 변경 시 화면에 즉시 반영
  //  - 언마운트 시 구독 해제
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

  // 새 로그 수신 시 페이징을 첫 페이지로 리셋
  useEffect(() => {
    setPage(0);   // 새 로그가 오면 첫 페이지로
  }, [logs]);

  /** 초기 로딩용 1회 fetch
   *  - kits 컬렉션, logs 문서 동시 로딩
   *  - 실패 시 initialKits로 폴백
   */
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

  /** kits 일괄 저장 (병렬 setDoc)
   * @param updated 최신 kits 배열
   */
  const saveData = async (updated) => {
    try {
      debugLog('saveData → kits', updated.map(k => k.id));
      await Promise.all(
        updated.map((kit) => setDoc(doc(db, 'kits', kit.id), kit))
      );
    } catch (e) {
      console.error('Firebase 저장 실패', e);
    }
  };

  /** 로그 저장: logs/kitLogs 문서에 entries 배열로 기록 */
  const saveLogs = async (updatedLogs) => {
    debugLog('saveLogs → logs/kitLogs, entries length =', updatedLogs.length);
    try {
      await setDoc(doc(db, 'logs', 'kitLogs'), { entries: updatedLogs });
    } catch (e) {
      console.error('로그 저장 실패', e);
    }
  };

  /** 로그 포맷터
   * 예: [2025-08-08 14:32] 로봇팔 수량 2→3
   */
  const createLog = (name, action) => {
    const now = dayjs();    // local time
    const timestamp = now.format('HH:mm');
    const date = now.format('YYYY-MM-DD');
    return `[${date} ${timestamp}] ${name} ${action}`;
  };

  /** 수량 증감(+/−)
   * 1) 낙관적 UI 업데이트 → Firestore 저장
   * 2) "수량 a→b" 형태로 로그 추가(상한 유지)
   */
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

  /** 수리 상태 토글 및 로그 작성 */
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

  /** 메모 저장: 개별 교구 memoDrafts[id] → kits[].memo 반영 후 저장·로그 */
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

  /** 새 교구 추가
   * - 입력값 검증(공백/중복)
   * - Firestore에 즉시 반영
   * - 로그 "추가됨" 기록
   */
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
    debugLog('addNewKit write kits/', newId);

    const log = createLog(newKit.name, '추가됨');
    const newLogs = [log, ...logs.slice(0, LOG_HISTORY_LIMIT - 1)];
    setLogs(newLogs);
    await saveLogs(newLogs);
  };

  /** 교구 삭제(확인 다이얼로그) 후 Firestore 삭제 및 로그 기록 */
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
          debugLog('deleteKit kits/', id);
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

  // 로그 페이징 파생값
  const start = page * LOGS_PER_PAGE;
  const end = start + LOGS_PER_PAGE;
  const currentLogs = logs.slice(start, end);
  const hasPrev = page > 0;
  const hasNext = end < logs.length;

  /** 이름/수량 편집 시작: 임시값 초기화 및 편집 모드 진입 */
  const startEditName = (id) => {
    const target = kits.find(k => k.id === id);
    setEditingName(prev => ({ ...prev, [id]: true }));
    setNameDrafts(prev => ({ ...prev, [id]: target?.name || '' }));
    setQtyDrafts(prev => ({ ...prev, [id]: String(target?.quantity ?? 0) }));
  };

  /** 이름/수량 편집 취소: 원래 값으로 복귀 */
  const cancelEditName = (id) => {
    const target = kits.find(k => k.id === id);
    setEditingName(prev => ({ ...prev, [id]: false }));
    setNameDrafts(prev => ({ ...prev, [id]: target?.name || '' }));
    setQtyDrafts(prev => ({ ...prev, [id]: String(target?.quantity ?? 0) }));
  };

  /** 이름/수량 저장
   * - 입력 검증(이름 공백/중복, 수량 0 이상)
   * - Firestore 저장 후 변경점 요약 로그 기록
   */
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

  /** 교구 카드 렌더러
   * - 이름/수량 편집, 수리 토글, 메모 저장, 삭제 등 액션 제공
   */
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

  // ── 화면 구성: 헤더 / 추가 입력 / 교구 목록(+로그 패널)
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

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
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

