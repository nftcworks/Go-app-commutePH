import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';

export default function FareModal({ visible, onClose, onSubmit, suggestedFare = 0, isDarkMode }) {
  const [fare, setFare] = useState('');
  const isDark = !!isDarkMode;

  const handleQuickFare = (amount) => {
    onSubmit(amount);
    setFare('');
    onClose();
  };

  const handleSubmit = () => {
    if (fare) {
      onSubmit(parseFloat(fare));
      setFare('');
      onClose();
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.absolute}>
        <View style={[styles.alertBox, isDark && styles.darkAlertBox]}>
          <Text style={[styles.title, isDark && styles.darkTitle]}>Commute Ended</Text>
          <Text style={[styles.message, isDark && styles.darkMessage]}>How much did you pay for this ride?</Text>
          
          <View style={styles.quickRow}>
            {(suggestedFare > 0 ? [suggestedFare, suggestedFare + 5, suggestedFare + 10, suggestedFare + 20] : [13, 15, 20, 30]).map((amt) => (
              <TouchableOpacity key={amt} style={[styles.quickBtn, isDark && styles.darkQuickBtn, suggestedFare === amt && styles.suggestedBtn]} onPress={() => handleQuickFare(amt)}>
                <Text style={[styles.quickText, isDark && styles.darkQuickText, suggestedFare === amt && styles.suggestedText]}>₱{amt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, isDark && styles.darkInput]}
            placeholder="Custom Amount (₱)"
            placeholderTextColor="#8E8E93"
            keyboardType="numeric"
            value={fare}
            onChangeText={setFare}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={[styles.cancelText, isDark && styles.darkCancelText]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>Save Fare</Text>
            </TouchableOpacity>
          </View>
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
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#3A3A3C',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickBtn: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  quickText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginLeft: 12,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  suggestedBtn: {
    backgroundColor: '#007AFF',
  },
  suggestedText: {
    color: '#FFFFFF',
  },
  darkAlertBox: {
    backgroundColor: '#1C1C1E',
  },
  darkTitle: {
    color: '#FFFFFF',
  },
  darkMessage: {
    color: '#8E8E93',
  },
  darkQuickBtn: {
    backgroundColor: '#2C2C2E',
  },
  darkQuickText: {
    color: '#0A84FF',
  },
  darkInput: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
    color: '#FFFFFF',
  },
  darkCancelText: {
    color: '#8E8E93',
  },
});
