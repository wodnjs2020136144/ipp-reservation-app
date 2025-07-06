// KitsScreen.js

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initialKits } from '../services/dummyData';

const STORAGE_KEY = '@kit_quantities';
const LOG_KEY = '@kit_logs';

const KitsScreen = () => {
  const [kits, setKits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    loadLogs();
  }, []);

  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      setKits(stored ? JSON.parse(stored) : initialKits);
    } catch (e) {
      console.error('수량 불러오기 실패', e);
      setKits(initialKits);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const storedLogs = await AsyncStorage.getItem(LOG_KEY);
      if (storedLogs) setLogs(JSON.parse(storedLogs));
    } catch (e) {
      console.error('로그 불러오기 실패', e);
    }
  };

  const saveData = async (updated) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('수량 저장 실패', e);
    }
  };

  const saveLogs = async (updatedLogs) => {
    try {
      await AsyncStorage.setItem(LOG_KEY, JSON.stringify(updatedLogs));
    } catch (e) {
      console.error('로그 저장 실패', e);
    }
  };

  const changeQuantity = (id, diff) => {
    const kit = kits.find((k) => k.id === id);
    if (!kit) return;

    const updated = kits.map((k) =>
      k.id === id
        ? { ...k, quantity: Math.max(0, k.quantity + diff) }
        : k
    );

    setKits(updated);
    saveData(updated);

    const now = new Date();
    const timestamp = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const date = now.toLocaleDateString('ko-KR');
    const sign = diff > 0 ? '+' : '-';
    const logText = `[${date} ${timestamp}] ${kit.name} ${sign}${Math.abs(diff)}`;

    const newLogs = [logText, ...logs.slice(0, 9)];
    setLogs(newLogs);
    saveLogs(newLogs);
  };

  const resetAll = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(LOG_KEY);
    setKits(initialKits);
    setLogs([]);
  };

  const renderKit = ({ item }) => (
    <View style={styles.kitCard}>
      <View style={styles.kitHeader}>
        <Text style={styles.kitName}>{item.name}</Text>
        <Text style={styles.kitQuantity}>{item.quantity}개</Text>
      </View>
      <View style={styles.kitButtons}>
        <TouchableOpacity onPress={() => changeQuantity(item.id, -1)} style={styles.button}>
          <Text style={styles.btnText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeQuantity(item.id, 1)} style={styles.button}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>교구 수량 관리</Text>
        <TouchableOpacity onPress={resetAll} style={styles.resetButton}>
          <Text style={styles.resetText}>초기화</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        <FlatList
          ListHeaderComponent={() => <Text style={styles.subTitle}>보유 교구</Text>}
          data={kits}
          renderItem={renderKit}
          keyExtractor={(item) => item.id}
          ListFooterComponent={
            <View style={styles.logContainer}>
              <Text style={styles.logTitle}>변경 로그</Text>
              {logs.length === 0 ? (
                <Text style={styles.logEmpty}>로그 없음</Text>
              ) : (
                logs.map((log, idx) => (
                  <Text key={idx} style={styles.logItem}>
                    {log}
                  </Text>
                ))
              )}
            </View>
          }
        />
      )}
    </View>
  );
};

export default KitsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefefe',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ff3b30',
    borderRadius: 6,
  },
  resetText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    color: '#333',
  },
  kitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  kitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kitName: {
    fontSize: 16,
    fontWeight: '600',
  },
  kitQuantity: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
  },
  kitButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logContainer: {
    marginTop: 30,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logItem: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
  },
  logEmpty: {
    fontSize: 14,
    color: '#aaa',
  },
});