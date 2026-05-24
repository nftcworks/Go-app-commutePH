import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RouteList({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isWalk = step.type === 'walk';
        return (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.iconContainer}>
              <View style={[styles.iconBubble, isWalk ? styles.iconWalk : styles.iconRide]}>
                <Text style={styles.icon}>{step.icon}</Text>
              </View>
              {index !== steps.length - 1 && (
                <View style={[styles.line, isWalk ? styles.lineDashed : styles.lineSolid]} />
              )}
            </View>
            <View style={styles.contentContainer}>
              <Text style={styles.instruction}>{step.instruction}</Text>
              <Text style={styles.duration}>~{step.duration} mins</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  stepRow: {
    flexDirection: 'row',
  },
  iconContainer: {
    alignItems: 'center',
    width: 40,
    marginRight: 16,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconWalk: {
    backgroundColor: '#F2F2F7',
  },
  iconRide: {
    backgroundColor: '#E5F1FF',
  },
  icon: {
    fontSize: 18,
  },
  line: {
    width: 3,
    flex: 1,
    marginTop: -4,
    marginBottom: -4,
    zIndex: 1,
  },
  lineSolid: {
    backgroundColor: '#007AFF', // Solid Blue for Ride
  },
  lineDashed: {
    backgroundColor: '#C7C7CC', // Gray for walk
    borderStyle: 'dashed',
  },
  contentContainer: {
    flex: 1,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  instruction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: 'System',
    marginBottom: 4,
  },
  duration: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'System',
    fontWeight: '500',
  }
});
