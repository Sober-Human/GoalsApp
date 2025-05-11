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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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
    const weekValues = Object.values(goal.weeks);
    if (weekValues.length === 0) return 0;
    
    let completedWeeks = 0;
    weekValues.forEach(week => {
        if (week.tasks && Array.isArray(week.tasks) && week.tasks.length > 0) {
            const allCompleted = week.tasks.every(task => task.completed);
            if (allCompleted) completedWeeks += 1;
        }
    });
    return weekValues.length === 0 ? 0 : completedWeeks / weekValues.length;
  };

  const renderGoalItem = ({ item }) => (
    <TouchableOpacity
      style={styles.goalItem}
      onPress={() => router.push({ pathname: '/goals/detail', params: { goalId: item.id } })}
      onLongPress={() => handleDeleteGoal(item.id)}
    >
      <Text style={styles.goalName}>{item.name}</Text>
      <Text style={styles.goalDates}>{`${item.startDate} - ${item.endDate}`}</Text>
      
      {/* Progress Bar Section */}
      <View style={styles.progressBarSection}>
        <Progress.Bar
          progress={item.progress || 0}
          width={null}
          color="#27ae60" // Vibrant green
          unfilledColor="#e0e0e0"
          borderWidth={0}
          height={14}
          borderRadius={8}
          style={{ flex: 1 }}
          animated={true}
        />
        <View style={styles.progressPercentContainer}>
          <Text style={styles.progressPercentText}>{`${Math.round((item.progress || 0) * 100)}%`}</Text>
          <MaterialCommunityIcons name="trophy" size={20} color="#FFD700" style={styles.trophyIcon} />
        </View>
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
  progressBarSection: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressPercentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    minWidth: 60,
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 4,
  },
  trophyIcon: {
    marginLeft: 2,
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