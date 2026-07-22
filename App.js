/**
 * App.js — 앱 진입점(Entry)
 *
 * 역할
 *  - Firebase 익명 인증(ensureAuth) 완료 후 UI 렌더링
 *  - 하단 탭 네비게이션 구성 (예약 확인 / 교구 관리 / 스케줄)
 *  - Safe Area 인셋을 고려한 탭바 높이 보정
 */
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ScheduleScreen from './screens/ScheduleScreen';

import HomeScreen from './screens/HomeScreen';
import KitsScreen from './screens/KitsScreen';
import AiChatScreen from './screens/AiChatScreen';

import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';
import { ensureAuth } from './firebase';
import { Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

/**
 * MyTabs — 하단 탭 컨테이너
 *  - SafeAreaInsets 로 탭바 높이/패딩 자동 보정
 *  - 아이콘 매핑: 예약 확인(home), AI 비서(sparkles), 교구 관리(cube), 스케줄(calendar)
 */
function MyTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // 상단 헤더 비표시(각 탭에서 자체 헤더를 쓰지 않음)
        headerShown: false,
        // 탭 아이템 색상(활성/비활성)
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8e8e93',
        // 탭바 스타일: Safe Area(하단 홈 인디케이터)만큼 높이/패딩 보정
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 4,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 12, paddingBottom: 4 },
        // 아이콘 매핑: 라우트명에 따라 Ionicons 선택
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === '예약 확인') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'AI 비서') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === '교구 관리') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Schedule') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          }
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="예약 확인" component={HomeScreen} />
      <Tab.Screen name="AI 비서" component={AiChatScreen} />
      <Tab.Screen name="교구 관리" component={KitsScreen} />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ tabBarLabel: '스케줄' }}
      />
    </Tab.Navigator>
  );
}

/**
 * App — Firebase 인증 게이트 + 네비게이션 루트
 *  - ensureAuth() 완료 전까지 Splash(로딩 인디케이터) 표시
 *  - 완료 후 NavigationContainer 렌더링
 */
export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Firebase 익명 로그인(Anonymous auth)
        //  - Firestore 보안 규칙에서 request.auth 를 만족시키기 위함
        //  - 실패하더라도 finally 에서 ready 를 true 로 설정하여 UI는 진입 가능
        await ensureAuth();
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    // 인증 대기 중(Splash): 최소 UI만 노출하여 초기 로딩 UX 개선
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // SafeAreaProvider: 노치/홈인디케이터 영역 대응
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MyTabs />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}