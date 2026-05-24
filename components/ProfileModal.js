import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ScrollView, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCommuteHistory, clearCommuteLogs } from '../utils/storage';

export default function ProfileModal({ 
  visible, 
  onClose, 
  isDarkMode, 
  themePreference, 
  onThemeChange, 
  showPinButton, 
  onPinButtonChange,
  routeDrawMode,
  onRouteDrawModeChange 
}) {
  const isDark = !!isDarkMode;
  const [stats, setStats] = useState({ totalTrips: 0, totalSpent: 0, totalMinutes: 0 });
  const [showDevConsole, setShowDevConsole] = useState(false);
  const [showPathManager, setShowPathManager] = useState(false);
  const [customPaths, setCustomPaths] = useState({});

  const loadCustomPaths = async () => {
    try {
      const data = await AsyncStorage.getItem('@custom_routes');
      if (data) setCustomPaths(JSON.parse(data));
    } catch(e) {}
  };

  const handleDeletePath = (routeId) => {
    Alert.alert("Delete Path", "Are you sure you want to delete this custom path?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive",
        onPress: async () => {
          const newPaths = { ...customPaths };
          delete newPaths[routeId];
          await AsyncStorage.setItem('@custom_routes', JSON.stringify(newPaths));
          setCustomPaths(newPaths);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    ]);
  };

  const handleResetBeta = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.removeItem('@beta_accepted');
    Alert.alert('Success', 'Beta disclaimer reset! Restart the app to see it.');
  };

  const handleWipeData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Wipe Commute Data?",
      "Are you sure you want to permanently delete all your commute logs? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Wipe Data", 
          style: "destructive",
          onPress: async () => {
            await clearCommuteLogs();
            Alert.alert('Storage Cleared', 'All commute logs wiped.');
            loadStats(); // reload to show 0
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (visible) {
      loadStats();
    }
  }, [visible]);

  const loadStats = async () => {
    try {
      const history = await getCommuteHistory();
      let totalTrips = history.length;
      let totalSpent = 0;
      let totalMinutes = 0;
      
      history.forEach(log => {
        totalSpent += (log.fare || 0);
        totalMinutes += (log.durationMins || 0);
      });
      
      setStats({ totalTrips, totalSpent, totalMinutes });
    } catch (e) {
      console.log('Error loading stats', e);
    }
  };

  const themeOptions = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.fullScreenView, isDark && styles.darkFullScreenView]}>
        
        <View style={[styles.headerRow, isDark && styles.darkHeaderRow]}>
          <Text style={[styles.title, isDark && styles.darkTitle]}>My Profile</Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeIconBtn, isDark && styles.darkCloseIconBtn]} hitSlop={12}>
            <Text style={[styles.closeIcon, isDark && styles.darkCloseIcon]}>✖</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Profile Header */}
          <View style={[styles.profileHeader, isDark && styles.darkProfileHeader]}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>🚗</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, isDark && styles.darkText]}>Waze Commuter</Text>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>Beta Tester</Text>
              </View>
            </View>
          </View>

          {/* Commute Stats */}
          <Text style={styles.sectionHeader}>COMMUTE STATS</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, isDark && styles.darkStatBox]}>
              <Text style={[styles.statValue, isDark && styles.darkText]}>{stats.totalTrips}</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={[styles.statBox, isDark && styles.darkStatBox]}>
              <Text style={[styles.statValue, isDark && styles.darkText]}>₱{stats.totalSpent}</Text>
              <Text style={styles.statLabel}>Spent</Text>
            </View>
            <View style={[styles.statBox, isDark && styles.darkStatBox]}>
              <Text style={[styles.statValue, isDark && styles.darkText]}>{Math.round(stats.totalMinutes / 60)}h</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
          </View>

          {/* Appearance Settings */}
          <Text style={styles.sectionHeader}>APPEARANCE</Text>
          <View style={[styles.themeRow, isDark && styles.darkThemeRow]}>
            {themeOptions.map((option) => {
              const isActive = themePreference === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.themeOption,
                    isDark && styles.darkThemeOption,
                    isActive && styles.themeOptionActive,
                    isActive && isDark && styles.darkThemeOptionActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (onThemeChange) onThemeChange(option.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.themeOptionText, isDark && styles.darkThemeOptionText, isActive && styles.themeOptionTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Developer Entry */}
          <Text style={styles.sectionHeader}>ADVANCED</Text>
          <TouchableOpacity 
            style={[styles.devButton, isDark && styles.darkDevButton, showDevConsole && styles.devButtonActive]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowDevConsole(!showDevConsole);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.devButtonLeft}>
              <Text style={styles.devButtonIcon}>🛠️</Text>
              <Text style={[styles.devButtonText, isDark && styles.darkText]}>Developer Console</Text>
            </View>
            <Text style={[styles.devButtonArrow, showDevConsole && styles.devButtonArrowOpen]}>›</Text>
          </TouchableOpacity>

          {showDevConsole && (
            <View style={styles.devConsoleSection}>
              <TouchableOpacity style={[styles.settingItem, isDark && styles.darkSettingItem]} onPress={handleResetBeta} activeOpacity={0.8} hitSlop={6}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingText, isDark && styles.darkSettingText]}>Reset Beta Disclaimer</Text>
                  <Text style={styles.settingSubtext}>Shows the beta popup again on next load</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingItem, isDark && styles.darkSettingItem]}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (onPinButtonChange) onPinButtonChange(!showPinButton);
                }}
                activeOpacity={0.8}
                hitSlop={6}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingText, isDark && styles.darkSettingText]}>Show Pin Button</Text>
                  <Text style={styles.settingSubtext}>Toggle the map pin action button</Text>
                </View>
                <Text style={[styles.toggleState, isDark && styles.darkToggleState]}>{showPinButton ? 'On' : 'Off'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingItem, isDark && styles.darkSettingItem]}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (onRouteDrawModeChange) onRouteDrawModeChange(!routeDrawMode);
                }}
                activeOpacity={0.8}
                hitSlop={6}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingText, isDark && styles.darkSettingText]}>Route Draw Mode</Text>
                  <Text style={styles.settingSubtext}>Enable to trace/record jeepney paths</Text>
                </View>
                <Text style={[styles.toggleState, isDark && styles.darkToggleState]}>{routeDrawMode ? 'On' : 'Off'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.settingItem, isDark && styles.darkSettingItem]}
                onPress={() => {
                  Haptics.selectionAsync();
                  loadCustomPaths();
                  setShowPathManager(true);
                }}
                activeOpacity={0.8}
                hitSlop={6}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingText, isDark && styles.darkSettingText]}>Manage Custom Paths</Text>
                  <Text style={styles.settingSubtext}>View and delete locally saved routes</Text>
                </View>
                <Text style={styles.devButtonArrow}>›</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.settingItem, styles.dangerItem, isDark && styles.darkSettingItem]} onPress={handleWipeData} activeOpacity={0.8} hitSlop={6}>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingText, styles.dangerText]}>Wipe Commute Data</Text>
                  <Text style={styles.settingSubtext}>Permanently deletes all boarding logs</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Nested Modal: Path Manager */}
      <Modal visible={showPathManager} animationType="slide">
        <View style={[styles.fullScreenView, isDark && styles.darkFullScreenView]}>
          <View style={[styles.headerRow, isDark && styles.darkHeaderRow]}>
            <Text style={[styles.title, isDark && styles.darkTitle]}>Custom Paths</Text>
            <TouchableOpacity onPress={() => setShowPathManager(false)} style={[styles.closeIconBtn, isDark && styles.darkCloseIconBtn]} hitSlop={12}>
              <Text style={[styles.closeIcon, isDark && styles.darkCloseIcon]}>✖</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {Object.keys(customPaths).length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ fontSize: 40, marginBottom: 16 }}>🗺️</Text>
                <Text style={[styles.settingText, isDark && styles.darkSettingText, { textAlign: 'center' }]}>No custom paths saved yet.</Text>
                <Text style={[styles.settingSubtext, { textAlign: 'center', marginTop: 8 }]}>Enable Route Draw Mode and trace a path on the map.</Text>
              </View>
            ) : (
              Object.keys(customPaths).map(routeId => {
                const pathObj = customPaths[routeId];
                const isArray = Array.isArray(pathObj);
                const isAltArray = !isArray && Array.isArray(pathObj.paths);
                const coordsCount = isArray ? pathObj.length : (isAltArray ? pathObj.paths.reduce((acc, p) => acc + p.coordinates.length, 0) : pathObj.coordinates?.length);
                const isDashed = !isArray && !isAltArray && pathObj.isDashed;
                const category = pathObj.category || 'jeep';
                const dropoffName = pathObj.dropoffName;
                
                let pathTitle = routeId.replace('route_from_', '').replace('_to_', ' ➡️ ');
                if (dropoffName) {
                  pathTitle = routeId.replace('route_from_', '').split('_to_')[0] + ` ➡️ ${dropoffName}`;
                }
                
                const getIcon = (cat) => {
                  switch (cat) {
                    case 'jeep': return '🚙';
                    case 'tricycle': return '🛺';
                    case 'uv': return '🚐';
                    case 'bus': return '🚌';
                    case 'carousel': return '🚌';
                    case 'train': return '🚆';
                    default: return '📍';
                  }
                };
                
                return (
                  <View key={routeId} style={[styles.settingItem, isDark && styles.darkSettingItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                      <View style={{ marginRight: 12, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 24 }}>{getIcon(category)}</Text>
                      </View>
                      <View style={{ flex: 1, paddingRight: 12, justifyContent: 'center' }}>
                        <Text style={[styles.settingText, isDark && styles.darkSettingText]} numberOfLines={2}>{pathTitle}</Text>
                        <Text style={styles.settingSubtext}>
                          {isAltArray ? `${pathObj.paths.length} Routes` : (isDashed ? 'Dashed Path' : 'Snapped Path')} • {coordsCount} waypoints
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={{ padding: 8, backgroundColor: 'rgba(255, 59, 48, 0.1)', borderRadius: 8 }}
                        onPress={() => handleDeletePath(routeId)}
                      >
                        <Text style={styles.dangerText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenView: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  darkFullScreenView: {
    backgroundColor: '#000000',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  darkHeaderRow: {
    borderBottomColor: '#2C2C2E',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: 'System',
  },
  darkTitle: {
    color: '#FFFFFF',
  },
  closeIconBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#E5E5EA',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkCloseIconBtn: {
    backgroundColor: '#2C2C2E',
  },
  closeIcon: {
    fontSize: 16,
    color: '#3A3A3C',
  },
  darkCloseIcon: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  darkProfileHeader: {
    backgroundColor: '#1C1C1E',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  avatarText: {
    fontSize: 32,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  badgeContainer: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    marginLeft: 16,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  darkStatBox: {
    backgroundColor: '#1C1C1E',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  themeRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 6,
    marginBottom: 24,
  },
  darkThemeRow: {
    backgroundColor: '#1C1C1E',
  },
  themeOption: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkThemeOption: {
    backgroundColor: 'transparent',
  },
  themeOptionActive: {
    backgroundColor: '#007AFF',
  },
  darkThemeOptionActive: {
    backgroundColor: '#0A84FF',
  },
  themeOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
  },
  darkThemeOptionText: {
    color: '#8E8E93',
  },
  themeOptionTextActive: {
    color: '#FFFFFF',
  },
  devButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  darkDevButton: {
    backgroundColor: '#1C1C1E',
  },
  devButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  devButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  devButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  devButtonArrow: {
    fontSize: 24,
    color: '#8E8E93',
    fontWeight: '300',
  },
  devButtonArrowOpen: {
    transform: [{ rotate: '90deg' }],
  },
  devButtonActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  devConsoleSection: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginTop: -2,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  darkSettingItem: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#2C2C2E',
  },
  settingContent: {
    flex: 1,
    paddingRight: 16,
  },
  settingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  darkSettingText: {
    color: '#FFFFFF',
  },
  settingSubtext: {
    fontSize: 12,
    color: '#8E8E93',
  },
  toggleState: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  darkToggleState: {
    color: '#0A84FF',
  },
  dangerText: {
    color: '#FF3B30',
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  darkText: {
    color: '#FFFFFF',
  },
});
