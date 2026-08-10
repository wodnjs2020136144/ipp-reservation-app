/**
 * KitsScreen — 교구 관리 화면
 * 
 * 역할:
 * - 교구 목록 조회/추가/수정/삭제 및 수리 상태 토글
 * - 모든 교구 데이터 변경에 대한 변경 로그 기록 및 관리
 * - UI/UX 개선: 모던한 컬러 팔레트, 세련된 카드 레이아웃, 직관적인 제어 컴포넌트
 */

import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  saveKit,
  saveMultipleKits,
  removeKit,
  saveLogs,
  subscribeKits,
  subscribeLogs
} from '../services/kitService';
import { initialKits } from '../services/dummyData';
import uuid from 'react-native-uuid';
import dayjs from 'dayjs';

// 디자인 시스템 컬러 토큰
const COLORS = {
  primary: '#0F172A',      // Slate 900 (헤더 및 주요 텍스트)
  primaryLight: '#334155', // Slate 700 (서브 텍스트)
  accent: '#007AFF',       // iOS Blue (버튼 및 하이라이트)
  accentLight: '#E0F2FE',  // Light Blue (배경 강조)
  danger: '#EF4444',       // Red (삭제 등)
  dangerLight: '#FEE2E2',  // Light Red (경고 배경)
  success: '#10B981',      // Green (메모 저장 등)
  successLight: '#D1FAE5',  // Light Green (성공 배경)
  bg: '#F8FAFC',           // Slate 50 (전체 배경)
  cardBg: '#FFFFFF',       // White (카드 배경)
  border: '#E2E8F0',       // Slate 200 (경계선)
};

