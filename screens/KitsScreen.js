import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initialKits } from '../services/dummyData';

const STORAGE_KEY = '@kit_quantities';

const KitsScreen = () => {
  const [kits, setKits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 데이터 불러오기
  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setKits(JSON.parse(stored));
      } else {
        setKits(initialKits);
      }
    } catch (e) {
      console.error('저장된 수량 불러오기 실패', e);
      setKits(initialKits);
    } finally {
      setLoading(false);
    }
  };

  // 저장하기
  const saveData = async (updatedKits) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedKits));
    } catch (e) {
      console.error('수량 저장 실패', e);
    }
  };

  // 수량 변경 + 로그 추가
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

    setLogs((prev) => [logText, ...prev.slice(0, 9)]); // 최대 10개
  };

  useEffect(() => {
    loadData();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.kitItem}>
      <Text style={styles.name}>{item.name}</Text>
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => changeQuantity(item.id, -1)} style={styles.button}>
          <Text style={styles.btnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => changeQuantity(item.id, 1)} style={styles.button}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>교구 수량 관리</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        <FlatList
          data={kits}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      )}

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
    </ScrollView>
  );
};

export default KitsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  kitItem: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantity: {
    fontSize: 18,
    marginHorizontal: 20,
  },
  logContainer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  logEmpty: {
    color: '#999',
    fontSize: 14,
  },
});