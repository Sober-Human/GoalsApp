import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Alert,
    ScrollView,
    TouchableOpacity,
    Platform,
    TextInput,
    Modal,
    FlatList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;
const STREAK_DATA_KEY = '@streaksHoursData_v2'; // Updated key for new structure

// Helper to get date string in YYYY-MM-DD format (UTC)
const getUTCDateString = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        // Fallback to today's UTC date if input is invalid
        const now = new Date();
        return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    }
    // For valid dates, directly use UTC methods
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const NUM_WEEKS_TO_SHOW = 10; // Number of weeks for the heatmap

// Get the date for the start of the week (Sunday) for a given date (UTC)
const getStartOfWeekUTC = (date) => {
  const dt = new Date(date.getTime()); // Clone date
  dt.setUTCHours(0,0,0,0); // Normalize to start of day UTC
  const dayOfWeek = dt.getUTCDay(); // 0 = Sunday, 6 = Saturday (UTC day)
  const diff = dt.getUTCDate() - dayOfWeek; // Calculate the date for Sunday
  dt.setUTCDate(diff); // Set the date to Sunday
  return dt;
};

const StreaksScreen = () => {
    const [currentStreak, setCurrentStreak] = useState(0);
    const [longestStreak, setLongestStreak] = useState(0);
    const [heatmapData, setHeatmapData] = useState({}); // Stores { 'YYYY-MM-DD': hours }
    const [totalHours, setTotalHours] = useState(0);
    const [averageHours, setAverageHours] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    // Add state for custom input modal
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [currentHoursInput, setCurrentHoursInput] = useState('');
    const [inputValue, setInputValue] = useState('');
    // Add state for half-hour options
    const [hourOptions] = useState([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8]);
    const [consistencyScore, setConsistencyScore] = useState(0);

    // --- Core Data Processing and Persistence ---

    const saveData = async (dataToSave) => {
        try {
            // Only save relevant parts to avoid bloating AsyncStorage
            const minimalData = {
                heatmapData: dataToSave.heatmapData,
            };
            await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(minimalData));
            // console.log("Data saved:", minimalData);
        } catch (error) {
            console.error("Failed to save data:", error);
            Alert.alert("Error", "Failed to save your progress.");
        }
    };

    // Processes heatmap data to calculate streaks and aggregate stats
    const processDataAndUpdateState = useCallback((currentHeatmapData) => {
        const validHeatmapData = (typeof currentHeatmapData === 'object' && currentHeatmapData !== null && !Array.isArray(currentHeatmapData))
            ? currentHeatmapData
            : {};

        // Clean up old data - only keep data from the last 6 months
        const cleanedHeatmapData = {};
        const cutoffDate = new Date();
        cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - 6); // 6 months ago
        
        Object.entries(validHeatmapData).forEach(([dateStr, hours]) => {
            const entryDate = new Date(dateStr + 'T00:00:00Z');
            if (entryDate >= cutoffDate) {
                cleanedHeatmapData[dateStr] = hours;
            }
        });

        // Filter for days with hours > 0, map to UTC Date objects, and sort
        const datesWithPositiveHours = Object.keys(cleanedHeatmapData)
            .filter(dateStr => typeof cleanedHeatmapData[dateStr] === 'number' && cleanedHeatmapData[dateStr] > 0)
            .map(dateStr => new Date(dateStr + 'T00:00:00Z')) // Parse as UTC
            .sort((a, b) => a.getTime() - b.getTime());

        let newLongestStreak = 0;
        let newCurrentStreak = 0;
        
        if (datesWithPositiveHours.length > 0) {
            let tempStreak = 1;
            newLongestStreak = 1;

            for (let i = 1; i < datesWithPositiveHours.length; i++) {
                const prevDate = datesWithPositiveHours[i-1];
                const currDate = datesWithPositiveHours[i];
                const diffTime = currDate.getTime() - prevDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    tempStreak++;
                } else {
                    newLongestStreak = Math.max(newLongestStreak, tempStreak);
                    tempStreak = 1; // Reset for new segment
                }
            }
            newLongestStreak = Math.max(newLongestStreak, tempStreak); // Final check for the last segment

            // Calculate current streak
            const todayNormalized = new Date();
            todayNormalized.setUTCHours(0, 0, 0, 0);
            const lastActiveDate = datesWithPositiveHours[datesWithPositiveHours.length - 1];
            const diffFromTodayInDays = Math.round((todayNormalized.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffFromTodayInDays <= 1) { // Last active day was today or yesterday
                newCurrentStreak = tempStreak; // The last calculated segment is the current streak
            } else {
                newCurrentStreak = 0; // Streak is broken
            }
        }

        setCurrentStreak(newCurrentStreak);
        setLongestStreak(newLongestStreak);

        // Calculate total and average hours
        let sumHours = 0;
        let recordedDaysCount = 0;
        Object.values(cleanedHeatmapData).forEach(hours => {
            if (typeof hours === 'number') { // Ensure hours is a number
                sumHours += hours;
                recordedDaysCount++; // Count days that have an entry (even if 0 hours)
            }
        });

        setTotalHours(sumHours);
        setAverageHours(recordedDaysCount > 0 ? sumHours / recordedDaysCount : 0);
        setHeatmapData(cleanedHeatmapData); // Update heatmap state with cleaned data

        // Calculate consistency score (% of days with activity in the last 30 days)
        const calculateConsistencyScore = (data) => {
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setUTCDate(today.getUTCDate() - 30);
            
            let daysWithActivity = 0;
            for (let i = 0; i < 30; i++) {
                const checkDate = new Date(today);
                checkDate.setUTCDate(today.getUTCDate() - i);
                const dateStr = getUTCDateString(checkDate);
                if (data[dateStr] && data[dateStr] > 0) {
                    daysWithActivity++;
                }
            }
            
            return daysWithActivity / 30;
        };
        
        const consistencyScoreValue = calculateConsistencyScore(cleanedHeatmapData);
        setConsistencyScore(consistencyScoreValue);

        return { heatmapData: cleanedHeatmapData }; // Return cleaned data for saving
    }, []); // Dependencies: state setters are stable

    // Load data from AsyncStorage
    const loadData = useCallback(async () => {
        // console.log("Loading data...");
        setIsLoading(true);
        try {
            const storedDataString = await AsyncStorage.getItem(STREAK_DATA_KEY);
            const storedData = storedDataString ? JSON.parse(storedDataString) : null;
            // console.log("Loaded data from AsyncStorage:", storedData);
            processDataAndUpdateState(storedData?.heatmapData || {});
        } catch (error) {
            console.error("Failed to load data:", error);
            Alert.alert("Error", "Failed to load your data. Initializing fresh.");
            processDataAndUpdateState({}); // Initialize with empty data on error
        } finally {
            setIsLoading(false);
            // console.log("Loading complete.");
        }
    }, [processDataAndUpdateState]);

    useFocusEffect(
        useCallback(() => {
            loadData();
            return () => {
                // console.log("Streaks screen unfocused");
            };
        }, [loadData])
    );

    // Handle user input for hours on a specific day
    const handleHoursInput = async (dateStr, currentHours) => {
        if (Platform.OS === 'ios') {
            // iOS can use Alert.prompt
            Alert.prompt(
                `Log Hours for ${dateStr}`,
                `Enter work hours (e.g., 0, 0.5, 1, 2.5).\nCurrent: ${currentHours === undefined ? 'N/A' : currentHours} hrs`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'OK',
                        onPress: async (text) => {
                            saveHoursForDate(dateStr, text);
                        },
                    },
                ],
                'plain-text',
                currentHours !== undefined ? String(currentHours) : '0', // Default value in prompt
                'numeric' // Keyboard type
            );
        } else {
            // Android uses custom modal
            setSelectedDate(dateStr);
            setCurrentHoursInput(currentHours === undefined ? 'N/A' : String(currentHours));
            setInputValue(currentHours !== undefined ? String(currentHours) : '0');
            setModalVisible(true);
        }
    };

    // Function to handle saving hours (extracted for reuse)
    const saveHoursForDate = async (dateStr, text) => {
        const newHours = parseFloat(text);
        if (isNaN(newHours) || newHours < 0 || newHours % 0.5 !== 0) {
            Alert.alert(
                "Invalid Input",
                "Please enter a non-negative number in half-hour intervals (e.g., 0, 0.5, 1, 1.5)."
            );
            return;
        }

        const updatedHeatmapData = { ...heatmapData, [dateStr]: newHours };
        const processed = processDataAndUpdateState(updatedHeatmapData);
        await saveData(processed); // Save the processed data
    };

    // Modal for Android input with half-hour options
    const renderInputModal = () => {
        return (
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{`Log Hours for ${selectedDate}`}</Text>
                        <Text style={styles.modalSubtitle}>
                            {`Current: ${currentHoursInput} hrs\nSelect hours:`}
                        </Text>
                        
                        <FlatList
                            data={hourOptions}
                            horizontal={false}
                            numColumns={3}
                            style={styles.optionsList}
                            keyExtractor={(item) => item.toString()}
                            renderItem={({item}) => (
                                <TouchableOpacity
                                    style={[
                                        styles.hourOption,
                                        parseFloat(currentHoursInput) === item && styles.selectedHourOption
                                    ]}
                                    onPress={() => {
                                        setModalVisible(false);
                                        saveHoursForDate(selectedDate, item.toString());
                                    }}
                                >
                                    <Text 
                                        style={[
                                            styles.hourOptionText,
                                            parseFloat(currentHoursInput) === item && styles.selectedHourOptionText
                                        ]}
                                    >
                                        {item} hr{item !== 1 && 's'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                        
                        <TouchableOpacity 
                            style={styles.cancelOptionButton} 
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.cancelOptionText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    // --- Heatmap Grid Rendering Logic ---
    const generateHeatmapGridUIData = (currentHeatmapDataMap) => {
        const gridRows = []; // Each element will be a week (an array of 7 day objects)
        const todayNormalized = new Date();
        todayNormalized.setUTCHours(0,0,0,0);

        let currentWeekStartDate = getStartOfWeekUTC(todayNormalized);
        // Go back (NUM_WEEKS_TO_SHOW - 1) weeks from the start of the current week
        currentWeekStartDate.setUTCDate(currentWeekStartDate.getUTCDate() - (NUM_WEEKS_TO_SHOW - 1) * 7);

        for (let weekIndex = 0; weekIndex < NUM_WEEKS_TO_SHOW; weekIndex++) {
            let weekCells = [];
            for (let dayIndexInWeek = 0; dayIndexInWeek < 7; dayIndexInWeek++) {
                const cellDate = new Date(currentWeekStartDate.getTime());
                cellDate.setUTCDate(currentWeekStartDate.getUTCDate() + (weekIndex * 7) + dayIndexInWeek);
                const dateStr = getUTCDateString(cellDate);
                const hours = currentHeatmapDataMap[dateStr]; // Undefined if no entry

                const isFuture = cellDate.getTime() > todayNormalized.getTime();
                const isToday = dateStr === getUTCDateString(todayNormalized) && !isFuture;

                weekCells.push({
                    date: dateStr,
                    hours: hours,
                    isFuture: isFuture,
                    isToday: isToday
                });
            }
            gridRows.push(weekCells);
        }

        // Transpose grid for column-based rendering (each column is a week)
        // Result: transposedGrid[dayOfWeek (0-6)][weekIndex (0-NUM_WEEKS_TO_SHOW-1)]
        const transposedGrid = [];
        if (gridRows.length > 0 && gridRows[0].length === 7) {
            for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) { // Sunday to Saturday
                let dayColumnCells = [];
                for (let weekIdx = 0; weekIdx < NUM_WEEKS_TO_SHOW; weekIdx++) {
                    dayColumnCells.push(gridRows[weekIdx][dayOfWeek]);
                }
                transposedGrid.push(dayColumnCells);
            }
        }
        return transposedGrid;
    };

    const getCellColor = (hours, isFuture) => {
        if (isFuture) return '#f0f0f0'; // Very light grey for future, non-interactive cells
        if (hours === undefined || hours === null) return '#e0e0e0'; // Default grey for no entry
        if (hours === 0) return '#e0e0e0';      // Default grey
        if (hours > 0 && hours <= 2) return '#e74c3c'; // Red
        if (hours > 2 && hours <= 3.5) return '#ffa726'; // Orange
        if (hours > 3.5 && hours <= 5) return '#90ee90'; // Light Green
        if (hours > 5) return '#006400';      // Dark Green
        return '#e0e0e0'; // Fallback
    };

    const renderHeatmapGrid = () => {
        const transposedGridData = generateHeatmapGridUIData(heatmapData); // [dayOfWeek][weekIndex]
        const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

        // Calculate cell size dynamically
        const horizontalPaddingInHeatmapContainer = styles.heatmapSectionContainer.paddingHorizontal || 0;
        const dayLabelColumnWidth = 25; // Approximate width for day labels (S, M, T...)
        const gapBetweenLabelAndGrid = styles.dayLabelsColumn.marginRight || 0;
        const totalCellMarginRight = (NUM_WEEKS_TO_SHOW -1) * (styles.weekColumn.marginRight || 0) ; // Total horizontal margins between week columns
        
        const availableWidthForGridCells = screenWidth - (horizontalPaddingInHeatmapContainer * 2) - dayLabelColumnWidth - gapBetweenLabelAndGrid - totalCellMarginRight - 10; // -10 for safety margin
        const cellWidth = Math.max(12, Math.floor(availableWidthForGridCells / NUM_WEEKS_TO_SHOW));
        const cellHeight = cellWidth; // Square cells

        if (isLoading && !Object.keys(heatmapData).length) {
            return <Text style={styles.loadingText}>Loading heatmap...</Text>;
        }
        if (transposedGridData.length === 0) {
            return <Text style={styles.loadingText}>No data for heatmap.</Text>;
        }

        return (
            <View style={styles.gridOuterContainer}>
                <View style={[styles.dayLabelsColumn, { height: (cellHeight + styles.dayCell.marginBottom) * 7 - styles.dayCell.marginBottom }]}>
                    {dayLabels.map((label, index) => (
                        <Text key={`label-${index}`} style={[styles.dayLabelText, { height: cellHeight, lineHeight: cellHeight }]}>
                            {index % 2 !== 0 ? label : ''} {/* Show M, W, F for less clutter */}
                        </Text>
                    ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScrollView}>
                    <View style={styles.gridInnerContainer}>
                        {/* Iterate through weeks (columns) */}
                        {transposedGridData[0].map((_, weekIndex) => (
                            <View key={`weekcol-${weekIndex}`} style={[styles.weekColumn, { marginRight: weekIndex < NUM_WEEKS_TO_SHOW -1 ? 4 : 0}]}>
                                {/* Iterate through days of the week (cells in the column) */}
                                {transposedGridData.map((dayRow, dayIndex) => {
                                    const cell = dayRow[weekIndex];
                                    if (!cell) return <View key={`empty-${weekIndex}-${dayIndex}`} style={[styles.dayCell, { width: cellWidth, height: cellHeight, backgroundColor: '#f0f0f0' }]} />;

                                    const cellStyle = [
                                        styles.dayCell,
                                        {
                                            width: cellWidth,
                                            height: cellHeight,
                                            backgroundColor: getCellColor(cell.hours, cell.isFuture),
                                        },
                                        cell.isToday && styles.todayCell,
                                        cell.isFuture && styles.futureCell,
                                    ];

                                    return (
                                        <TouchableOpacity
                                            key={cell.date + weekIndex + dayIndex} // More unique key
                                            style={cellStyle}
                                            disabled={cell.isFuture}
                                            onPress={() => !cell.isFuture && handleHoursInput(cell.date, cell.hours)}
                                        >
                                            {/* Display hours in cell */}
                                            {cell.hours > 0 && (
                                                <Text style={styles.cellText}>
                                                    {cell.hours}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>
        );
    };

    const renderLegend = () => {
        return (
            <View style={styles.legendContainerGrid}>
                <View style={styles.legendItemGrid}><View style={[styles.legendDotGrid, { backgroundColor: getCellColor(1, false) }]} /><Text style={styles.legendTextGrid}>0.5-2 hrs</Text></View>
                <View style={styles.legendItemGrid}><View style={[styles.legendDotGrid, { backgroundColor: getCellColor(3, false) }]} /><Text style={styles.legendTextGrid}>2-3.5 hrs</Text></View>
                <View style={styles.legendItemGrid}><View style={[styles.legendDotGrid, { backgroundColor: getCellColor(4, false) }]} /><Text style={styles.legendTextGrid}>3.5-5 hrs</Text></View>
                <View style={styles.legendItemGrid}><View style={[styles.legendDotGrid, { backgroundColor: getCellColor(6, false) }]} /><Text style={styles.legendTextGrid}>&gt;5 hrs</Text></View>
                <View style={styles.legendItemGrid}><View style={[styles.legendDotGrid, { backgroundColor: getCellColor(0, false) }]} /><Text style={styles.legendTextGrid}>0/None</Text></View>
            </View>
        );
    };

    // Clear all data
    const clearAllData = async () => {
        Alert.alert(
            "Confirm Clear",
            "Are you sure you want to clear all streak and hours data? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear Data",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await AsyncStorage.removeItem(STREAK_DATA_KEY);
                            processDataAndUpdateState({}); // Reset state
                            Alert.alert("Data Cleared", "All your data has been successfully cleared.");
                        } catch (error) {
                            console.error("Failed to clear data:", error);
                            Alert.alert("Error", "Failed to clear data.");
                        }
                    },
                },
            ]
        );
    };

    // Main render
    if (isLoading && !Object.keys(heatmapData).length) {
        return <View style={styles.centered}><Text style={styles.loadingText}>Loading Streaks...</Text></View>;
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {renderInputModal()}
            <Text style={styles.header}>Activity Streaks</Text>

            <View style={styles.streakInfoContainer}>
                <View style={styles.streakBox}>
                    <Ionicons name="flame-outline" size={28} color="#ff6a00" />
                    <Text style={styles.streakNumber}>{currentStreak}</Text>
                    <Text style={styles.streakLabel}>Current Streak</Text>
                </View>
                <View style={styles.streakBox}>
                    <Ionicons name="trophy-outline" size={28} color="#ffd700" />
                    <Text style={styles.streakNumber}>{longestStreak}</Text>
                    <Text style={styles.streakLabel}>Longest Streak</Text>
                </View>
            </View>

            <View style={styles.statsContainer}>
                 <View style={styles.statBox}>
                    <Ionicons name="hourglass-outline" size={28} color="#3498db" />
                    <Text style={styles.statNumber}>{totalHours.toFixed(1)}</Text>
                    <Text style={styles.statLabel}>Total Hours</Text>
                </View>
                <View style={styles.statBox}>
                    <Ionicons name="stats-chart-outline" size={28} color="#2ecc71" />
                    <Text style={styles.statNumber}>{averageHours.toFixed(1)}</Text>
                    <Text style={styles.statLabel}>Avg Hours/Day</Text>
                </View>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Ionicons name="calendar-outline" size={28} color="#9b59b6" />
                    <Text style={styles.statNumber}>{Math.round(consistencyScore * 100)}%</Text>
                    <Text style={styles.statLabel}>30-Day Consistency</Text>
                </View>
                <View style={styles.statBox}>
                    <Ionicons name="trending-up-outline" size={28} color="#f39c12" />
                    <Text style={styles.statNumber}>{Math.round(consistencyScore * 30)}</Text>
                    <Text style={styles.statLabel}>Active Days (30d)</Text>
                </View>
            </View>

            <View style={styles.heatmapSectionContainer}>
                <Text style={styles.heatmapTitle}>Activity Heatmap</Text>
                {renderHeatmapGrid()}
                {renderLegend()}
            </View>

            <TouchableOpacity
                style={styles.clearButton}
                onPress={clearAllData}
            >
                <Ionicons name="trash-bin-outline" size={20} color="#e74c3c" />
                <Text style={styles.clearButtonText}>Clear All Data</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6f8', // Light overall background
    },
    contentContainer: {
        paddingVertical: 20,
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f4f6f8',
    },
    loadingText: {
        fontSize: 16,
        color: '#555',
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#2c3e50', // Dark blue-grey
        textAlign: 'center',
    },
    streakInfoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 20,
    },
    streakBox: {
        backgroundColor: '#ffffff',
        paddingVertical: 20,
        paddingHorizontal: 10,
        borderRadius: 12,
        alignItems: 'center',
        width: '48%', // Two boxes side-by-side
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 5,
    },
    streakNumber: {
        fontSize: 34,
        fontWeight: 'bold',
        color: '#34495e', // Darker text for numbers
        marginVertical: 4,
    },
    streakLabel: {
        fontSize: 13,
        color: '#7f8c8d', // Grey for labels
        marginTop: 3,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 25,
    },
    statBox: {
        backgroundColor: '#ffffff',
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderRadius: 12,
        alignItems: 'center',
        width: '48%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    statNumber: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#34495e',
        marginVertical: 3,
    },
    statLabel: { // Corrected from style.statLabel
        fontSize: 13,
        color: '#7f8c8d',
        marginTop: 3,
        textAlign: 'center',
    },
    heatmapSectionContainer: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingVertical: 20,
        paddingHorizontal: 10, // Padding for the heatmap card itself
        marginBottom: 25,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 5,
    },
    heatmapTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#34495e',
        marginBottom: 15,
        textAlign: 'center',
    },
    gridOuterContainer: {
        flexDirection: 'row',
        width: '100%',
    },
    dayLabelsColumn: {
        width: 25, // Fixed width for S, M, T... labels
        marginRight: 5, // Space between labels and grid
        justifyContent: 'space-around',
    },
    dayLabelText: {
        fontSize: 12,
        color: '#7f8c8d',
        textAlign: 'center',
    },
    gridScrollView: {
        flex: 1, // Takes remaining width for scrollable weeks
    },
    gridInnerContainer: {
        flexDirection: 'row', // Weeks are laid out horizontally
    },
    weekColumn: {
        flexDirection: 'column', // Days are vertical within a week column
    },
    dayCell: {
        // width and height are calculated dynamically
        borderRadius: 5,
        marginBottom: 4, // Vertical gap between day cells in a week
        alignItems: 'center',
        justifyContent: 'center',
    },
    cellText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#fff',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
    },
    todayCell: {
        borderWidth: 2.5,
        borderColor: '#3498db', // Bright blue border for today
    },
    futureCell: {
        opacity: 0.7, // Slightly faded future cells
    },
    legendContainerGrid: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        width: '100%',
        marginTop: 20,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#eaecee',
    },
    legendItemGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 7,
        marginVertical: 4,
    },
    legendDotGrid: {
        width: 14,
        height: 14,
        borderRadius: 4, // Slightly more rounded dots
        marginRight: 6,
    },
    legendTextGrid: {
        fontSize: 11,
        color: '#555',
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20, // Space above the clear button
        paddingVertical: 12,
        paddingHorizontal: 25,
        backgroundColor: '#fff',
        borderRadius: 25, // Pill shape
        borderWidth: 1.5,
        borderColor: '#e74c3c', // Red border for destructive action
        shadowColor: "#e74c3c",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    clearButtonText: {
        color: '#e74c3c',
        fontSize: 14,
        marginLeft: 8,
        fontWeight: '500',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        width: '80%',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#34495e',
        marginBottom: 10,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 15,
        textAlign: 'center',
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        marginBottom: 20,
        fontSize: 16,
        textAlign: 'center',
    },
    modalButtonContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-around',
    },
    modalButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    okButton: {
        backgroundColor: '#3498db',
    },
    cancelButtonText: {
        color: '#555',
        fontWeight: '500',
    },
    okButtonText: {
        color: 'white',
        fontWeight: '500',
    },
    // Hour options styles
    optionsList: {
        width: '100%',
        maxHeight: 200,
        marginBottom: 10,
    },
    hourOption: {
        flex: 1,
        margin: 4,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedHourOption: {
        backgroundColor: '#3498db',
    },
    hourOptionText: {
        color: '#444',
        fontWeight: '500',
    },
    selectedHourOptionText: {
        color: 'white',
    },
    cancelOptionButton: {
        width: '100%',
        paddingVertical: 12,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginTop: 10,
        alignItems: 'center',
    },
    cancelOptionText: {
        color: '#555',
        fontWeight: '500',
    },
});

export default StreaksScreen;
