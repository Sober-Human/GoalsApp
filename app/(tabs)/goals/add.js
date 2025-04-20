import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView // Added ScrollView for smaller screens
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router'; // Use Expo Router hook

// Removed navigation prop
const AddGoalScreen = () => {
  const [goalName, setGoalName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const router = useRouter(); // Get router object

  const onStartDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || startDate;
    setShowStartDatePicker(Platform.OS === 'ios');
    setStartDate(currentDate);
    if (currentDate > endDate) {
        setEndDate(currentDate);
    }
  };

  const onEndDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || endDate;
    setShowEndDatePicker(Platform.OS === 'ios');
    setEndDate(currentDate);
  };

  const saveGoal = async () => {
    if (!goalName.trim()) {
        Alert.alert('Error', 'Please enter a goal name.');
        return;
    }
    if (endDate < startDate) {
        Alert.alert('Error', 'End date cannot be earlier than start date.');
        return;
    }

    const newGoal = {
      id: Date.now().toString(),
      name: goalName.trim(),
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      weeks: {}, // Initialize weeks, will be populated in detail screen
    };

    try {
      const storedGoals = await AsyncStorage.getItem('@goals');
      const goals = storedGoals ? JSON.parse(storedGoals) : [];
      goals.push(newGoal);
      await AsyncStorage.setItem('@goals', JSON.stringify(goals));
      // Use router to navigate back
      if (router.canGoBack()) {
        router.back();
      } else {
        // Fallback if cannot go back (e.g., opened directly)
        router.replace('/goals'); // Navigate to goals list
      }
    } catch (e) {
      console.error("Failed to save the goal.", e);
      Alert.alert('Error', 'Failed to save the goal.');
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  return (
    // Use ScrollView to prevent layout issues on smaller screens with date pickers
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Goal Name:</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your goal"
        value={goalName}
        onChangeText={setGoalName}
      />

      {/* --- Start Date --- */}
      <Text style={styles.label}>Start Date:</Text>
      {/* Conditionally render button OR picker for Android */} 
      {Platform.OS !== 'ios' && (
          <Button onPress={() => setShowStartDatePicker(true)} title={formatDate(startDate)} color="#555" />
      )}
       {/* Always show picker directly on iOS when triggered */}
      {(showStartDatePicker || Platform.OS === 'ios') && (
        <DateTimePicker
          testID="startDatePicker"
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'} // Use spinner on iOS for modal feel
          onChange={onStartDateChange}
          minimumDate={new Date()} // Can't start in the past
          style={styles.datePicker} // Added style
        />
      )}
      {/* iOS requires a dismissal button if using inline picker like spinner */}
      {Platform.OS === 'ios' && showStartDatePicker && (
          <Button title="Done" onPress={() => setShowStartDatePicker(false)} />
      )}
       
      {/* --- End Date --- */}
       <Text style={styles.label}>End Date:</Text>
       {Platform.OS !== 'ios' && (
          <Button onPress={() => setShowEndDatePicker(true)} title={formatDate(endDate)} color="#555" />
       )}
      {(showEndDatePicker || Platform.OS === 'ios') && (
        <DateTimePicker
          testID="endDatePicker"
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onEndDateChange}
          minimumDate={startDate} // Can't end before start
           style={styles.datePicker}
        />
      )}
       {Platform.OS === 'ios' && showEndDatePicker && (
          <Button title="Done" onPress={() => setShowEndDatePicker(false)} />
      )}

      <View style={styles.buttonContainer}>
         <Button title="Save Goal" onPress={saveGoal} color="#4CAF50" />
      </View>
       <View style={{ height: 50 }} />{/* Add padding at the bottom of scroll */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, // Needed for ScrollView content
    padding: 20,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
    marginBottom: 10,
  },
  // Removed dateInput style, using Button/direct picker instead
  datePicker: {
      // On iOS, the spinner might need height or specific styling
      // On Android, default display doesn't usually need explicit style
      marginBottom: Platform.OS === 'ios' ? 0 : 10, // Adjust spacing
  },
  buttonContainer: {
      marginTop: 30,
      marginBottom: 20,
  }
});

export default AddGoalScreen; 