import React from 'react';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Portfolio',
          headerTitle: 'Portfolio',
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          headerTitle: 'Watchlist',
        }}
      />
    </Tabs>
  );
}
