import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Dimensions, Alert, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;
const STREAK_DATA_KEY = '@streakData';

// Helper to get date string in YYYY-MM-DD format (UTC)
const getUTCDateString = (date) => {
    if (!date || !(date instanceof Date)) {
        console.warn("Invalid date passed to getUTCDateString:", date);
        return new Date().toISOString().split('T')[0]; // Fallback to today
    }
    try {
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error("Error converting date to ISO string:", date, error);
      return new Date().toISOString().split('T')[0]; // Fallback
    }
};


// --- Heatmap Grid Logic ---
const NUM_WEEKS_TO_SHOW = 8; // Number of weeks to display

// Get the date for the start of the week (Sunday) for a given date
const getStartOfWeek = (date) => {
  const dt = new Date(date);
  const day = dt.getDay(); // 0 = Sunday, 6 = Saturday
  const diff = dt.getDate() - day;
  return new Date(dt.setDate(diff));
};

// Generates the grid structure with dates and check-in data
const generateHeatmapGridData = (checkinData) => {
  const grid = [];
  const today = new Date();
  const startDate = getStartOfWeek(today);
  // Go back NUM_WEEKS_TO_SHOW - 1 weeks from the start of the current week
  startDate.setDate(startDate.getDate() - (NUM_WEEKS_TO_SHOW - 1) * 7);

  const checkinMap = new Map(checkinData.map(item => [item.date, item.count]));

  for (let weekNum = 0; weekNum < NUM_WEEKS_TO_SHOW; weekNum++) {
      let currentWeek = [];
      for (let dayNum = 0; dayNum < 7; dayNum++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + (weekNum * 7) + dayNum);
          const dateStr = getUTCDateString(date);
          const count = checkinMap.get(dateStr) || 0; // 0 for no check-in

          // Only add days up to today
          if (date <= today) {
              currentWeek.push({ date: dateStr, count: count });
          } else {
              // Add placeholder for future dates to maintain grid structure
              currentWeek.push({ date: `future-${weekNum}-${dayNum}`, count: -1 });
          }
      }
      grid.push(currentWeek);
  }
  // The grid structure is [week][dayOfWeek] -> week is row, day is column
  // We need to transpose this for column-based rendering (week = column)
  const transposedGrid = [];
   if (grid.length > 0) {
        for (let j = 0; j < 7; j++) { // Iterate through days of week (Sun-Sat)
            let dayRow = [];
            for (let i = 0; i < grid.length; i++) { // Iterate through weeks
                dayRow.push(grid[i][j]);
            }
            transposedGrid.push(dayRow);
        }
   }
  return transposedGrid; // Now rows are days (S-M-T...), columns are weeks
};


