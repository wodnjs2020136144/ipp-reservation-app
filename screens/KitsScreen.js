import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { initialKits } from '../services/dummyData';

const KitsScreen = () => {
  const [kits, setKits] = useState(initialKits);

  const changeQuantity = (id, diff) => {
    setKits((prev) =>
      prev.map((kit) =>
        kit.id === id
          ? { ...kit, quantity: Math.max(0, kit.quantity + diff) }
          : kit
      )
    );
  };

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
      <FlatList
        data={kits}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
      />
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