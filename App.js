import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ScheduleScreen from './screens/ScheduleScreen';

import HomeScreen from './screens/HomeScreen';
import KitsScreen from './screens/KitsScreen';

import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';
import { ensureAuth } from './firebase';
import { Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

function MyTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8e8e93',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 4,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 12, paddingBottom: 4 },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === '예약 확인') {
            iconName = focused ? 'home' : 'home-outline';
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
      <Tab.Screen name="교구 관리" component={KitsScreen} />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ tabBarLabel: '스케줄' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await ensureAuth();          // Firebase 익명 로그인 완료 대기
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    // 간단한 로딩 화면 (Splash 역할)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MyTabs />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}