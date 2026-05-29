import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { clearCommuteLogs } from '../utils/storage';

export default function DeveloperSettings({ 
  visible, 
  onClose, 
  isDarkMode, 
  showPinButton, 
  onPinButtonChange,
  routeDrawMode,
  onRouteDrawModeChange
}) {
  const isDark = !!isDarkMode;
  
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
          }
        }
      ]
    );
  };

  const themeOptions = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent={true}>
      <View style={[styles.fullScreenView, isDark && styles.darkFullScreenView]}>
        
        <View style={[styles.headerRow, isDark && styles.darkHeaderRow]}>
          <Text style={[styles.title, isDark && styles.darkTitle]}>Developer Settings</Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeIconBtn, isDark && styles.darkCloseIconBtn]} hitSlop={12}>
            <Text style={[styles.closeIcon, isDark && styles.darkCloseIcon]}>✖</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionHeader}>APP DATA & FEATURES</Text>
          
          <TouchableOpacity style={[styles.settingItem, isDark && styles.darkSettingItem]} onPress={handleResetBeta} activeOpacity={0.8} hitSlop={6}>
            <View>
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
            <View>
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
            <View>
              <Text style={[styles.settingText, isDark && styles.darkSettingText]}>Route Draw Mode</Text>
              <Text style={styles.settingSubtext}>Enable to trace/record jeepney paths</Text>
            </View>
            <Text style={[styles.toggleState, isDark && styles.darkToggleState]}>{routeDrawMode ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.settingItem, styles.dangerItem, isDark && styles.darkSettingItem]} onPress={handleWipeData} activeOpacity={0.8} hitSlop={6}>
            <View>
              <Text style={[styles.settingText, styles.dangerText]}>Wipe Commute Data</Text>
              <Text style={styles.settingSubtext}>Permanently deletes all boarding logs</Text>
            </View>
          </TouchableOpacity>
        </View>

      </View>
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
    backgroundColor: '#111113',
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
  content: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    marginLeft: 16,
    textTransform: 'uppercase',
  },
  themeRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 6,
    marginBottom: 20,
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
  settingItem: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    minHeight: 64,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  darkSettingItem: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0,
    elevation: 0,
  },
  dangerItem: {
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  settingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  darkSettingText: {
    color: '#FFFFFF',
  },
  dangerText: {
    color: '#FF3B30',
  },
  settingSubtext: {
    fontSize: 13,
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
});
