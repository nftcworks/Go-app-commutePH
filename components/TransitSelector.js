import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export const MODES = [
  { id: 'uv', label: 'UV Express', multiplier: 1.0, icon: '🚐' },
  { id: 'jeep', label: 'Jeepney', multiplier: 1.4, icon: '🚙' }, // Slower
  { id: 'trike', label: 'Tricycle', multiplier: 1.8, icon: '🛺' }, // Slowest
  { id: 'bus', label: 'Bus', multiplier: 1.2, icon: '🚌' },
  { id: 'train', label: 'Train', multiplier: 0.6, icon: '🚆' }, // Fastest
];

export default function TransitSelector({ selectedMode, onSelectMode }) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {MODES.map((mode) => {
          const isSelected = selectedMode.id === mode.id;
          return (
            <TouchableOpacity
              key={mode.id}
              style={[styles.pill, isSelected && styles.pillSelected]}
              onPress={() => onSelectMode(mode)}
              activeOpacity={0.8}
            >
              <Text style={styles.icon}>{mode.icon}</Text>
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  pillSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  icon: {
    fontSize: 16,
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
    fontFamily: 'System',
  },
  labelSelected: {
    color: '#FFFFFF',
  },
});
