import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const KitsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>교구 수량 관리 화면</Text>
      {/* 추후 리스트 및 수량 조정 버튼 추가 */}
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
  },
});