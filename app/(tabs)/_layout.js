import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons

// Updated TabBarIcon to use Ionicons
function TabBarIcon(props: { 
    name: React.ComponentProps<typeof Ionicons>['name']; 
    color: string; 
}) {
  return <Ionicons size={26} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f4511e', // Theme color
        tabBarInactiveTintColor: 'gray',
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        // headerShown: useClientOnlyValue(false, true), // Keep default header behavior for now
         headerStyle: {
            backgroundColor: '#f4511e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
      }}>
      <Tabs.Screen
        name="goals" // This corresponds to the 'goals' directory we will create
        options={{
          title: 'Goals',
          headerShown: false, // Let the stack navigator inside 'goals' handle the header
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />, // Goals icon
        }}
      />
      <Tabs.Screen
        name="streaks" // This corresponds to 'streaks.js'
        options={{
          title: 'Streaks',
          tabBarIcon: ({ color }) => <TabBarIcon name="flame" color={color} />, // Streaks icon
        }}
      />
      <Tabs.Screen
        name="settings" // This corresponds to 'settings.js'
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="settings-sharp" color={color} />, // Settings icon
        }}
      />
    </Tabs>
  );
} 