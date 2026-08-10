/**
 * components/LoadingView.js — 전체 화면 로딩 스피너 (공용)
 *
 * HomeScreen/KitsScreen/ScheduleScreen이 거의 동일한 로딩 뷰(스피너 + 안내 텍스트)를
 * 각자 화면에 중복 작성하고 있던 것을 하나로 통합.
 */
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function LoadingView({ text, bold = false }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={[styles.text, bold && styles.textBold]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  textBold: {
    fontWeight: '600',
  },
});
