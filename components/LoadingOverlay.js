import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Modal } from 'react-native';

export default function LoadingOverlay({ visible }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotation.setValue(0);
    }
  }, [visible]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent={true}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.spinnerContainer}>
            {/* The rotating gradient/blue ring */}
            <Animated.View style={[styles.spinnerRing, { transform: [{ rotate: spin }] }]} />
            {/* The white icon in the center */}
            <Text style={styles.centerIcon}>🚗</Text>
          </View>
          <Text style={styles.loadingText}>Just a sec...</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1E1F22', // Dark background like the image
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  spinnerContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  spinnerRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: '#007AFF', // Blue ring
    borderTopColor: '#00D4FF', // Lighter blue for gradient effect
    borderRightColor: '#00D4FF',
  },
  centerIcon: {
    fontSize: 28,
    color: '#FFF',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  }
});
