import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ScheduleScreen from './screens/ScheduleScreen';

import HomeScreen from './screens/HomeScreen';
import KitsScreen from './screens/KitsScreen';

import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="예약 확인" component={HomeScreen} />
        <Tab.Screen name="교구 관리" component={KitsScreen} />
        <Tab.Screen
          name="Schedule"
          component={ScheduleScreen}
          options={{ tabBarLabel: '스케줄', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}