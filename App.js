import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ScheduleScreen from './screens/ScheduleScreen';

import HomeScreen from './screens/HomeScreen';
import KitsScreen from './screens/KitsScreen';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <SafeAreaView style={{ flex: 1 }}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#8e8e93',
            tabBarStyle: {
              backgroundColor: '#fff',
              borderTopWidth: 0,
              elevation: 4,
              height: 60,
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
      </SafeAreaView>
    </NavigationContainer>
  );
}