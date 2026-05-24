import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';

export default function ReportModal({ visible, onClose, onReport, incidents = [], isDarkMode }) {
  const isDark = !!isDarkMode;
  const incidentsList = [
    { id: 'jeep', label: 'Jeepney' },
    { id: 'bus', label: 'Bus' },
    { id: 'carousel', label: 'EDSA Carousel' },
    { id: 'tricycle', label: 'Tricycle' },
    { id: 'uv', label: 'UV Express' },
    { id: 'train', label: 'Train/MRT' },
  ];

  const [selectedType, setSelectedType] = useState(null);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSave = () => {
    if (!selectedType || !origin.trim()) return;
    
    const origStr = origin.trim();
    const destStr = destination.trim();
    
    const proceed = () => {
      const routeStr = destStr ? `${origStr} ⇄ ${destStr}` : origStr;

      const origExists = incidents.some(t => t.category === selectedType.id && t.route && t.route.toLowerCase().includes(origStr.toLowerCase()));
      const destExists = destStr ? incidents.some(t => t.category === selectedType.id && t.route && t.route.toLowerCase().includes(destStr.toLowerCase())) : true;

      const missing = [];
      if (!origExists) missing.push({ name: origStr, route: routeStr, category: selectedType.id });
      if (!destExists && destStr) missing.push({ name: destStr, route: routeStr, category: selectedType.id });

      onReport({
        missingTerminals: missing,
        routeStr: routeStr,
        category: selectedType.id
      });
      
      setSelectedType(null);
      setOrigin('');
      setDestination('');
      onClose();
    };

    if (!destStr) {
      Alert.alert(
        "No Destination",
        "You haven't specified a destination terminal. Are you sure you want to continue?",
        [
          { text: "No", style: "cancel" },
          { text: "Yes", onPress: proceed }
        ]
      );
    } else {
      proceed();
    }
  };

  if (!visible) return null;

  const isSaveDisabled = !selectedType || !origin.trim();

  return (
    <KeyboardAvoidingView 
      style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      pointerEvents="box-none"
    >
      <View style={styles.centeredView}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => {
            Alert.alert("Cancel Pinning?", "Are you sure you want to cancel adding a terminal?", [
              { text: "No", style: "cancel" },
              { text: "Yes", onPress: () => {
                setSelectedType(null);
                setOrigin('');
                setDestination('');
                onClose();
              }}
            ]);
        }} />

        <View style={[styles.modalView, isDark && styles.darkModalView]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalTitle, isDark && styles.darkModalTitle]}>Pin New Terminal</Text>
            <Text style={[styles.modalSubtitle, isDark && styles.darkModalSubtitle]}>Enter details to pin or update a terminal</Text>

          <View style={styles.grid}>
            {incidentsList.map((incident) => (
              <TouchableOpacity
                key={incident.id}
                style={[
                  styles.gridItem,
                  isDark && styles.darkGridItem,
                  selectedType?.id === incident.id && styles.gridItemActive,
                  selectedType?.id === incident.id && isDark && styles.darkGridItemActive
                ]}
                onPress={() => setSelectedType(incident)}
              >
                <Text style={[
                  styles.label,
                  isDark && styles.darkLabel,
                  selectedType?.id === incident.id && styles.labelActive
                ]}>
                  {incident.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedType && (
            <View style={styles.inputsContainer}>
              <TextInput
                style={[styles.routeInput, isDark && styles.darkRouteInput]}
                placeholder="Route Origin (e.g. SM North)"
                placeholderTextColor="#8E8E93"
                value={origin}
                onChangeText={setOrigin}
              />
              <TextInput
                style={[styles.routeInput, isDark && styles.darkRouteInput]}
                placeholder="Route Destination (e.g. Project 6)"
                placeholderTextColor="#8E8E93"
                value={destination}
                onChangeText={setDestination}
              />

              <TouchableOpacity style={[styles.swapBtn, isDark && styles.darkSwapBtn]} onPress={handleSwap} activeOpacity={0.7}>
                <Text style={[styles.swapIcon, isDark && styles.darkText]}>⇅</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.saveButton, isSaveDisabled && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={isSaveDisabled}
          >
            <Text style={styles.saveButtonText}>Save Route</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.closeButton, isDark && styles.darkCloseButton]} onPress={() => {
            setSelectedType(null);
            setOrigin('');
            setDestination('');
            onClose();
          }}>
            <Text style={[styles.closeButtonText, isDark && styles.darkCloseButtonText]}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalView: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
    fontFamily: 'System',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
    fontFamily: 'System',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'center',
    height: 60,
  },
  gridItemActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
    textAlign: 'center',
    fontFamily: 'System',
  },
  labelActive: {
    color: '#FFFFFF',
  },
  inputsContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  routeInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'System',
  },
  swapBtn: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -18,
    backgroundColor: '#F2F2F7',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    zIndex: 10,
  },
  swapIcon: {
    fontSize: 16,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    marginBottom: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#A1C6F8',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  closeButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: 'System',
  },
  darkModalView: {
    backgroundColor: '#1C1C1E',
  },
  darkModalTitle: {
    color: '#FFFFFF',
  },
  darkModalSubtitle: {
    color: '#8E8E93',
  },
  darkGridItem: {
    backgroundColor: '#2C2C2E',
  },
  darkGridItemActive: {
    backgroundColor: '#0A84FF',
  },
  darkLabel: {
    color: '#E5E5EA',
  },
  darkRouteInput: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
    color: '#FFFFFF',
  },
  darkSwapBtn: {
    backgroundColor: '#3A3A3C',
    borderColor: '#48484A',
  },
  darkText: {
    color: '#FFFFFF',
  },
  darkCloseButton: {
    backgroundColor: '#2C2C2E',
  },
  darkCloseButtonText: {
    color: '#8E8E93',
  },
});
