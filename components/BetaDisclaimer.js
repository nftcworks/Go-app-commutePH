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
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent={true}>
      <View style={styles.absolute}>
        <View style={styles.alertBox}>
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Beta Version</Text>
            <Text style={styles.message}>
              Features and routes may be unstable.
            </Text>
            
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📍</Text>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Smart Routing</Text>
                <Text style={styles.featureDesc}>Uses accurate developer-drawn paths.</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🛠️</Text>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Route Editor</Text>
                <Text style={styles.featureDesc}>Draw accurate jeepney paths.</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleAccept} activeOpacity={0.5}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // Slightly darker for iOS feel
  },
  alertBox: {
    backgroundColor: '#F2F2F7', // iOS grouped background color
    borderRadius: 14, // iOS standard alert radius
    width: 280, // Standard iOS alert width
    alignItems: 'center',
    overflow: 'hidden',
  },
  contentContainer: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 17, // iOS standard
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'System',
    color: '#000000',
    textAlign: 'center',
  },
  message: {
    fontSize: 13, // iOS standard subtext
    color: '#000000',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'System',
  },
  button: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3C3C4350', // iOS separator color
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#007AFF', // iOS blue
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'System',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center', // centered horizontally
    marginBottom: 12,
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'System',
  },
  featureDesc: {
    fontSize: 11,
    color: '#3C3C43',
    lineHeight: 14,
    fontFamily: 'System',
  }
});