const KitsScreen = () => {
  const [kits, setKits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(0);
  const LOGS_PER_PAGE = 5;
  const LOG_HISTORY_LIMIT = 100;
  const [loading, setLoading] = useState(true);

  const [newKitName, setNewKitName] = useState('');
  const [memoDrafts, setMemoDrafts] = useState({});
  const [nameDrafts, setNameDrafts] = useState({});
  const [editingName, setEditingName] = useState({});
  const [qtyDrafts, setQtyDrafts] = useState({});

  useEffect(() => {
    // 실시간 동기화 구독 시작
    const unsubscribeKits = subscribeKits((updatedKits) => {
      // 만약 데이터베이스가 완전히 비어있다면, 더미 데이터로 초기화
      if (updatedKits.length === 0 && loading) {
        saveMultipleKits(initialKits);
        setKits(initialKits);
      } else {
        setKits(updatedKits);
      }
      
      // 입력 폼 임시 상태 동기화
      const memoDraftsTemp = {};
      const nameDraftsTemp = {};
      updatedKits.forEach(kit => {
        memoDraftsTemp[kit.id] = kit.memo || '';
        nameDraftsTemp[kit.id] = kit.name || '';
      });
      setMemoDrafts(prev => ({ ...memoDraftsTemp, ...prev }));
      setNameDrafts(prev => ({ ...nameDraftsTemp, ...prev }));
      setLoading(false);
    });

    const unsubscribeLogs = subscribeLogs((updatedLogs) => {
      setLogs(updatedLogs);
    });

    return () => {
      unsubscribeKits();
      unsubscribeLogs();
    };
  }, []);

  // 새 로그 수신 시 페이징을 첫 페이지로 리셋
  useEffect(() => {
    setPage(0);
  }, [logs]);

  const createLog = (name, action) => {
    const now = dayjs();
    const timestamp = now.format('HH:mm');
    const date = now.format('YYYY-MM-DD');
    return `[${date} ${timestamp}] ${name} ${action}`;
  };

  const handleUpdateLogs = async (logText) => {
    const newLogs = [logText, ...logs.slice(0, LOG_HISTORY_LIMIT - 1)];
    setLogs(newLogs);
    await saveLogs(newLogs);
  };

  // 수량 증감
  const changeQuantity = async (id, diff) => {
    const kit = kits.find((k) => k.id === id);
    if (!kit) return;

    const oldQty = kit.quantity;
    const newQty = Math.max(0, oldQty + diff);
    const updatedKit = { ...kit, quantity: newQty };

    await saveKit(updatedKit);
    await handleUpdateLogs(createLog(kit.name, `수량 변경: ${oldQty}개 → ${newQty}개`));
  };

  // 수리 상태 토글
  const toggleRepair = async (id) => {
    const kit = kits.find((k) => k.id === id);
    if (!kit) return;

    const nextRepairState = !kit.repairing;
    const updatedKit = { ...kit, repairing: nextRepairState };

    await saveKit(updatedKit);
    const statusText = nextRepairState ? '수리 진행' : '수리 완료';
    await handleUpdateLogs(createLog(kit.name, `${statusText}`));
  };

  // 메모 저장
  const updateMemo = async (id) => {
    const kit = kits.find((k) => k.id === id);
    if (!kit) return;

    const draft = memoDrafts[id] || '';
    const updatedKit = { ...kit, memo: draft };

    await saveKit(updatedKit);
    await handleUpdateLogs(createLog(kit.name, '메모 업데이트'));
    Alert.alert('알림', '메모가 성공적으로 저장되었습니다.');
  };

  // 새 교구 추가
  const addNewKit = async () => {
    const trimmed = newKitName.trim();
    if (!trimmed) {
      Alert.alert('경고', '교구 이름을 입력해주세요.');
      return;
    }
    if (kits.some(k => k.name === trimmed)) {
      Alert.alert('경고', '이미 존재하는 교구입니다.');
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

    await saveKit(newKit);
    setNewKitName('');
    await handleUpdateLogs(createLog(trimmed, '새로운 교구 추가'));
  };

  // 교구 삭제
  const deleteKit = (id) => {
    const kit = kits.find((k) => k.id === id);
    if (!kit) return;

    Alert.alert('교구 삭제', `정말로 "${kit.name}"을(를) 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await removeKit(id);
          await handleUpdateLogs(createLog(kit.name, '교구 삭제됨'));
        },
      },
    ]);
  };

  // 이름 및 수량 개별 편집 진입
  const startEditMode = (id) => {
    const target = kits.find(k => k.id === id);
    if (!target) return;
    setEditingName(prev => ({ ...prev, [id]: true }));
    setNameDrafts(prev => ({ ...prev, [id]: target.name }));
    setQtyDrafts(prev => ({ ...prev, [id]: String(target.quantity) }));
  };

  // 편집 취소
  const cancelEditMode = (id) => {
    setEditingName(prev => ({ ...prev, [id]: false }));
  };

  // 편집 저장
  const saveKitEdits = async (id) => {
    const draftName = (nameDrafts[id] || '').trim();
    const rawQty = qtyDrafts[id];
    const parsedQty = parseInt(rawQty, 10);

    if (!draftName) {
      Alert.alert('오류', '교구 이름을 입력해주세요.');
      return;
    }
    if (kits.some(k => k.name === draftName && k.id !== id)) {
      Alert.alert('오류', '동일한 이름의 교구가 이미 존재합니다.');
      return;
    }
    if (isNaN(parsedQty) || parsedQty < 0) {
      Alert.alert('오류', '수량은 0 이상의 정수로 입력해야 합니다.');
      return;
    }

    const oldKit = kits.find(k => k.id === id);
    if (!oldKit) return;

    const updatedKit = { ...oldKit, name: draftName, quantity: parsedQty };
    await saveKit(updatedKit);

    let logsToSend = [];
    if (oldKit.name !== draftName) logsToSend.push(`이름 변경: ${oldKit.name} → ${draftName}`);
    if (oldKit.quantity !== parsedQty) logsToSend.push(`수량 변경: ${oldKit.quantity}개 → ${parsedQty}개`);
    
    const finalLog = logsToSend.length > 0 ? logsToSend.join(', ') : '정보 편집 완료';
    await handleUpdateLogs(createLog(oldKit.name, finalLog));

    setEditingName(prev => ({ ...prev, [id]: false }));
  };

  // 페이징 처리용 로그 가공
  const startIdx = page * LOGS_PER_PAGE;
  const endIdx = startIdx + LOGS_PER_PAGE;
  const currentLogs = logs.slice(startIdx, endIdx);
  const hasPrev = page > 0;
  const hasNext = endIdx < logs.length;

  const renderKitItem = ({ item }) => {
    const isEditing = editingName[item.id];

    return (
      <View style={styles.kitCard}>
        {/* 카드 헤더 (이름 및 수량) */}
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            {isEditing ? (
              <TextInput
                style={styles.nameInput}
                value={nameDrafts[item.id] || ''}
                onChangeText={(t) => setNameDrafts(prev => ({ ...prev, [item.id]: t }))}
                placeholder="교구 명칭"
              />
            ) : (
              <Text style={styles.kitName}>{item.name}</Text>
            )}
          </View>

          <View style={styles.quantityContainer}>
            {isEditing ? (
              <TextInput
                style={styles.qtyInput}
                value={qtyDrafts[item.id] || ''}
                onChangeText={(t) => setQtyDrafts(prev => ({ ...prev, [item.id]: t }))}
                keyboardType="numeric"
                maxLength={4}
              />
            ) : (
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>{item.quantity} 개</Text>
              </View>
            )}

            {/* 수정 액션 버튼 */}
            {isEditing ? (
              <View style={styles.editActions}>
                <TouchableOpacity onPress={() => saveKitEdits(item.id)} style={[styles.editBtn, styles.saveBtn]}>
                  <Ionicons name="checkmark-outline" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => cancelEditMode(item.id)} style={[styles.editBtn, styles.cancelBtn]}>
                  <Ionicons name="close-outline" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => startEditMode(item.id)} style={styles.actionIconButton}>
                <Ionicons name="create-outline" size={18} color={COLORS.accent} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 제어 패널 (수리 상태 및 수량 변경) */}
        <View style={styles.controlPanel}>
          <View style={styles.repairContainer}>
            <Text style={styles.controlLabel}>수리 여부</Text>
            <Switch
              value={item.repairing || false}
              onValueChange={() => toggleRepair(item.id)}
              trackColor={{ false: '#CBD5E1', true: COLORS.success }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#FFF'}
            />
            {item.repairing && (
              <View style={styles.repairBadge}>
                <Text style={styles.repairBadgeText}>수리 중</Text>
              </View>
            )}
          </View>

          <View style={styles.qtyButtons}>
            <TouchableOpacity onPress={() => changeQuantity(item.id, -1)} style={styles.qtyBtn}>
              <Ionicons name="remove" size={16} color={COLORS.primaryLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeQuantity(item.id, 1)} style={styles.qtyBtn}>
              <Ionicons name="add" size={16} color={COLORS.primaryLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteKit(item.id)} style={[styles.qtyBtn, styles.deleteBtnBg]}>
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 메모 영역 */}
        <View style={styles.memoContainer}>
          <TextInput
            style={styles.memoInput}
            value={memoDrafts[item.id] || ''}
            onChangeText={(t) => setMemoDrafts(prev => ({ ...prev, [item.id]: t }))}
            placeholder="비고 및 관리 메모 입력..."
            placeholderTextColor="#94A3B8"
            multiline
          />
          <TouchableOpacity onPress={() => updateMemo(item.id)} style={styles.memoSaveBtn}>
            <Ionicons name="save-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>교구 현황 관리</Text>
        <Text style={styles.headerSubtitle}>수업용 교재 및 키트 실시간 모니터링</Text>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loaderText}>데이터를 가져오는 중입니다...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* 교구 신규 추가 */}
          <View style={styles.addInputGroup}>
            <TextInput
              style={styles.addInput}
              value={newKitName}
              onChangeText={setNewKitName}
              placeholder="추가할 새 교구 이름 입력"
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity onPress={addNewKit} style={styles.addButton}>
              <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.addButtonText}>추가</Text>
            </TouchableOpacity>
          </View>

          {/* 교구 리스트 */}
          <FlatList
            data={kits}
            renderItem={renderKitItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              logs.length > 0 && (
                <View style={styles.logWrapper}>
                  <View style={styles.logHeader}>
                    <Ionicons name="reader-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.logTitle}>기기 변경 히스토리</Text>
                  </View>
                  <View style={styles.logList}>
                    {currentLogs.map((log, idx) => (
                      <View key={idx} style={styles.logItemRow}>
                        <Text style={styles.logItemText}>{log}</Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* 로그 페이징 */}
                  {logs.length > LOGS_PER_PAGE && (
                    <View style={styles.logPager}>
                      <TouchableOpacity
                        disabled={!hasPrev}
                        onPress={() => hasPrev && setPage(p => p - 1)}
                        style={[styles.pagerBtn, !hasPrev && styles.pagerBtnDisabled]}
                      >
                        <Ionicons name="chevron-back" size={16} color={hasPrev ? COLORS.accent : '#94A3B8'} />
                      </TouchableOpacity>
                      <Text style={styles.pagerText}>
                        {page + 1} / {Math.ceil(logs.length / LOGS_PER_PAGE)}
                      </Text>
                      <TouchableOpacity
                        disabled={!hasNext}
                        onPress={() => hasNext && setPage(p => p + 1)}
                        style={[styles.pagerBtn, !hasNext && styles.pagerBtnDisabled]}
                      >
                        <Ionicons name="chevron-forward" size={16} color={hasNext ? COLORS.accent : '#94A3B8'} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
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
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  addInputGroup: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 46,
    fontSize: 14,
    color: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  addButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  kitCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 10,
  },
  kitName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F8FAFC',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBadge: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  qtyText: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  qtyInput: {
    width: 60,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#F8FAFC',
  },
  actionIconButton: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 4,
  },
  editBtn: {
    padding: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: COLORS.success,
  },
  cancelBtn: {
    backgroundColor: COLORS.danger,
  },
  controlPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  repairContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  repairBadge: {
    backgroundColor: COLORS.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  repairBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.danger,
  },
  qtyButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnBg: {
    backgroundColor: COLORS.dangerLight,
  },
  memoContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  memoInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.primary,
    minHeight: 38,
    textAlignVertical: 'top',
  },
  memoSaveBtn: {
    backgroundColor: COLORS.success,
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logWrapper: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  logList: {
    gap: 6,
  },
  logItemRow: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#94A3B8',
  },
  logItemText: {
    fontSize: 12,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logPager: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 12,
  },
  pagerBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagerBtnDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.5,
  },
  pagerText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
