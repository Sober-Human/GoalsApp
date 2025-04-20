import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Use useFocusEffect from expo-router instead of react-navigation/native
import { useFocusEffect, useRouter } from 'expo-router'; 
import * as Progress from 'react-native-progress'; // Import progress bar

// Removed navigation prop, use useRouter hook instead
const GoalsScreen = () => { 
  const [goals, setGoals] = useState([]);
  const router = useRouter(); // Expo Router's navigation hook

  const loadGoals = useCallback(async () => {
    try {
      const storedGoals = await AsyncStorage.getItem('@goals');
      if (storedGoals !== null) {
        const parsedGoals = JSON.parse(storedGoals);
        // Calculate progress for each goal and add it to the object
        const goalsWithProgress = parsedGoals.map(goal => ({
            ...goal,
            progress: calculateGoalProgress(goal) // Calculate and store progress
        }));
        setGoals(goalsWithProgress);
      } else {
        setGoals([]); // Ensure goals is an empty array if nothing is stored
      }
    } catch (e) {
      console.error("Failed to load goals.", e);
      setGoals([]); // Set empty array on error
    }
  }, []);

  // useFocusEffect remains largely the same, but import source changes
  useFocusEffect(
    useCallback(() => {
      // Define the async function inside the callback
      async function fetchGoals() {
          try {
            const storedGoals = await AsyncStorage.getItem('@goals');
            if (storedGoals !== null) {
              const parsedGoals = JSON.parse(storedGoals);
              const goalsWithProgress = parsedGoals.map(goal => ({
                  ...goal,
                  progress: calculateGoalProgress(goal) 
              }));
              setGoals(goalsWithProgress);
            } else {
              setGoals([]);
            }
          } catch (e) {
            console.error("Failed to load goals.", e);
            setGoals([]);
          }
      }
      
      fetchGoals(); // Call the async function

      // Optional cleanup function (if needed)
      // return () => {}; 
    }, []) // Keep dependencies minimal, loadGoals logic is inside
  );

  const handleDeleteGoal = useCallback((goalId) => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this goal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const storedGoals = await AsyncStorage.getItem('@goals');
              const goalsList = storedGoals ? JSON.parse(storedGoals) : [];
              const updatedGoals = goalsList.filter(goal => goal.id !== goalId);
              await AsyncStorage.setItem('@goals', JSON.stringify(updatedGoals));
              setGoals(updatedGoals);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete goal.');
            }
          },
        },
      ]
    );
  }, []);

  // Helper function to calculate progress for a single goal
  const calculateGoalProgress = (goal) => {
    if (!goal || !goal.weeks) return 0;
    let totalTasks = 0;
    let completedTasks = 0;
    Object.values(goal.weeks).forEach(week => {
        if (week.tasks && Array.isArray(week.tasks)) {
            totalTasks += week.tasks.length;
            completedTasks += week.tasks.filter(task => task.completed).length;
        }
    });
    return totalTasks === 0 ? 0 : completedTasks / totalTasks;
  };

  const renderGoalItem = ({ item }) => (
    <TouchableOpacity
      style={styles.goalItem}
      onPress={() => router.push({ pathname: '/goals/detail', params: { goalId: item.id } })}
      onLongPress={() => handleDeleteGoal(item.id)}
    >
      <Text style={styles.goalName}>{item.name}</Text>
      <Text style={styles.goalDates}>{`${item.startDate} - ${item.endDate}`}</Text>
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <Progress.Bar
          progress={item.progress}
          width={null}
          color="#4CAF50"
          unfilledColor="#e0e0e0"
          borderWidth={0}
          height={8}
          borderRadius={4}
        />
        <Text style={styles.progressText}>{`${Math.round(item.progress * 100)}%`}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {goals.length === 0 ? (
        <View style={styles.emptyContainer}>
           <Text style={styles.emptyText}>No goals yet. Add one!</Text>
        </View>
       
      ) : (
        <FlatList
          data={goals}
          renderItem={renderGoalItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
      {/* Use Link for Add Goal button */}
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/goals/add')}>
           <Text style={styles.addButtonText}>Add New Goal</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0', 
    padding: 10,
  },
  emptyContainer: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
  },
  list: {
    paddingBottom: 10, // Space below the list before the button
  },
  goalItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
        width: 0,
        height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: 10,
  },
  goalName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  goalDates: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10, // Add space before progress bar
  },
  progressBarContainer: {
    marginTop: 8, // Space between dates and progress bar
    flexDirection: 'row',
    alignItems: 'center',
  },
   progressText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 8, // Space between bar and text
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#f4511e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10, // Space above the button
  },
  addButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
  }
});

export default GoalsScreen; 