import React from 'react';
import { Stack } from 'expo-router';

export default function GoalsLayout() {
  return (
    <Stack 
        screenOptions={{
            headerStyle: { backgroundColor: '#f4511e' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
        }}
    >
        <Stack.Screen 
            name="index" // Corresponds to goals/index.js (our GoalsScreen)
            options={{ title: 'My Goals' }} 
        />
        <Stack.Screen 
            name="add" // Corresponds to goals/add.js (our AddGoalScreen)
            options={{ 
                title: 'Add New Goal', 
                presentation: 'modal' // Optional: Show as a modal popup
            }} 
        />
         <Stack.Screen 
            name="detail" // Corresponds to goals/detail.js (our GoalDetailScreen)
            options={{ title: 'Goal Details' }} // Title could be set dynamically later
        />
    </Stack>
  );
} 