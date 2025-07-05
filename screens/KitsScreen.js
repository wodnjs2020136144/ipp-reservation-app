import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initialKits } from '../services/dummyData';

const STORAGE_KEY = '@kit_quantities';

const KitsScreen = () => {
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);

  // AsyncStorage에서 불러오기
  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setKits(JSON.parse(stored));
      } else {
        setKits(initialKits); // 없으면 기본값
      }
    } catch (e) {
      console.error('저장된 수량 불러오기 실패', e);
      setKits(initialKits);
    } finally {
      setLoading(false);
    }
  };

  // AsyncStorage에 저장
  const saveData = async (updatedKits) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedKits));
    } catch (e) {
      console.error('수량 저장 실패', e);
    }
  };

  // 수량 변경
  const changeQuantity = (id, diff) => {
    const updated = kits.map((kit) =>
      kit.id === id
        ? { ...kit, quantity: Math.max(0, kit.quantity + diff) }
        : kit
    );
    setKits(updated);
    saveData(updated);
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
    <View style={styles.container}>
      <Text style={styles.title}>교구 수량 관리</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        <FlatList
          data={kits}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
        />
      )}
    </View>
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
});