// Renders the actual heatmap grid UI
const renderHeatmapGrid = (checkinData) => {
  const gridData = generateHeatmapGridData(checkinData); // This is [dayOfWeek][week]
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={styles.gridOuterContainer}>
       {/* Day Labels Column */}
       <View style={styles.dayLabelsColumn}>
        {dayLabels.map((label, index) => (
          // Show labels for Mon, Wed, Fri for less clutter
          <Text key={label + index} style={styles.dayLabelText}>{index % 2 !== 0 ? label : ''}</Text>
        ))}
      </View>
      {/* Week Columns */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScrollView}>
        <View style={styles.gridInnerContainer}>
          {/* Render column by column (each column is a week) */}
          {gridData.length > 0 && gridData[0].map((_, weekIndex) => (
             <View key={`week-${weekIndex}`} style={styles.weekColumn}>
                {/* Render cells for each day of the week */}
                 {gridData.map((dayRow, dayIndex) => {
                    const day = dayRow[weekIndex];
                     if (!day || day.count === -1) { // Render empty space for padding/future
                        return <View key={day?.date || `pad-${weekIndex}-${dayIndex}`} style={[styles.dayCell, styles.emptyCell]} />;
                    }
                    const isPartial = day.count === 1;
                    const isFull = day.count === 2;
                    const fillColor = isPartial ? '#ffa726' : isFull ? '#009933' : '#e0e0e0'; // Orange, Dark Green, Light Gray
                    const isToday = day.date === getUTCDateString(new Date());
                    return (
                    <View
                        key={`day-${day.date}`}
                        style={[
                        styles.dayCell,
                        { backgroundColor: fillColor },
                        isToday && styles.todayCell
                        ]}
                    />
                    );
                 })}
             </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};


// Renders the legend
const renderLegend = () => {
  return (
    <View style={styles.legendContainerGrid}>
      <View style={styles.legendItemGrid}>
        <View style={[styles.legendDotGrid, { backgroundColor: '#009933' }]} />
        <Text style={styles.legendTextGrid}>Fully Done</Text>
      </View>
      <View style={styles.legendItemGrid}>
        <View style={[styles.legendDotGrid, { backgroundColor: '#ffa726' }]} />
        <Text style={styles.legendTextGrid}>Partially Done</Text>
      </View>
      <View style={styles.legendItemGrid}>
        <View style={[styles.legendDotGrid, { backgroundColor: '#e0e0e0' }]} />
        <Text style={styles.legendTextGrid}>No Check-in</Text>
      </View>
    </View>
  );
}
// --- End Heatmap Grid Logic ---


const StreaksScreen = () => {
    const [currentStreak, setCurrentStreak] = useState(0);
    const [longestStreak, setLongestStreak] = useState(0);
    const [lastCheckinDate, setLastCheckinDate] = useState(null);
    const [lastCheckinType, setLastCheckinType] = useState(null);
    const [heatmapData, setHeatmapData] = useState([]);
    const [canCheckinToday, setCanCheckinToday] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [undoData, setUndoData] = useState(null); // Store previous state for undo

    // Load data on component mount and when screen focuses
    const loadStreakData = async () => {
        console.log("Loading streak data...");
        setIsLoading(true);
        try {
            const storedData = await AsyncStorage.getItem(STREAK_DATA_KEY);
            if (storedData) {
                const data = JSON.parse(storedData);
                console.log("Loaded data:", data);
                setCurrentStreak(data.currentStreak || 0);
                setLongestStreak(data.longestStreak || 0);
                setLastCheckinDate(data.lastCheckinDate || null);
                setLastCheckinType(data.lastCheckinType || null);
                // Ensure heatmapData is always an array
                const loadedHeatmapData = Array.isArray(data.heatmapData) ? data.heatmapData : [];
                setHeatmapData(loadedHeatmapData);
                console.log("Heatmap Data:", loadedHeatmapData);

                const todayStr = getUTCDateString(new Date());
                setCanCheckinToday(data.lastCheckinDate !== todayStr);
                setUndoData(null); // Clear undo data on fresh load
            } else {
                console.log("No stored data found, initializing.");
                // Initialize if no data exists
                setCurrentStreak(0);
                setLongestStreak(0);
                setLastCheckinDate(null);
                setLastCheckinType(null);
                setHeatmapData([]);
                setCanCheckinToday(true);
                setUndoData(null);
            }
        } catch (error) {
            console.error("Failed to load streak data:", error);
            Alert.alert("Error", "Failed to load your streak data.");
            // Reset to default state on error
            setCurrentStreak(0);
            setLongestStreak(0);
            setLastCheckinDate(null);
            setLastCheckinType(null);
            setHeatmapData([]);
            setCanCheckinToday(true);
             setUndoData(null);
        } finally {
            setIsLoading(false);
            console.log("Loading complete.");
        }
    };

    // Use useFocusEffect to reload data when the screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadStreakData();
            return () => {
                 console.log("Streaks screen unfocused");
                 // Optional: Cleanup logic when screen loses focus
            };
        }, [])
    );

    // Handle check-in logic
    const handleCheckin = async (type) => {
        console.log(`Handling check-in: ${type}`);
        const today = new Date();
        const todayStr = getUTCDateString(today);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = getUTCDateString(yesterday);

        let updatedCurrentStreak = currentStreak;
        let updatedLongestStreak = longestStreak;
        let updatedHeatmapEntries = [...heatmapData]; // Copy existing heatmap data

        // Store current state for potential undo
        const previousState = {
            currentStreak,
            longestStreak,
            lastCheckinDate,
            lastCheckinType,
            heatmapData: [...heatmapData], // Deep copy for undo
            canCheckinToday
        };
        setUndoData(previousState); // Save state before modification

        if (lastCheckinDate === yesterdayStr) {
            // Continue streak
            updatedCurrentStreak += 1;
        } else if (lastCheckinDate !== todayStr) {
            // Start a new streak if not checked in yesterday or today
            updatedCurrentStreak = 1;
        } // If lastCheckinDate IS todayStr, streak doesn't change (already checked in)

        // Update longest streak
        updatedLongestStreak = Math.max(updatedCurrentStreak, updatedLongestStreak);

        // Create new entry with appropriate count
        const newHeatmapEntry = { date: todayStr, count: type === 'full' ? 2 : 1 };
        console.log('CREATING NEW ENTRY:', type, newHeatmapEntry);
        // Remove any existing entry for today before adding the new one
        updatedHeatmapEntries = updatedHeatmapEntries.filter(d => d.date !== todayStr);
        updatedHeatmapEntries.push(newHeatmapEntry);

        const newData = {
            currentStreak: updatedCurrentStreak,
            longestStreak: updatedLongestStreak,
            lastCheckinDate: todayStr,
            lastCheckinType: type,
            heatmapData: updatedHeatmapEntries // Save updated heatmap data
        };

        try {
            await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(newData));
            console.log("Saved new data:", newData);

            // Update state immediately
            setCurrentStreak(updatedCurrentStreak);
            setLongestStreak(updatedLongestStreak);
            setLastCheckinDate(todayStr);
            setLastCheckinType(type);
            setHeatmapData(updatedHeatmapEntries); // Update heatmap data state
            setCanCheckinToday(false); // Disable check-in until undo or next day
            Alert.alert("Checked In!", `Progress recorded: ${type}.`);
        } catch (error) {
            console.error("Failed to save check-in data:", error);
            Alert.alert("Error", "Failed to save your check-in.");
            setUndoData(null); // Clear undo data if save fails
        }
    };

    // Handle Undo Logic
    const handleUndo = async () => {
        if (!undoData) {
            Alert.alert("Nothing to Undo", "No recent check-in found to undo.");
            return;
        }
        console.log("Undoing last check-in. Restoring state:", undoData);

        try {
            // Prepare data to save (the previous state)
            const dataToSave = {
                currentStreak: undoData.currentStreak,
                longestStreak: undoData.longestStreak,
                lastCheckinDate: undoData.lastCheckinDate,
                lastCheckinType: undoData.lastCheckinType,
                heatmapData: undoData.heatmapData // Use the stored previous heatmap data
            };
            await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(dataToSave));
            console.log("Restored previous data via undo:", dataToSave);

            // Restore state from undoData
            setCurrentStreak(undoData.currentStreak);
            setLongestStreak(undoData.longestStreak);
            setLastCheckinDate(undoData.lastCheckinDate);
            setLastCheckinType(undoData.lastCheckinType);
            setHeatmapData(undoData.heatmapData); // Restore heatmap state
            setCanCheckinToday(undoData.canCheckinToday); // Restore check-in possibility

            setUndoData(null); // Clear undo data after successful undo
            Alert.alert("Undo Successful", "Your last check-in has been undone.");
        } catch (error) {
            console.error("Failed to undo check-in:", error);
            Alert.alert("Error", "Failed to undo the last check-in.");
        }
    };

     // Clear all streak data
    const clearAllData = async () => {
        Alert.alert(
            "Confirm Clear",
            "Are you sure you want to clear all streak data? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear Data",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await AsyncStorage.removeItem(STREAK_DATA_KEY);
                            // Reset state to initial values
                            setCurrentStreak(0);
                            setLongestStreak(0);
                            setLastCheckinDate(null);
                            setLastCheckinType(null);
                            setHeatmapData([]);
                            setCanCheckinToday(true);
                            setUndoData(null);
                            console.log("All streak data cleared.");
                            Alert.alert("Data Cleared", "All your streak data has been successfully cleared.");
                        } catch (error) {
                            console.error("Failed to clear streak data:", error);
                            Alert.alert("Error", "Failed to clear streak data.");
                        }
                    },
                },
            ]
        );
    };


    if (isLoading) {
        return <View style={styles.centered}><Text>Loading Streaks...</Text></View>;
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.header}>Streaks</Text>

            <View style={styles.streakInfoContainer}>
                <View style={styles.streakBox}>
                    <Ionicons name="flame" size={24} color="#ff6a00" />
                    <Text style={styles.streakNumber}>{currentStreak}</Text>
                    <Text style={styles.streakLabel}>Current Streak</Text>
                </View>
                <View style={styles.streakBox}>
                     <Ionicons name="trophy" size={24} color="#ffd700" />
                    <Text style={styles.streakNumber}>{longestStreak}</Text>
                    <Text style={styles.streakLabel}>Longest Streak</Text>
                </View>
            </View>

             <View style={styles.heatmapContainer}>
                {/* Multi-Week Vertical Heatmap Grid */}
                <View style={styles.heatmapGridContainer}>
                    <Text style={styles.heatmapTitle}>Activity Heatmap</Text>
                    {renderHeatmapGrid(heatmapData)}
                    {renderLegend()}
                </View>
            </View>

            <View style={styles.checkinSection}>
                <Text style={styles.checkinPrompt}>
                    {canCheckinToday ? "Log today's progress:" : `You checked in today (${lastCheckinType || 'N/A'}). Undo?`}
                </Text>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.partialButton, !canCheckinToday && styles.disabledButton]}
                        onPress={() => handleCheckin('partial')}
                        disabled={!canCheckinToday}
                    >
                        <Ionicons name="trending-up-outline" size={20} color="#fff" style={styles.buttonIcon} />
                        <Text style={styles.buttonText}>Progress Made (Maintain)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.fullButton, !canCheckinToday && styles.disabledButton]}
                        onPress={() => handleCheckin('full')}
                        disabled={!canCheckinToday}
                    >
                         <Ionicons name="checkmark-done-circle-outline" size={20} color="#fff" style={styles.buttonIcon} />
                        <Text style={styles.buttonText}>Fully Done (Increase)</Text>
                    </TouchableOpacity>
                </View>
                 <TouchableOpacity
                    style={[styles.button, styles.undoButton, !undoData && styles.disabledButton]} // Disable if no undo data
                    onPress={handleUndo}
                    disabled={!undoData} // Disable button if nothing to undo
                 >
                    <Ionicons name="arrow-undo-outline" size={20} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>Undo Last Check-in</Text>
                </TouchableOpacity>
            </View>

             {/* Clear Data Button - Place discreetly */}
             <TouchableOpacity
                style={styles.clearButton}
                onPress={clearAllData}
             >
                <Ionicons name="trash-outline" size={18} color="#dc3545" style={styles.buttonIcon} />
                <Text style={styles.clearButtonText}>Clear All Streak Data</Text>
            </TouchableOpacity>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f4f7', // Light background color
    },
    contentContainer: {
        padding: 20,
        alignItems: 'center', // Center content horizontally
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
         backgroundColor: '#f0f4f7',
    },
    header: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 25,
        color: '#2c3e50', // Darker text color
        textAlign: 'center',
    },
    streakInfoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 30,
    },
    streakBox: {
        backgroundColor: '#fff',
        paddingVertical: 15,
        paddingHorizontal: 10, // Added horizontal padding
        borderRadius: 12,
        alignItems: 'center',
        width: '45%', // Adjust width for better spacing
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    streakNumber: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#34495e', // Slightly softer dark color
        marginVertical: 5, // Add vertical margin
    },
    streakLabel: {
        fontSize: 14,
        color: '#7f8c8d', // Grayish text color
        marginTop: 5, // Space above label
    },
     heatmapContainer: { // Container for the heatmap section
        width: '100%', // Take full width
        alignItems: 'center', // Center heatmap grid within this
        marginBottom: 30,
    },
     heatmapGridContainer: {
        width: '100%', // Fit within the heatmapContainer
        maxWidth: 500, // Max width for larger screens if needed
        paddingVertical: 15,
        paddingHorizontal: 10, // Adjust padding
        backgroundColor: '#fff', // White background for the grid card
        borderRadius: 12, // Match other cards
        marginTop: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    heatmapTitle: {
        fontSize: 18, // Slightly larger title
        fontWeight: '600', // Bolder
        color: '#34495e',
        marginBottom: 15,
        textAlign: 'center',
    },
    gridOuterContainer: {
        flexDirection: 'row',
        width: '100%',
        paddingHorizontal: 5,
    },
    dayLabelsColumn: {
        marginRight: 8,
        paddingTop: 0, // Align with the top of cells
         // Calculate height based on cells + gaps
        height: (16 + 3) * 7, // cellHeight + cellMarginBottom * 7 days
        justifyContent: 'space-around', // Evenly space labels vertically
    },
    dayLabelText: {
        fontSize: 11, // Slightly larger label text
        color: '#888', // Lighter gray for labels
        textAlign: 'center',
        height: 16, // Match cell height
        lineHeight: 16, // Center text vertically
        // marginBottom: 3, // Match cell margin removed - using space-around
    },
    gridScrollView: {
        flex: 1, // Take remaining space
    },
    gridInnerContainer: {
        flexDirection: 'row',
    },
    weekColumn: {
        flexDirection: 'column',
        marginRight: 4, // Horizontal gap between weeks
    },
    dayCell: {
        width: 16, // Slightly larger cells
        height: 16,
        borderRadius: 4, // More rounded corners
        marginBottom: 3, // Vertical gap between days
    },
     emptyCell: { // Style for padding/future cells
        backgroundColor: 'rgba(230, 230, 230, 0.3)', // Very light gray, almost transparent
    },
    todayCell: {
        borderWidth: 2, // Thicker border for today
        borderColor: '#e67e22', // Orange border for today
    },
    legendContainerGrid: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        width: '100%',
        marginTop: 15,
        paddingTop: 10,
        paddingHorizontal: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    legendItemGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 10, // More spacing
        marginBottom: 5,
    },
    legendDotGrid: {
        width: 12, // Larger dots
        height: 12,
        borderRadius: 3, // Squarer dots
        marginRight: 6,
    },
    legendTextGrid: {
        fontSize: 12, // Larger legend text
        color: '#555',
    },
    checkinSection: {
        width: '100%',
        marginTop: 20, // Add margin top
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    checkinPrompt: {
        fontSize: 16,
        color: '#34495e',
        marginBottom: 15,
        textAlign: 'center',
        fontWeight: '500',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Space out buttons
        width: '100%', // Use full width
        marginBottom: 10, // Space before undo button
    },
    button: {
        flexDirection: 'row', // Icon and text side-by-side
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12, // More padding
        paddingHorizontal: 15,
        borderRadius: 25, // More rounded buttons
        width: '48%', // Distribute width
        elevation: 2, // Subtle shadow for buttons
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
    },
     buttonIcon: {
        marginRight: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 14, // Slightly smaller text
        fontWeight: 'bold',
        textAlign: 'center',
    },
    partialButton: {
        backgroundColor: '#ffa726', // Orange
        shadowColor: "#ffa726",
    },
    fullButton: {
        backgroundColor: '#27ae60', // Vibrant Green
        shadowColor: "#27ae60",
    },
     undoButton: {
        backgroundColor: '#e74c3c', // Red color for undo/destructive action
        width: '100%', // Full width for undo
        marginTop: 5, // Add margin top
        shadowColor: "#e74c3c",
    },
    disabledButton: {
        backgroundColor: '#bdc3c7', // Gray out disabled buttons
        elevation: 0,
        shadowOpacity: 0,
    },
     clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40, // More space above clear button
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: '#fff', // White background
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#dc3545', // Red border
    },
    clearButtonText: {
        color: '#dc3545', // Red text
        fontSize: 13,
        marginLeft: 5, // Space between icon and text
    },
});

export default StreaksScreen;
