import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform, Image, SafeAreaView, Modal, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../hooks/useAuth';

export default function AuthScreen({ isDarkMode }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  
  // Validation States
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  
  // Modals
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const handleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsAuthLoading(true);
    await signInWithGoogle();
    setIsAuthLoading(false);
  };

  const handleEmailAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Clear previous errors
    setPasswordError('');
    setConfirmError('');
    
    if (!email || !password) {
      setErrorModalMessage('Please enter both email and password.');
      setShowErrorModal(true);
      return;
    }
    
    if (authMode === 'register') {
      if (!nickname) {
        setErrorModalMessage('Please enter a nickname.');
        setShowErrorModal(true);
        return;
      }
      if (password.length < 6) {
        setPasswordError('Password is too short or weak. Minimum 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setConfirmError('Passwords do not match.');
        return;
      }
    }

    setIsAuthLoading(true);
    let result;
    if (authMode === 'login') {
      result = await signInWithEmail(email, password);
    } else {
      result = await signUpWithEmail(email, password, nickname);
      if (result.data?.user && !result.data?.session) {
        setShowSuccessModal(true);
      }
    }
    
    if (result.error) {
      setErrorModalMessage(result.error.message);
      setShowErrorModal(true);
    }
    setIsAuthLoading(false);
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
      <KeyboardAwareScrollView 
        style={styles.keyboardView}
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid={true}
        extraScrollHeight={50}
        extraHeight={150}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/854/854878.png' }} 
            style={[styles.logoIcon, isDarkMode && { tintColor: '#FFFFFF' }]} 
          />
          <View style={styles.titleRow}>
            <Text style={[styles.title, isDarkMode && styles.darkText]}>Go Commute PH</Text>
            <View style={styles.betaTag}>
              <Text style={styles.betaTagText}>BETA</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Find the fastest routes. Avoid the traffic.
          </Text>
        </View>

        <View style={styles.actionContainer}>
          {!showEmailForm ? (
            <>
              <TouchableOpacity style={styles.googleBtn} onPress={handleSignIn} disabled={isAuthLoading}>
                <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/300/300221.png' }} style={styles.googleIcon} />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.emailToggleBtn} onPress={() => setShowEmailForm(true)}>
                <Text style={styles.emailToggleText}>Or continue with Email</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emailForm}>
              <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => {
                  setAuthMode('login');
                  setPasswordError('');
                  setConfirmError('');
                }}>
                  <Text style={[styles.tabText, authMode === 'login' && styles.activeTabText, authMode === 'login' && isDarkMode && styles.darkText]}>Log In</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setAuthMode('register');
                  setPasswordError('');
                  setConfirmError('');
                }}>
                  <Text style={[styles.tabText, authMode === 'register' && styles.activeTabText, authMode === 'register' && isDarkMode && styles.darkText]}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {authMode === 'register' && (
                <TextInput
                  style={[styles.input, isDarkMode && styles.darkInput]}
                  placeholder="Nickname"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  value={nickname}
                  onChangeText={setNickname}
                  autoCapitalize="words"
                />
              )}

              <TextInput
                style={[styles.input, isDarkMode && styles.darkInput]}
                placeholder="Email"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              
              <View>
                <TextInput
                  style={[
                    styles.input, 
                    isDarkMode && styles.darkInput,
                    passwordError ? styles.inputError : null
                  ]}
                  placeholder="Password"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError('');
                  }}
                  secureTextEntry
                />
                {!!passwordError && (
                  <Text style={styles.errorInlineText}>{passwordError}</Text>
                )}
              </View>

              {authMode === 'register' && (
                <View>
                  <TextInput
                    style={[
                      styles.input, 
                      isDarkMode && styles.darkInput,
                      confirmError ? styles.inputError : null
                    ]}
                    placeholder="Confirm Password"
                    placeholderTextColor={isDarkMode ? '#666' : '#999'}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (confirmError) setConfirmError('');
                    }}
                    secureTextEntry
                  />
                  {!!confirmError && (
                    <Text style={styles.errorInlineText}>{confirmError}</Text>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.submitBtn} onPress={handleEmailAuth} disabled={isAuthLoading}>
                {isAuthLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>{authMode === 'login' ? 'Log In' : 'Sign Up'}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[styles.line, isDarkMode && styles.darkLine]} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={[styles.line, isDarkMode && styles.darkLine]} />
              </View>

              <TouchableOpacity style={styles.googleBtn} onPress={handleSignIn} disabled={isAuthLoading}>
                <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/300/300221.png' }} style={styles.googleIcon} />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Beautiful Success Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={() => setShowSuccessModal(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkModalContent]}>
            <View style={styles.modalIconContainer}>
              <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3178/3178158.png' }} 
                style={styles.modalIcon} 
              />
            </View>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Check Your Email</Text>
            <Text style={styles.modalText}>
              We've sent a secure confirmation link to <Text style={{fontWeight: '700'}}>{email}</Text>. Please tap the link to activate your account!
            </Text>
            <Text style={[styles.modalSubText, isDarkMode && styles.darkSubText]}>
              (Don't forget to check your spam folder)
            </Text>
            <TouchableOpacity 
              style={styles.modalBtn} 
              onPress={() => {
                setShowSuccessModal(false);
                setAuthMode('login');
              }}
            >
              <Text style={styles.modalBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Beautiful Error Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showErrorModal}
        onRequestClose={() => setShowErrorModal(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkModalContent]}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#FFEBEE' }]}>
              <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1828/1828843.png' }} 
                style={[styles.modalIcon, { tintColor: '#FF3B30' }]} 
              />
            </View>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Authentication Error</Text>
            <Text style={styles.modalText}>
              {errorModalMessage}
            </Text>
            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: '#FF3B30', marginTop: 16 }]} 
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.modalBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  darkContainer: {
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  actionContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
  },
  logoIcon: {
    width: 64,
    height: 64,
    marginBottom: 24,
    tintColor: '#000000',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  betaTag: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
    transform: [{ translateY: -2 }],
  },
  betaTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  darkText: {
    color: '#FFFFFF',
  },
  actionContainer: {
    width: '100%',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 18,
    borderRadius: 30,
    marginBottom: 24,
  },
  googleIcon: {
    width: 22,
    height: 22,
    marginRight: 12,
  },
  googleBtnText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
  },
  emailToggleBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emailToggleText: {
    color: '#666666',
    fontSize: 15,
    fontWeight: '500',
  },
  emailForm: {
    marginTop: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999999',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '700',
  },
  input: {
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 24,
    color: '#000000',
  },
  darkInput: {
    borderColor: '#333333',
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: '#000000',
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  darkLine: {
    backgroundColor: '#333333',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999999',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  darkModalContent: {
    backgroundColor: '#1C1C1E',
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F4FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIcon: {
    width: 40,
    height: 40,
    tintColor: '#007AFF',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  modalSubText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 32,
  },
  modalBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 24,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 1.5,
  },
  errorInlineText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '500',
    marginTop: -10,
    marginBottom: 16,
    marginLeft: 4,
  },
});
