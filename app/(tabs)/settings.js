import React from 'react';
import {
    View, 
    Text, 
    StyleSheet, 
    Button, 
    Alert, 
    SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = () => {
  const handleClearGoalsData = () => {
      Alert.alert(
          "Confirm Deletion",
          "Are you sure you want to delete all goals? This cannot be undone.",
          [
              { text: "Cancel", style: "cancel" },
              {
                  text: "Yes, Delete Goals",
                  onPress: async () => {
                      try {
                          await AsyncStorage.removeItem('@goals');
                          Alert.alert("Success", "All goal data has been cleared.");
                      } catch (e) {
                          console.error("Failed to clear goals data.", e);
                          Alert.alert("Error", "Could not clear goal data.");
                      }
                  },
                  style: "destructive"
              }
          ]
      );
  };

  const handleClearAllData = () => {
      Alert.alert(
          "Confirm Deletion",
          "Are you sure you want to delete ALL app data (goals and streaks)? This cannot be undone.",
          [
              { text: "Cancel", style: "cancel" },
              {
                  text: "Yes, Delete All",
                  onPress: async () => {
                      try {
                          await AsyncStorage.removeItem('@goals');
                          await AsyncStorage.removeItem('@streakData');
                          Alert.alert("Success", "All app data has been cleared.");
                      } catch (e) {
                          console.error("Failed to clear data.", e);
                          Alert.alert("Error", "Could not clear app data.");
                      }
                  },
                  style: "destructive"
              }
          ]
      );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
       <Text style={styles.sectionTitle}>Data Management</Text>
        <View style={styles.buttonWrapper}>
            <Button 
                title="Clear Only Goal Data" 
                color="#ffc107"
                onPress={handleClearGoalsData} 
            />
             <Text style={styles.infoText}>
                Deletes all goals and their tasks, but keeps streak history.
            </Text>
        </View>

      <View style={styles.buttonWrapper}>
          <Button 
              title="Clear All App Data" 
              color="#dc3545"
              onPress={handleClearAllData} 
          />
          <Text style={styles.infoText}>
              Warning: Deletes all goals AND streak history.
          </Text>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28, 
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#333',
  },
  sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: '#555',
      marginTop: 20,
      marginBottom: 15,
      alignSelf: 'flex-start',
  },
  buttonWrapper: {
      width: '100%',
      alignItems: 'stretch',
      marginBottom: 20,
      padding: 15,
      backgroundColor: '#fff',
      borderRadius: 8,
       shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
  },
  infoText: {
      fontSize: 13,
      color: '#666',
      marginTop: 8,
      textAlign: 'center',
  },
});

export default SettingsScreen; 