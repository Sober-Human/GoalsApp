import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Button,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Keyboard 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Progress from 'react-native-progress'; 
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// Use hooks from expo-router
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router'; 

// (Keep the getWeeksBetweenDates helper function as defined previously)
const getWeeksBetweenDates = (startDateStr, endDateStr) => {
    const weeks = {};
    let currentWeekStart = new Date(startDateStr + 'T00:00:00Z');
    const endDate = new Date(endDateStr + 'T00:00:00Z');
    let weekIndex = 0;

    while (currentWeekStart <= endDate) {
        const weekEndDate = new Date(currentWeekStart);
        weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
        const actualEndDate = weekEndDate > endDate ? endDate : weekEndDate;
        const weekKey = `week_${weekIndex}`;
        weeks[weekKey] = {
            startDate: currentWeekStart.toISOString().split('T')[0],
            endDate: actualEndDate.toISOString().split('T')[0],
            tasks: [] 
        };
        weekIndex++;
        currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + 7);
    }
    return weeks;
};

// Removed navigation/route props
const GoalDetailScreen = () => { 
  // Get goalId from local search params (Expo Router)
  const { goalId } = useLocalSearchParams(); 
  const router = useRouter();
  const [goal, setGoal] = useState(null);
  const [newTaskTexts, setNewTaskTexts] = useState({}); 
  const [loading, setLoading] = useState(true);

  // Add router to dependency array if using it in effect (like for setOptions)
  useFocusEffect(
    useCallback(() => {
       let isActive = true; // Flag to prevent state updates if component unmounted

       async function fetchGoalDetails() {
           if (!goalId) {
               Alert.alert("Error", "Goal ID is missing.");
               if(router.canGoBack()) router.back();
               return;
           }
           setLoading(true);
           try {
             const storedGoals = await AsyncStorage.getItem('@goals');
             if (storedGoals !== null) {
               let goals = JSON.parse(storedGoals);
               const goalIndex = goals.findIndex(g => g.id === goalId);
               if (goalIndex !== -1) {
                   let currentGoal = goals[goalIndex];
                   let needsSave = false;
                   if (!currentGoal.weeks || typeof currentGoal.weeks !== 'object' || Object.keys(currentGoal.weeks).length === 0) {
                       console.log("Calculating/resetting weeks for goal:", currentGoal.name);
                       currentGoal.weeks = getWeeksBetweenDates(currentGoal.startDate, currentGoal.endDate);
                        goals[goalIndex] = currentGoal;
                        needsSave = true; // Mark that we need to save the updated goals array
                   } else {
                       // Ensure task arrays exist (can be done without needing save)
                       Object.keys(currentGoal.weeks).forEach(weekKey => {
                           if (!currentGoal.weeks[weekKey].tasks) {
                               currentGoal.weeks[weekKey].tasks = [];
                           }
                       });
                   }

                   if (needsSave) {
                        await AsyncStorage.setItem('@goals', JSON.stringify(goals));
                   }
                   
                   if (isActive) setGoal(currentGoal);

               } else { 
                   Alert.alert("Error", "Goal not found."); 
                   if(router.canGoBack()) router.back();
                }
             } else { 
                 Alert.alert("Error", "No goals found."); 
                 if(router.canGoBack()) router.back();
              }
           } catch (e) { 
               console.error(e); 
               Alert.alert("Error", "Failed load."); 
               if(router.canGoBack()) router.back();
           } finally { 
              if (isActive) setLoading(false); 
           }
       }

       fetchGoalDetails();

       return () => {
           isActive = false; // Cleanup function to set flag on unmount
       };
    }, [goalId, router]) // Dependencies remain the same
  );

  const saveGoalUpdates = useCallback(async (updatedGoal) => {
      try {
          const storedGoals = await AsyncStorage.getItem('@goals');
          let goals = storedGoals ? JSON.parse(storedGoals) : [];
          const goalIndex = goals.findIndex(g => g.id === updatedGoal.id);
          if (goalIndex !== -1) {
              goals[goalIndex] = updatedGoal;
              await AsyncStorage.setItem('@goals', JSON.stringify(goals));
          } else { Alert.alert("Error", "Save failed: Goal not found."); }
      } catch (e) { console.error(e); Alert.alert("Error", "Failed to save updates."); }
  }, []);

  // --- Task Management Functions ---
  const handleAddTask = (weekKey) => {
    const textToAdd = newTaskTexts[weekKey]?.trim();
    if (!textToAdd) {
      Alert.alert("Input Needed", "Please enter a task description.");
      return;
    }
    const updatedGoal = { ...goal };
    const newTask = { id: Date.now().toString(), text: textToAdd, completed: false };
    if (!updatedGoal.weeks[weekKey].tasks) { updatedGoal.weeks[weekKey].tasks = []; }
    updatedGoal.weeks[weekKey].tasks.push(newTask);
    setGoal(updatedGoal); 
    saveGoalUpdates(updatedGoal);
    setNewTaskTexts(prev => ({ ...prev, [weekKey]: '' }));
    Keyboard.dismiss();
  };

  const handleDeleteTask = useCallback((weekKey, taskId) => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        const updatedGoal = { ...goal };
        updatedGoal.weeks[weekKey].tasks = updatedGoal.weeks[weekKey].tasks.filter(task => task.id !== taskId);
        setGoal(updatedGoal);
        saveGoalUpdates(updatedGoal);
      }}
    ]);
  }, [goal, saveGoalUpdates]);

  const handleToggleTask = (weekKey, taskId) => {
    const updatedGoal = { ...goal };
    const weekTasks = updatedGoal.weeks[weekKey].tasks;
    const taskIndex = weekTasks.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
      weekTasks[taskIndex].completed = !weekTasks[taskIndex].completed;
      setGoal(updatedGoal); 
      saveGoalUpdates(updatedGoal);
    } else { console.warn(`Task ${taskId} not found in week ${weekKey}`); }
  };


  // --- Calculation Functions (Keep existing logic) ---
   // Calculate progress as the percentage of weeks where all tasks are completed (or 0 if no tasks)
   const calculateProgress = useCallback(() => {
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
        return completedWeeks / weekValues.length;
   }, [goal]);

   const isWeekComplete = useCallback((weekKey) => {
       if (!goal || !goal.weeks || !goal.weeks[weekKey] || !goal.weeks[weekKey].tasks) return false;
       const tasks = goal.weeks[weekKey].tasks;
       return tasks.length > 0 && tasks.every(task => task.completed);
   }, [goal]);

  if (loading || !goal) {
    return (
      <View style={styles.loadingContainer}>
         {/* Optionally set a dynamic title in the stack header */} 
        <Stack.Screen options={{ title: 'Loading...' }} /> 
        <Text>Loading Goal...</Text>
      </View>
    );
  }

  const formatDate = (dateStr) => {
      return new Date(dateStr + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return (
    <SafeAreaView style={styles.container}>
       {/* Set the Stack Screen title dynamically once goal is loaded */}
       <Stack.Screen options={{ title: goal.name }} />
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* HEADER CARD: Goal Name, Dates, Progress */}
        <View style={styles.headerCard}>
          <Text style={styles.headerGoalName}>{goal.name}</Text>
          <Text style={styles.headerGoalDates}>{`${formatDate(goal.startDate)} - ${formatDate(goal.endDate)}`}</Text>
          <View style={styles.headerProgressBarRow}>
            <Progress.Bar
              progress={calculateProgress()}
              width={null}
              color="#27ae60"
              unfilledColor="#e0e0e0"
              borderWidth={0}
              height={16}
              borderRadius={8}
              style={{ flex: 1 }}
              animated={true}
            />
            <View style={styles.headerProgressPercentContainer}>
              <Text style={styles.headerProgressPercentText}>{`${Math.round(calculateProgress() * 100)}%`}</Text>
              <MaterialCommunityIcons name="trophy" size={22} color="#FFD700" style={styles.headerTrophyIcon} />
            </View>
          </View>
        </View>

        {/* Weekly Sections */}
        {Object.entries(goal.weeks || {})
          .sort(([keyA], [keyB]) => parseInt(keyA.split('_')[1]) - parseInt(keyB.split('_')[1]))
          .map(([weekKey, weekData], idx) => {
            const weekProgress = (weekData.tasks && weekData.tasks.length > 0)
              ? weekData.tasks.filter(task => task.completed).length / weekData.tasks.length
              : 0;
            return (
              <View key={weekKey} style={styles.weekCard}>
                <View style={styles.weekCardHeader}>
                  <Text style={styles.weekCardTitle}>
                    Week {parseInt(weekKey.split('_')[1]) + 1}: {formatDate(weekData.startDate)} - {formatDate(weekData.endDate)}
                  </Text>
                  {isWeekComplete(weekKey) && <Text style={styles.weekCardTick}>✓</Text>}
                </View>
                <Progress.Bar
                  progress={weekProgress}
                  width={null}
                  color={weekProgress === 1 ? '#27ae60' : '#ffa726'}
                  unfilledColor="#e0e0e0"
                  borderWidth={0}
                  height={8}
                  borderRadius={4}
                  style={{ marginTop: 4, marginBottom: 10 }}
                  animated={true}
                />
                {/* Task List */}
                {(weekData.tasks || []).map((task) => (
                  <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={[styles.taskItem, task.completed && styles.taskItemCompleted, { flex: 1 }]}
                      onPress={() => handleToggleTask(weekKey, task.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, task.completed && styles.checkboxCompleted]}>
                        {task.completed && <View style={styles.checkboxInner} />}
                      </View>
                      <Text style={[styles.taskText, task.completed && styles.taskTextCompleted]}>
                        {task.text}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTask(weekKey, task.id)} style={{ marginLeft: 8, padding: 8 }}>
                      <MaterialCommunityIcons name="delete-outline" size={22} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                ))}
                {(weekData.tasks || []).length === 0 && (
                  <Text style={styles.noTasksText}>No tasks added for this week yet.</Text>
                )}
                {/* Add Task Input */}
                <View style={styles.addTaskContainer}>
                  <TextInput
                    style={styles.taskInput}
                    placeholder="Add a new task..."
                    value={newTaskTexts[weekKey] || ''}
                    onChangeText={(text) => setNewTaskTexts(prev => ({ ...prev, [weekKey]: text }))}
                    onSubmitEditing={() => handleAddTask(weekKey)}
                    placeholderTextColor="#aaa"
                  />
                  <TouchableOpacity onPress={() => handleAddTask(weekKey)} style={styles.addButton}>
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles remain the same, except removed goalTitle style
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f8fa',
  },
  // HEADER CARD
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    margin: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  headerGoalName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerGoalDates: {
    fontSize: 15,
    color: '#888',
    marginBottom: 18,
    textAlign: 'center',
  },
  headerProgressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  headerProgressPercentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    minWidth: 56,
    justifyContent: 'flex-end',
  },
  headerProgressPercentText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    marginRight: 4,
  },
  headerTrophyIcon: {
    fontSize: 20,
    marginLeft: 0,
  },
  // WEEK CARD
  weekCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  weekCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekCardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1,
  },
  weekCardTick: {
    fontSize: 22,
    color: '#27ae60',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  // TASKS
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'transparent',
  },
  taskItemCompleted: {
    backgroundColor: 'rgba(39, 174, 96, 0.05)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#aaa',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxCompleted: {
    borderColor: '#27ae60',
    backgroundColor: '#eafaf1',
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
  },
  checkboxInner: {
      width: 12,
      height: 12,
      backgroundColor: '#4CAF50',
      borderRadius: 2,
  },
  taskText: {
      fontSize: 16,
      color: '#444',
      flex: 1, 
  },
  taskTextCompleted: {
      textDecorationLine: 'line-through',
      color: '#aaa',
  },
  noTasksText: {
      color: '#888',
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 15,
  },
  addTaskContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 15,
      borderTopWidth: 1,
      borderTopColor: '#eee',
      paddingTop: 15,
  },
  taskInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#ccc',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 5,
      marginRight: 10,
      backgroundColor: '#fff',
      fontSize: 15,
  },
  addButton: {
      backgroundColor: '#f4511e',
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 5,
      justifyContent: 'center',
      alignItems: 'center',
  },
  addButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
  }
});

export default GoalDetailScreen; 