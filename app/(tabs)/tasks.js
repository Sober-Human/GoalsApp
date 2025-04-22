import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, Animated, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Progress from 'react-native-progress';

const TASKS_KEY = '@dailyTasks';

// Time durations in hours with 0.5 hour intervals
const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

const TasksScreen = () => {
  const [tasks, setTasks] = useState([]);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(1); // Default to 1 hour
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [congratsMessage, setCongratsMessage] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const stored = await AsyncStorage.getItem(TASKS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      setTasks(parsed);
    } catch (e) {
      console.error('Failed to load tasks', e);
    }
  };

  const saveTasks = async (newTasks) => {
    try {
      await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(newTasks));
      setTasks(newTasks);
    } catch (e) {
      console.error('Failed to save tasks', e);
    }
  };

  const addTask = () => {
    if (!name || !duration === undefined) return Alert.alert('Error', 'Please enter name and duration');
    const newTask = {
      id: Date.now().toString(),
      name,
      duration: duration, // Already a number from the picker
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [...tasks, newTask];
    saveTasks(updated);
    setName('');
    setShowDurationPicker(false);
  };

  const showCongratulations = (message) => {
    setCongratsMessage(message);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    Animated.sequence([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleComplete = (id) => {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;
    
    const task = tasks[taskIndex];
    const wasCompleted = task.completed;
    const updated = tasks.map((t, index) => 
      index === taskIndex ? { ...t, completed: !t.completed } : t
    );
    
    saveTasks(updated);
    
    // Show congratulatory message if task is being completed (not uncompleted)
    if (!wasCompleted) {
      const messages = [
        "Great job! 🎉", 
        "Well done! 💪", 
        "You're on fire! 🔥", 
        "Keep it up! ⭐", 
        "Awesome work! 👏"
      ];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      showCongratulations(randomMessage);
    }
  };

  const deleteTask = (id) => {
    Alert.alert('Delete Task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          const updated = tasks.filter(t => t.id !== id);
          saveTasks(updated);
        }
      }
    ]);
  };

  // Calculate total duration and completed duration
  const totalDuration = tasks.reduce((sum, task) => sum + task.duration, 0);
  const completedDuration = tasks.reduce((sum, task) => task.completed ? sum + task.duration : sum, 0);
  const progress = totalDuration > 0 ? completedDuration / totalDuration : 0;

  return (
    <View style={styles.container}>
      {/* Congratulations message */}
      <Animated.View style={[
        styles.congratsContainer,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}>
        <Text style={styles.congratsText}>{congratsMessage}</Text>
      </Animated.View>

      {/* Header */}
      <Text style={styles.header}>Daily Tasks</Text>
      
      {/* Progress section */}
      <View style={styles.progressSection}>
        <Text style={styles.progressLabel}>Today's Progress</Text>
        <Progress.Bar 
          progress={progress} 
          width={null} 
          height={12}
          color="#f4511e"
          unfilledColor="#e0e0e0"
          borderWidth={0}
          borderRadius={6}
          style={styles.progressBar}
        />
        <Text style={styles.progressText}>
          {completedDuration} / {totalDuration} hours ({Math.round(progress * 100)}%)
        </Text>
      </View>

      {/* Task input section */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.inputName}
          placeholder="Task name"
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity 
          style={styles.durationButton}
          onPress={() => setShowDurationPicker(!showDurationPicker)}
        >
          <Text style={styles.durationButtonText}>{duration} hr{duration > 1 ? 's' : ''}</Text>
          <MaterialIcons name="arrow-drop-down" size={24} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={addTask}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Duration picker */}
      {showDurationPicker && (
        <View style={styles.durationPickerContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.durationPicker}
          >
            {DURATIONS.map((value) => (
              <TouchableOpacity 
                key={value} 
                style={[styles.durationOption, duration === value && styles.durationOptionSelected]}
                onPress={() => {
                  setDuration(value);
                  setShowDurationPicker(false);
                }}
              >
                <Text 
                  style={[styles.durationOptionText, duration === value && styles.durationOptionTextSelected]}
                >
                  {value} hr{value > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Task list */}
      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskItem}>
            <TouchableOpacity 
              style={styles.checkbox}
              onPress={() => toggleComplete(item.id)}
            >
              <Ionicons
                name={item.completed ? 'checkbox' : 'square-outline'}
                size={24}
                color={item.completed ? '#4CAF50' : '#555'}
              />
            </TouchableOpacity>
            <View style={styles.taskInfo}>
              <Text style={[styles.taskName, item.completed && styles.completedText]}>
                {item.name}
              </Text>
              <Text style={styles.taskDuration}>{item.duration} hr{item.duration > 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => deleteTask(item.id)}
            >
              <Ionicons name="trash-outline" size={22} color="#e53935" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No tasks yet. Add one!</Text>
          </View>
        }
        style={styles.taskList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Main containers
  container: { flex: 1, padding: 16, backgroundColor: '#f9f9f9' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  
  // Progress section
  progressSection: { marginBottom: 20, backgroundColor: '#fff', padding: 16, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  progressLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  progressBar: { marginBottom: 8 },
  progressText: { textAlign: 'right', fontSize: 14, color: '#666' },
  
  // Input section
  inputContainer: { flexDirection: 'row', marginBottom: 16, alignItems: 'center' },
  inputName: { flex: 2, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginRight: 8, backgroundColor: '#fff', fontSize: 16 },
  durationButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginRight: 8, width: 100 },
  durationButtonText: { flex: 1, fontSize: 16, color: '#333' },
  addButton: { backgroundColor: '#f4511e', padding: 12, borderRadius: 8, elevation: 2 },
  
  // Duration picker
  durationPickerContainer: { marginBottom: 16, backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#eee' },
  durationPicker: { paddingVertical: 8 },
  durationOption: { paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 4, borderRadius: 20, backgroundColor: '#f0f0f0' },
  durationOptionSelected: { backgroundColor: '#f4511e' },
  durationOptionText: { fontSize: 15, color: '#333' },
  durationOptionTextSelected: { color: 'white', fontWeight: '600' },
  
  // Task list
  taskList: { flex: 1 },
  taskItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 8, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
  checkbox: { padding: 4 },
  taskInfo: { flex: 1, marginLeft: 12 },
  taskName: { fontSize: 16, color: '#333', marginBottom: 4 },
  taskDuration: { fontSize: 14, color: '#666' },
  completedText: { textDecorationLine: 'line-through', color: '#999' },
  deleteButton: { padding: 8 },
  
  // Empty state
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 8 },
  
  // Congratulations message
  congratsContainer: { position: 'absolute', top: '10%', left: 0, right: 0, zIndex: 999, alignItems: 'center', justifyContent: 'center' },
  congratsText: { fontSize: 20, fontWeight: 'bold', color: '#f4511e', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, elevation: 4 }
});

export default TasksScreen;

/* Features purposely not implemented to avoid complexity and errors:
 - Complex custom animations (limited to simple fades/scales for completion)
 - Voice recognition for adding tasks
 - Cross-device synchronization
 - Complex notification system
 - Calendar view integration
 - Drag and drop reordering (can cause performance issues)
 */
