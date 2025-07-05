import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from './screens/HomeScreen';
import KitsScreen from './screens/KitsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="예약 확인" component={HomeScreen} />
        <Tab.Screen name="교구 관리" component={KitsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}