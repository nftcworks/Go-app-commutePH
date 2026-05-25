import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export default function BetaDisclaimer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkBetaStatus = async () => {
      const accepted = await AsyncStorage.getItem('@beta_accepted');
      if (!accepted) {
        setVisible(true);
      }
    };
    checkBetaStatus();
  }, []);

  const handleAccept = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem('@beta_accepted', 'true');
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.absolute}>
        <View style={styles.alertBox}>
          <Text style={styles.title}>Welcome to Beta</Text>
          <Text style={styles.message}>
            This is an early developer preview of the Go commute PH app. Features and routes may be unstable.
          </Text>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📍</Text>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Smart Routing</Text>
              <Text style={styles.featureDesc}>Search for a destination and the app will use exact paths drawn by developers instead of just guessing.</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🛠️</Text>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Route Editor</Text>
              <Text style={styles.featureDesc}>Go to Developer Console to draw and manage perfectly accurate jeepney paths.</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleAccept} activeOpacity={0.8}>
            <Text style={styles.buttonText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  absolute: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  alertBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    fontFamily: 'System',
    color: '#1C1C1E',
  },
  message: {
    fontSize: 16,
    color: '#3A3A3C',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    fontFamily: 'System',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'System',
  }
});
