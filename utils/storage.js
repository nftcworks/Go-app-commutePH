import AsyncStorage from '@react-native-async-storage/async-storage';

const COMMUTE_LOGS_KEY = '@commute_logs_v1';
const GAMIFICATION_SCORE_KEY = '@commute_points_v1';
const COMMUTE_HISTORY_KEY = '@commute_history_v1';

/**
 * Appends a new boarding log to local device storage.
 * @param {Object} logData - { latitude, longitude, timestamp, status }
 */
export const saveBoardingLog = async (logData) => {
  try {
    const existingLogsStr = await AsyncStorage.getItem(COMMUTE_LOGS_KEY);
    const existingLogs = existingLogsStr ? JSON.parse(existingLogsStr) : [];
    
    const updatedLogs = [...existingLogs, logData];
    
    await AsyncStorage.setItem(COMMUTE_LOGS_KEY, JSON.stringify(updatedLogs));
    console.log(`[STORAGE] Logged ${logData.status} at ${logData.timestamp}`);
    
    return true;
  } catch (error) {
    console.error('[STORAGE ERROR] Failed to save log:', error);
    return false;
  }
};

/**
 * Retrieves all offline commute logs for future cloud sync.
 */
export const getCommuteLogs = async () => {
  try {
    const logsStr = await AsyncStorage.getItem(COMMUTE_LOGS_KEY);
    return logsStr ? JSON.parse(logsStr) : [];
  } catch (error) {
    console.error('[STORAGE ERROR] Failed to read logs:', error);
    return [];
  }
};

/**
 * Utility to clear local logs (helpful during development or post-sync).
 */
export const clearCommuteLogs = async () => {
  try {
    await AsyncStorage.removeItem(COMMUTE_LOGS_KEY);
    console.log('[STORAGE] Cleared all commute logs.');
    return true;
  } catch (error) {
    console.error('[STORAGE ERROR] Failed to clear logs:', error);
    return false;
  }
};

/**
 * GAMIFICATION: Add points to the user's local score.
 * (e.g., +10 points for reporting an incident)
 */
export const addGamificationPoints = async (pointsToAdd) => {
  try {
    const currentScoreStr = await AsyncStorage.getItem(GAMIFICATION_SCORE_KEY);
    const currentScore = currentScoreStr ? parseInt(currentScoreStr, 10) : 0;
    
    const newScore = currentScore + pointsToAdd;
    await AsyncStorage.setItem(GAMIFICATION_SCORE_KEY, newScore.toString());
    
    console.log(`[GAMIFICATION] Earned ${pointsToAdd} points! Total: ${newScore}`);
    return newScore;
  } catch (error) {
    console.error('[STORAGE ERROR] Failed to add points:', error);
    return 0;
  }
};

/**
 * Retrieves the current gamification score.
 */
export const getGamificationPoints = async () => {
  try {
    const scoreStr = await AsyncStorage.getItem(GAMIFICATION_SCORE_KEY);
    return scoreStr ? parseInt(scoreStr, 10) : 0;
  } catch (error) {
    console.error('[STORAGE ERROR] Failed to get points:', error);
    return 0;
  }
};

/**
 * Saves a completed commute to history.
 * @param {Object} trip - { destinationName, distance, durationMins, fare, routeTitle, timestamp }
 */
export const saveCommuteHistory = async (trip) => {
  try {
    const existing = await AsyncStorage.getItem(COMMUTE_HISTORY_KEY);
    const history = existing ? JSON.parse(existing) : [];
    const updated = [trip, ...history].slice(0, 50); // Keep last 50 trips
    await AsyncStorage.setItem(COMMUTE_HISTORY_KEY, JSON.stringify(updated));
    console.log(`[STORAGE] Saved commute to ${trip.destinationName}`);
    return true;
  } catch (e) {
    console.error('[STORAGE ERROR] Failed to save commute history:', e);
    return false;
  }
};

/**
 * Retrieves all commute history.
 */
export const getCommuteHistory = async () => {
  try {
    const data = await AsyncStorage.getItem(COMMUTE_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('[STORAGE ERROR] Failed to read commute history:', e);
    return [];
  }
};

/**
 * Gets the average commute time to a specific destination.
 * @param {string} destinationName - The destination to compute average for.
 * @returns {number|null} Average duration in minutes, or null if no data.
 */
export const getAverageCommuteTime = async (destinationName) => {
  try {
    const history = await getCommuteHistory();
    const matching = history.filter(t => 
      t.destinationName && destinationName && 
      t.destinationName.toLowerCase().includes(destinationName.toLowerCase().split(',')[0])
    );
    if (matching.length === 0) return null;
    const avg = matching.reduce((sum, t) => sum + (t.durationMins || 0), 0) / matching.length;
    return Math.round(avg);
  } catch (e) {
    return null;
  }
};
