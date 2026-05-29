import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RouteList({ steps, isDarkMode, activeStepIndex = -1 }) {
  if (!steps || steps.length === 0) return null;

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isActive = activeStepIndex === index;
        const isPast = activeStepIndex > index;
        const isWalk = step.type === 'walk' || step.instruction.toLowerCase().includes('walk');
        
        return (
          <View key={step.id} style={[styles.stepRow, isPast && styles.pastStepRow]}>
            <View style={styles.iconContainer}>
              <View style={[
                styles.iconBubble, 
                isWalk ? styles.iconWalk : styles.iconRide,
                isDarkMode && (isWalk ? styles.iconWalkDark : styles.iconRideDark),
                isActive && styles.iconActive
              ]}>
                <Text style={styles.icon}>{step.icon}</Text>
              </View>
              {index !== steps.length - 1 && (
                <View style={[
                  styles.line, 
                  isWalk ? styles.lineDashed : styles.lineSolid,
                  isDarkMode && isWalk && styles.lineDashedDark
                ]} />
              )}
            </View>
            <View style={[styles.contentContainer, isActive && styles.activeContentContainer]}>
              <Text style={[styles.instruction, isDarkMode && styles.darkInstruction, isActive && styles.activeInstruction, isPast && styles.pastInstruction]}>{step.instruction}</Text>
              <Text style={[styles.duration, isDarkMode && styles.darkDuration, isPast && styles.pastDuration]}>~{step.duration} mins</Text>
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
  iconWalkDark: {
    backgroundColor: '#2C2C2E',
  },
  iconRide: {
    backgroundColor: '#E5F1FF',
  },
  iconRideDark: {
    backgroundColor: '#1A2A42', // Dark blue
  },
  iconActive: {
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  icon: {
    fontSize: 18,
  },
  line: {
    width: 4,
    flex: 1,
    marginTop: -2,
    marginBottom: -2,
    zIndex: 1,
    borderRadius: 2,
  },
  lineSolid: {
    backgroundColor: '#007AFF', // Solid Blue for Ride
  },
  lineDashed: {
    backgroundColor: '#C7C7CC', // Gray for walk
  },
  lineDashedDark: {
    backgroundColor: '#3A3A3C',
  },
  contentContainer: {
    flex: 1,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  instruction: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: 'System',
    marginBottom: 4,
  },
  darkInstruction: {
    color: '#FFFFFF',
  },
  duration: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'System',
    fontWeight: '600',
  },
  darkDuration: {
    color: '#98989D',
  },
  activeContentContainer: {
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    paddingLeft: 12,
    marginLeft: -15, // offset padding to align visually
  },
  activeInstruction: {
    color: '#007AFF',
    fontWeight: '800',
  },
  pastStepRow: {
    opacity: 0.5,
  },
  pastInstruction: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
  },
  pastDuration: {
    textDecorationLine: 'line-through',
  }
});
