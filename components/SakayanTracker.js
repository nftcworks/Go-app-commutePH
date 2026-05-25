import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Platform,
  ScrollView,
  LayoutAnimation,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Animated,
  PanResponder,
  Dimensions,
  useColorScheme,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { saveBoardingLog, saveCommuteHistory, getCommuteHistory, getAverageCommuteTime } from '../utils/storage';
import ReportModal from './ReportModal';
import RouteList from './RouteList';
import SearchBar from './SearchBar';
import FareModal from './FareModal';
import { calculateFare } from '../utils/fareCalculation';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SNAP_COLLAPSED = 80;
const SNAP_HALF = 360;
const SNAP_FULL = SCREEN_HEIGHT * 0.85;
const SAVED_PLACES_KEY = '@saved_places_v1';

export default function SakayanTracker({ currentLocation, customOrigin, selectedTerminal, onCloseTerminal, onRemoveTerminal, onDrawRoute, onOriginSelect, etaInfo, routeOptions, selectedRouteIndex, onSelectRoute, onLocationSelect, onReportIncident, onCancelRoute, onRideStateChange, onPinTerminal, onEtaUpdate, isMapTapped, destination, isDarkMode, onSheetSnapChange, recenterMap, showPinButton, onDeleteCustomRoute }) {
  const [isRiding, setIsRiding] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [searchTarget, setSearchTarget] = useState(null); // 'origin' | 'destination'
  const [editEtaVisible, setEditEtaVisible] = useState(false);
  const [manualMins, setManualMins] = useState('');
  const [rideStartTime, setRideStartTime] = useState(null);
  const [commuteHistory, setCommuteHistory] = useState([]);
  const [avgTime, setAvgTime] = useState(null);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  
  const colorScheme = useColorScheme();
  const isDark = typeof isDarkMode === 'boolean' ? isDarkMode : colorScheme === 'dark';

  // Dynamic collapse height
  // 320px fits ETA header + Leave Now button, 168px fits search dock when idle
  const getSnapCollapsed = () => (selectedTerminal ? 320 : (etaInfo ? 320 : 168));

  // Draggable sheet
  const initialSnap = etaInfo ? SNAP_HALF : getSnapCollapsed();
  const sheetHeight = useRef(new Animated.Value(initialSnap)).current;
  const lastSnap = useRef(initialSnap);
  const [sheetSnap, setSheetSnap] = useState(initialSnap);

  const snapTo = useCallback((val) => {
    lastSnap.current = val;
    setSheetSnap(val);
    if (onSheetSnapChange) onSheetSnapChange(val);
    Animated.spring(sheetHeight, {
      toValue: val,
      useNativeDriver: false,
      bounciness: 4,
      speed: 14,
    }).start();
  }, [sheetHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        const newHeight = lastSnap.current - gestureState.dy;
        const clamped = Math.max(getSnapCollapsed(), Math.min(SNAP_FULL, newHeight));
        sheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const current = lastSnap.current - gestureState.dy;
        const velocity = gestureState.vy;

        if (velocity > 1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          snapTo(getSnapCollapsed());
        } else if (velocity < -1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          snapTo(SNAP_FULL);
        } else {
          const sc = getSnapCollapsed();
          const dists = [
            { snap: sc, d: Math.abs(current - sc) },
            { snap: SNAP_HALF, d: Math.abs(current - SNAP_HALF) },
            { snap: SNAP_FULL, d: Math.abs(current - SNAP_FULL) },
          ];
          dists.sort((a, b) => a.d - b.d);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          snapTo(dists[0].snap);
        }
      },
    })
  ).current;

  // Floating button animations
  const floatingOpacity = sheetHeight.interpolate({
    inputRange: [getSnapCollapsed(), SNAP_HALF, SNAP_FULL - 100, SNAP_FULL],
    outputRange: [1, 1, 0, 0],
    extrapolate: 'clamp',
  });

  const recenterBottom = Animated.add(sheetHeight, new Animated.Value(16));
  const pinBottom = Animated.add(sheetHeight, new Animated.Value(80));

  // Collapse when map is tapped
  useEffect(() => {
    if (isMapTapped) {
      snapTo(getSnapCollapsed());
    }
  }, [isMapTapped]);

  // Expand when route selected
  useEffect(() => {
    if (selectedTerminal) {
      snapTo(SNAP_HALF);
    } else if (etaInfo) {
      snapTo(SNAP_HALF);
    } else {
      snapTo(getSnapCollapsed());
    }
  }, [selectedTerminal, etaInfo]);

  useEffect(() => {
    if (onSheetSnapChange) onSheetSnapChange(initialSnap);
  }, []);

  useEffect(() => {
    getCommuteHistory().then(setCommuteHistory);
    AsyncStorage.getItem(SAVED_PLACES_KEY).then(data => {
      if (data) setSavedPlaces(JSON.parse(data));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@search_history').then(data => {
      if (data) setSearchHistory(JSON.parse(data));
    });
  }, [searchTarget]);

  useEffect(() => {
    if (etaInfo && etaInfo.destinationName) {
      getAverageCommuteTime(etaInfo.destinationName).then(setAvgTime);
    } else {
      setAvgTime(null);
    }
  }, [etaInfo?.destinationName]);

  const handleToggleRide = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newState = !isRiding;
    setIsRiding(newState);
    if (onRideStateChange) onRideStateChange(newState);
    if (!newState) {
      setReportVisible(true);
    } else {
      setRideStartTime(Date.now());
      saveBoardingLog({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        timestamp: new Date().toISOString(),
        status: 'BOARDING',
      });
    }
  };

  const handleSaveCustomEta = async () => {
    if (!manualMins || isNaN(manualMins)) {
      setEditEtaVisible(false);
      return;
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.setItem(`@custom_eta_${etaInfo ? etaInfo.destinationName : 'route'}`, manualMins);
      if (onEtaUpdate && etaInfo) {
        onEtaUpdate({ ...etaInfo, duration: parseInt(manualMins, 10) * 60, isCustom: true });
      }
    } catch(e) {}
    setEditEtaVisible(false);
  };

  const handleSavePlace = async (type) => {
    // type: 'home', 'work', or 'new'
    if (type === 'new') {
      setSearchTarget('destination');
      return;
    }
    const existing = savedPlaces.find(p => p.type === type);
    if (existing) {
      // Navigate to it
      onLocationSelect({ latitude: existing.latitude, longitude: existing.longitude, name: existing.name });
      return;
    }
    // No saved place yet — open search to save one
    setSearchTarget('destination');
  };

  const routeSteps = routeOptions && routeOptions.length > 0 ? routeOptions[selectedRouteIndex]?.steps : null;

  let mainRideMode = 'Jeepney';
  if (routeSteps) {
    const rideStep = routeSteps.find(s => s.type === 'ride');
    if (rideStep && rideStep.instruction) {
      if (rideStep.instruction.includes('Train') || rideStep.instruction.includes('LRT') || rideStep.instruction.includes('MRT')) mainRideMode = 'Train';
      else if (rideStep.instruction.includes('UV')) mainRideMode = 'UV';
      else if (rideStep.instruction.includes('Bus')) mainRideMode = 'Bus';
    }
  }
  const suggestedFare = etaInfo && etaInfo.distance ? calculateFare(etaInfo.distance, mainRideMode) : 0;

  const showHomeDock = !isRiding && !etaInfo && !selectedTerminal && sheetSnap !== SNAP_FULL;
  const showExpandedHomeContent = !isRiding && !etaInfo && !selectedTerminal && sheetSnap === SNAP_FULL;

  const getTerminalName = (route) => {
    if (!route) return 'Terminal';
    const parts = route.split(' ⇄ ');
    return parts[0] ? parts[0].trim() : 'Terminal';
  };

  const getDisplayTitle = (terminal) => {
    if (!terminal) return '';
    const defaultLabels = ['Jeepney', 'Tricycle', 'UV Express', 'Bus', 'EDSA Carousel', 'Train/MRT'];
    if (terminal.label && !defaultLabels.includes(terminal.label)) {
      return terminal.label;
    }
    return getTerminalName(terminal.route);
  };

  const getTerminalDestinations = (route) => {
    if (!route) return [];
    const parts = route.split(' ⇄ ');
    if (parts.length > 1) return parts[1].split(',').map(s => s.trim());
    return [];
  };

  return (
    <View 
      style={[styles.overlay, !!searchTarget && styles.overlayFullScreen]} 
      pointerEvents="box-none"
    >
      
      {/* Native Floating Buttons - automatically track sheet height and fade out on expand */}
      {!isRiding && (
        <Animated.View style={[styles.recenterContainer, { bottom: recenterBottom, opacity: floatingOpacity }]}>
          <TouchableOpacity onPress={recenterMap} activeOpacity={0.7} hitSlop={10}>
            <View style={[styles.devGearBlur, isDark && styles.darkDevGearBlur, { padding: 12 }]}>
              <MaterialIcons name="my-location" size={26} color={isDark ? '#0A84FF' : '#007AFF'} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {!isRiding && showPinButton && (
        <Animated.View style={[styles.floatingPinContainer, { bottom: pinBottom, opacity: floatingOpacity }]}>
          <TouchableOpacity onPress={onPinTerminal} activeOpacity={0.8} hitSlop={10}>
            <View style={styles.wazeReportFab}>
              <View style={styles.pinGlyphOuter}>
                <View style={styles.pinGlyphInner} />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Draggable Bottom Sheet */}
      {!searchTarget && (
        <Animated.View style={[styles.bottomSheet, isDark && styles.darkBottomSheet, { height: sheetHeight }]} pointerEvents="auto">
          
          {/* Draggable Grabber */}
          <View {...panResponder.panHandlers} style={styles.grabberHitArea}>
            <View style={[styles.grabber, isDark && styles.darkGrabber]} />
          </View>

          {/* Waze-style Sticky Header for Active Route */}
          {etaInfo && !selectedTerminal && (
            <View style={[styles.stickyRouteHeader, isDark && styles.darkStickyRouteHeader]}>
              <View style={styles.stickyHeaderRow}>
                <View style={styles.stickyHeaderLeft}>
                  <View style={styles.etaRow}>
                    <Text style={[styles.etaText, isDark && styles.darkEtaText, isRiding && styles.commuteEtaText]}>
                      {Math.round(etaInfo.duration / 60)} min
                    </Text>
                    {!isRiding && (
                      <TouchableOpacity 
                        style={[styles.editEtaBtn, isDark && styles.darkEditEtaBtn]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setManualMins(Math.round(etaInfo.duration / 60).toString());
                          setEditEtaVisible(true);
                        }}
                        hitSlop={8}
                      >
                        <Text style={[styles.editEtaText, isDark && styles.darkEditEtaText]}>✎</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.distanceText, isDark && styles.darkDistanceText]}>
                    {etaInfo.distance} km • ₱{suggestedFare}
                    {avgTime ? ` • Avg: ${avgTime}m` : ''}
                  </Text>
                  <Text style={[styles.destinationTitle, isDark && styles.darkDestinationTitle]} numberOfLines={1}>To: {etaInfo.destinationName}</Text>
                </View>
                {!isRiding && (
                  <TouchableOpacity style={[styles.minimalCancelBtn, isDark && styles.darkMinimalCancelBtn]} onPress={() => {
                    Haptics.selectionAsync();
                    onCancelRoute();
                  }}>
                    <Text style={[styles.minimalCancelIcon, isDark && styles.darkMinimalCancelIcon]}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Sticky Action Button */}
              <TouchableOpacity 
                style={[styles.actionButton, isRiding ? styles.buttonStop : styles.buttonStart]} 
                onPress={handleToggleRide}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>
                  {isRiding ? 'End Commute' : 'Leave Now'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Sticky Search Bar when no active route */}
          {showExpandedHomeContent && (
            <View style={[styles.searchRow, isDark && styles.darkSearchRow, { paddingHorizontal: 20, paddingTop: 10, flexDirection: 'column', gap: 12 }]}>
              <TouchableOpacity 
                style={[styles.fakeSearchBar, isDark && styles.darkFakeSearchBar, { flex: 0, width: '100%', flexDirection: 'row', alignItems: 'center' }]} 
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchTarget('origin');
                }}
              >
                <Text style={[styles.fakeSearchText, isDark && styles.darkText, customOrigin && styles.activeSearchText]} numberOfLines={1}>
                  {customOrigin ? customOrigin.name : 'Current Location'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.fakeSearchBar, isDark && styles.darkFakeSearchBar, { flex: 0, width: '100%', flexDirection: 'row', alignItems: 'center' }]} 
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchTarget('destination');
                }}
              >
                <Text style={[styles.fakeSearchText, isDark && styles.darkText]} numberOfLines={1}>Where to?</Text>
              </TouchableOpacity>
            </View>
          )}

          {showHomeDock && (
            <View style={[styles.homeDock, isDark && styles.darkHomeDock]}>
              <TouchableOpacity 
                style={[styles.fakeSearchBar, isDark && styles.darkFakeSearchBar, styles.homeDockSearch, { flexDirection: 'row', alignItems: 'center' }]} 
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchTarget('destination');
                }}
                hitSlop={8}
              >
                <Text style={[styles.fakeSearchText, isDark && styles.darkText]}>Where to?</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Terminal Details Card */}
          {selectedTerminal && (
            <View style={[styles.terminalCard, isDark && styles.darkTerminalCard]}>
              <View style={styles.terminalHeaderRow}>
                <View style={[styles.terminalIconBox, isDark && styles.darkFakeSearchBar]}>
                  <Text style={styles.terminalIconEmoji}>
                    {selectedTerminal.category === 'jeep' ? '🚙' :
                     selectedTerminal.category === 'tricycle' ? '🛺' :
                     selectedTerminal.category === 'uv' ? '🚐' :
                     selectedTerminal.category === 'bus' ? '🚌' :
                     selectedTerminal.category === 'carousel' ? '🚌' :
                     selectedTerminal.category === 'train' ? '🚆' : '📍'}
                  </Text>
                </View>
                <View style={styles.terminalHeaderInfo}>
                  <Text style={[styles.terminalCardTitle, isDark && styles.darkText]} numberOfLines={1}>
                    {getDisplayTitle(selectedTerminal)}
                  </Text>
                  <Text style={styles.terminalCardSub}>
                    {selectedTerminal.category ? selectedTerminal.category.charAt(0).toUpperCase() + selectedTerminal.category.slice(1) : ''} Terminal
                  </Text>
                </View>
              </View>

              <Text style={[styles.terminalRoutesTitle, isDark && styles.darkDistanceText]}>AVAILABLE ROUTES</Text>
              <ScrollView style={styles.terminalRoutesList} showsVerticalScrollIndicator={false}>
                {getTerminalDestinations(selectedTerminal.route).map((dest, i) => (
                  <View key={i} style={[styles.terminalRouteItem, isDark && styles.darkHistoryItem]}>
                    <Text style={[styles.terminalRouteText, isDark && styles.darkText]}>{dest}</Text>
                  </View>
                ))}
                {getTerminalDestinations(selectedTerminal.route).length === 0 && (
                  <Text style={styles.terminalCardSub}>No routes specified</Text>
                )}
              </ScrollView>

              <View style={styles.terminalActions}>
                <TouchableOpacity style={[styles.terminalBtn, styles.terminalBtnDraw]} onPress={onDrawRoute}>
                  <Text style={styles.terminalBtnDrawText}>🔗 Add Path</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.terminalBtn, styles.terminalBtnClose, isDark && styles.darkTerminalBtnClose]} onPress={onCloseTerminal}>
                  <Text style={[styles.terminalBtnCloseText, isDark && styles.darkTerminalBtnCloseText]}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.terminalBtn, styles.terminalBtnRemove]} onPress={() => onRemoveTerminal(selectedTerminal.id)}>
                  <Text style={styles.terminalBtnRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {(!isRiding && !selectedTerminal) && (
            <ScrollView 
              style={styles.sheetScroll} 
              showsVerticalScrollIndicator={false}
              scrollEnabled={sheetSnap === SNAP_FULL}
              contentContainerStyle={[styles.sheetContent, { paddingTop: 0 }]}
            >
            {/* Saved Places Shortcuts */}
            {!isRiding && !etaInfo && (
              <View style={styles.savedPlacesRow}>
                <TouchableOpacity style={styles.savedPlaceBtn} onPress={() => handleSavePlace('home')}>
                  <View style={[styles.savedPlaceIcon, { backgroundColor: isDark ? '#1C2E21' : '#E8F5E9' }]}>
                    <Text>🏠</Text>
                  </View>
                  <Text style={[styles.savedPlaceLabel, isDark && styles.darkText]}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.savedPlaceBtn} onPress={() => handleSavePlace('work')}>
                  <View style={[styles.savedPlaceIcon, { backgroundColor: isDark ? '#1C2938' : '#E3F2FD' }]}>
                    <Text>💼</Text>
                  </View>
                  <Text style={[styles.savedPlaceLabel, isDark && styles.darkText]}>Work</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.savedPlaceBtn} onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchTarget('destination');
                }}>
                  <View style={[styles.savedPlaceIcon, { backgroundColor: isDark ? '#3A2814' : '#FFF3E0' }]}>
                    <Text>➕</Text>
                  </View>
                  <Text style={[styles.savedPlaceLabel, isDark && styles.darkText]}>New</Text>
                </TouchableOpacity>
              </View>
            )}

            {!etaInfo && !isRiding && (commuteHistory.length > 0 || searchHistory.length > 0) && (
              <View style={[styles.recentHistoryCard, isDark && styles.darkRecentHistoryCard]}>
                <Text style={[styles.recentHistoryTitle, isDark && styles.darkDestinationTitle]}>Recent</Text>
                {commuteHistory.slice(0, 4).map((trip, idx) => {
                  const tripDate = new Date(trip.timestamp);
                  const dateStr = tripDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
                  return (
                    <TouchableOpacity
                      key={`${trip.timestamp}_${idx}`}
                      style={[styles.recentHistoryItem, isDark && styles.darkHistoryItem]}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (trip.destLat && trip.destLng) {
                          onLocationSelect({
                            name: trip.destinationName,
                            latitude: trip.destLat,
                            longitude: trip.destLng,
                          });
                        } else {
                          setSearchTarget('destination');
                        }
                      }}
                    >
                      <View style={{ flex: 1, paddingVertical: 4 }}>
                        <Text style={[styles.historyDest, isDark && styles.darkText]} numberOfLines={1}>
                          {trip.destinationName}
                        </Text>
                        <Text style={[styles.historyMeta, isDark && styles.darkDistanceText]} numberOfLines={1}>
                          {trip.routeTitle} • {trip.durationMins} min • ₱{trip.fare} • {dateStr}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {searchHistory.slice(0, 3).map((item, idx) => {
                  return (
                    <TouchableOpacity
                      key={`search_${item.place_id}_${idx}`}
                      style={[styles.recentHistoryItem, isDark && styles.darkHistoryItem]}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onLocationSelect({
                          name: item.display_name,
                          latitude: parseFloat(item.lat),
                          longitude: parseFloat(item.lon),
                        });
                      }}
                    >
                      <View style={{ flex: 1, paddingVertical: 4 }}>
                        <Text style={[styles.historyDest, isDark && styles.darkText]} numberOfLines={1}>
                          {item.display_name.split(',')[0]}
                        </Text>
                        <Text style={[styles.historyMeta, isDark && styles.darkDistanceText]} numberOfLines={1}>
                          Search History
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Route Tabs (when route is active) */}
            {routeOptions && routeOptions.length > 1 && !isRiding && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.routeTabsContainer}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                {routeOptions.map((option, index) => {
                  const isActive = index === selectedRouteIndex;
                  return (
                    <TouchableOpacity 
                      key={option.id} 
                      style={[styles.routeTab, isActive && styles.routeTabActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (onSelectRoute) onSelectRoute(index);
                      }}
                    >
                      <Text style={[styles.routeTabText, isActive && styles.routeTabTextActive]}>
                        {option.title}
                      </Text>
                      <Text style={[styles.routeTabBadge, isActive && styles.routeTabBadgeActive]}>
                        {option.badge}
                      </Text>
                      {option.isCustom && isActive && (
                        <TouchableOpacity 
                           onPress={(e) => {
                             e.stopPropagation();
                             if (onDeleteCustomRoute) onDeleteCustomRoute(option.routeId, option.terminalId);
                           }}
                           style={{ marginLeft: 8 }}
                           hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MaterialIcons name="delete" size={18} color={isDark ? '#FF453A' : '#FF3B30'} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Sakay.ph Style Route List */}
            {routeSteps && !isRiding && (
              <View style={styles.routeContainer}>
                <RouteList steps={routeSteps} />
              </View>
            )}
            </ScrollView>
          )}
        </Animated.View>
      )}

      <Modal visible={!!searchTarget} animationType="slide" transparent={false}>
        <View style={[styles.searchModalSafeArea, isDark && { backgroundColor: '#000000' }]}>
          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.searchModalHeader, isDark && { backgroundColor: '#1C1C1E' }]}>
              <TouchableOpacity onPress={() => setSearchTarget(null)} hitSlop={10}>
                <Text style={styles.searchModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.searchModalTitle, isDark && styles.darkText]}>
                {searchTarget === 'origin' ? 'Set Starting Point' : 'Search Destination'}
              </Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={[styles.dualSearchHeader, isDark && styles.darkDualSearchHeader]}>
              <View style={styles.trackContainer}>
                <View style={styles.startDot} />
                <View style={styles.trackLine} />
                <View style={styles.destPin} />
              </View>
              <View style={styles.fieldsContainer}>
                {searchTarget === 'origin' ? (
                  <SearchBar 
                    onLocationSelect={(loc) => {
                      onOriginSelect(loc);
                      if (!destination) {
                        setSearchTarget('destination');
                      } else {
                        setSearchTarget(null);
                      }
                    }}
                    placeholder="Search starting point..."
                    isDarkMode={isDark}
                    initialValue={customOrigin ? customOrigin.name : ''}
                    containerStyle={[styles.dualSearchBarOverride, isDark && styles.darkInactiveSearchInput]}
                    inputStyle={styles.dualSearchInputOverride}
                  />
                ) : (
                  <TouchableOpacity 
                    style={[
                      styles.inactiveSearchInput, 
                      isDark && styles.darkInactiveSearchInput,
                      !customOrigin && { paddingVertical: 6 }
                    ]}
                    onPress={() => setSearchTarget('origin')}
                  >
                    {customOrigin ? (
                      <Text style={[styles.inactiveSearchText, isDark && styles.darkText]} numberOfLines={1}>
                        {customOrigin.name}
                      </Text>
                    ) : (
                      <View style={[styles.currentLocationPill, isDark && styles.darkCurrentLocationPill]}>
                        <Text style={[styles.currentLocationPillText, isDark && styles.darkCurrentLocationPillText]}>➤ Current Location</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                <View style={{ height: 10 }} />

                {searchTarget === 'destination' ? (
                  <SearchBar 
                    onLocationSelect={(loc) => {
                      onLocationSelect(loc);
                      setSearchTarget(null);
                    }}
                    placeholder="Where to?"
                    isDarkMode={isDark}
                    initialValue={destination ? destination.name : ''}
                    containerStyle={[styles.dualSearchBarOverride, isDark && styles.darkInactiveSearchInput]}
                    inputStyle={styles.dualSearchInputOverride}
                  />
                ) : (
                  <TouchableOpacity 
                    style={[styles.inactiveSearchInput, isDark && styles.darkInactiveSearchInput]}
                    onPress={() => setSearchTarget('destination')}
                  >
                    <Text style={[styles.inactiveSearchText, isDark && styles.darkText]} numberOfLines={1}>
                      {destination ? destination.name : 'Where to?'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
              <View style={[styles.searchModalContent, isDark && styles.darkSearchModalContent]}>
                {searchTarget === 'origin' && (
                  <TouchableOpacity 
                    style={[styles.currentLocationBtn, isDark && styles.darkCurrentLocationBtn]}
                    onPress={() => {
                      onOriginSelect(null);
                      if (!destination) {
                        setSearchTarget('destination');
                      } else {
                        setSearchTarget(null);
                      }
                    }}
                  >
                    <View style={styles.currentLocIconBox}>
                      <Text style={styles.currentLocIcon}>📍</Text>
                    </View>
                    <View>
                      <Text style={[styles.currentLocTitle, isDark && styles.darkText]}>Use GPS Current Location</Text>
                      <Text style={styles.currentLocSub}>Or type location manually above</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      
      <FareModal 
        visible={reportVisible} 
        onClose={() => setReportVisible(false)} 
        suggestedFare={suggestedFare}
        isDarkMode={isDark}
        onSubmit={async (fare) => {
          const actualMins = rideStartTime ? Math.round((Date.now() - rideStartTime) / 60000) : (etaInfo ? Math.round(etaInfo.duration / 60) : 0);
          const selectedRoute = routeOptions && routeOptions[selectedRouteIndex] ? routeOptions[selectedRouteIndex] : null;
          await saveCommuteHistory({
            destinationName: etaInfo ? etaInfo.destinationName : 'Unknown',
            destLat: destination ? destination.latitude : 0,
            destLng: destination ? destination.longitude : 0,
            distance: etaInfo ? etaInfo.distance : 0,
            durationMins: actualMins,
            fare: fare,
            routeTitle: selectedRoute ? selectedRoute.title : 'Route',
            timestamp: new Date().toISOString(),
          });
          const updated = await getCommuteHistory();
          setCommuteHistory(updated);
          setRideStartTime(null);
          setReportVisible(false);
          if (onCancelRoute) onCancelRoute();
        }}
      />

      {/* Manual ETA Modal */}
      <Modal visible={editEtaVisible} transparent animationType="fade">
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.etaModalCard}>
              <Text style={styles.etaModalTitle}>Set Custom ETA</Text>
              <Text style={styles.etaModalDesc}>How many minutes does this usually take?</Text>
              <TextInput
                style={styles.etaInput}
                placeholder="e.g. 50"
                keyboardType="number-pad"
                value={manualMins}
                onChangeText={setManualMins}
                autoFocus
              />
              <View style={styles.etaModalActions}>
                <TouchableOpacity style={styles.etaModalBtn} onPress={() => setEditEtaVisible(false)}>
                  <Text style={styles.etaModalCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.etaModalBtnPrimary} onPress={handleSaveCustomEta}>
                  <Text style={styles.etaModalSave}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // --- Dark Mode Overrides ---
  darkBottomSheet: {
    backgroundColor: '#1C1C1E',
  },
  darkGrabber: {
    backgroundColor: '#3A3A3C',
  },
  darkSearchRow: {
    backgroundColor: '#1C1C1E',
  },
  darkFakeSearchBar: {
    backgroundColor: '#2C2C2E',
  },
  darkText: {
    color: '#FFFFFF',
  },
  darkStickyRouteHeader: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#2C2C2E',
  },
  darkEtaText: {
    color: '#0A84FF',
  },
  darkDistanceText: {
    color: '#8E8E93',
  },
  darkDestinationTitle: {
    color: '#636366',
  },
  darkMinimalCancelBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  darkMinimalCancelIcon: {
    color: '#FF453A',
  },
  darkHistoryItem: {
    borderBottomColor: '#2C2C2E',
  },
  darkTerminalBtnClose: {
    backgroundColor: '#3A3A3C',
  },
  darkTerminalBtnCloseText: {
    color: '#FFFFFF',
  },
  // --- Standard Styles ---
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 30,
    width: '100%',
  },
  grabberHitArea: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D1D1D6',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  homeDock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 8,
  },
  darkHomeDock: {
    backgroundColor: '#1C1C1E',
  },
  fakeSearchBar: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
  },
  homeDockSearch: {
    flex: 1,
    minHeight: 56,
    justifyContent: 'flex-start',
    paddingLeft: 18,
  },
  fakeSearchText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
  },
  searchIconPrefix: {
    fontSize: 18,
    marginRight: 10,
    color: '#8E8E93',
  },
  startIconPrefix: {
    fontSize: 14,
    marginRight: 10,
    color: '#34C759',
  },
  activeSearchText: {
    color: '#007AFF',
  },
  inlinePinBtn: {
    backgroundColor: '#FFCC00',
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  inlinePinIcon: {
    fontSize: 24,
  },
  savedPlacesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  savedPlaceBtn: {
    alignItems: 'center',
    minWidth: 72,
  },
  savedPlaceIcon: {
    width: 56,
    height: 56,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  savedPlaceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  routeTabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    marginHorizontal: -20, // Negative margin to stretch to edges, fading out pills correctly
  },
  routeTab: {
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minHeight: 44,
  },
  routeTabActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  routeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
    marginRight: 6,
  },
  routeTabTextActive: {
    color: '#FFFFFF',
  },
  routeTabBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  routeTabBadgeActive: {
    color: '#007AFF',
    backgroundColor: '#FFFFFF',
  },
  routeContainer: {
    marginBottom: 8,
  },
  stickyRouteHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    marginBottom: 16,
  },
  stickyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stickyHeaderLeft: {
    flex: 1,
  },
  minimalCancelBtn: {
    backgroundColor: '#FEECEB',
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimalCancelIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF3B30',
  },
  destinationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  etaText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#007AFF',
    fontFamily: 'System',
    lineHeight: 38,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editEtaBtn: {
    marginLeft: 6,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkEditEtaBtn: {
    // minimalist, no background
  },
  editEtaText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  darkEditEtaText: {
    color: '#8E8E93',
  },
  commuteEtaText: {
    color: '#34C759',
  },
  distanceText: {
    fontSize: 15,
    color: '#3A3A3C',
    fontWeight: '500',
    marginTop: 2,
  },
  actionButton: {
    width: '100%',
    minHeight: 58,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonStart: {
    backgroundColor: '#007AFF',
  },
  buttonStop: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    fontFamily: 'System',
  },
  searchModalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  searchModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  searchModalContent: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  etaModalCard: {
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
  etaModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  etaModalDesc: {
    fontSize: 15,
    color: '#3A3A3C',
    textAlign: 'center',
    marginBottom: 20,
  },
  etaInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  etaModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  etaModalBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  etaModalCancel: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  etaModalBtnPrimary: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginLeft: 12,
  },
  etaModalSave: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  historySection: {
    marginTop: 4,
    marginBottom: 12,
  },
  recentHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  darkRecentHistoryCard: {
    backgroundColor: '#1C1C1E',
  },
  recentHistoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  recentHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  recentHistoryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  historyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyIcon: {
    fontSize: 20,
  },
  historyDest: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  historyMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  darkCurrentLocationBtn: {
    backgroundColor: '#1C1C1E',
  },
  currentLocIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  currentLocIcon: {
    fontSize: 18,
  },
  currentLocTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  currentLocSub: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  terminalCard: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  terminalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  terminalIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  terminalIconEmoji: {
    fontSize: 26,
  },
  terminalHeaderInfo: {
    flex: 1,
  },
  terminalCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  terminalCardSub: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  terminalRoutesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  terminalRoutesList: {
    maxHeight: 180,
    marginBottom: 20,
  },
  terminalRouteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  terminalRouteText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  terminalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  terminalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  terminalBtnDraw: {
    backgroundColor: '#007AFF',
    marginRight: 6,
  },
  terminalBtnDrawText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  terminalBtnClose: {
    backgroundColor: '#E5E5EA',
    marginHorizontal: 6,
  },
  terminalBtnCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  terminalBtnRemove: {
    backgroundColor: '#FF3B30',
    marginLeft: 6,
  },
  terminalBtnRemoveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  darkSearchModalSafeArea: {
    backgroundColor: '#121212',
  },
  darkSearchModalHeader: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#2C2C2E',
  },
  darkSearchModalContent: {
    backgroundColor: '#000000',
  },
  dualSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  darkDualSearchHeader: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#2C2C2E',
  },
  trackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    marginRight: 12,
  },
  startDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
  },
  trackLine: {
    width: 2,
    height: 24,
    backgroundColor: '#C7C7CC',
    marginVertical: 4,
  },
  destPin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  fieldsContainer: {
    flex: 1,
  },
  inactiveSearchInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  darkInactiveSearchInput: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  inactiveSearchText: {
    fontSize: 17,
    color: '#8E8E93',
    fontWeight: '600',
  },
  dualSearchBarOverride: {
    borderRadius: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    flex: 0,
    width: '100%',
  },
  dualSearchInputOverride: {
    fontSize: 17,
    paddingVertical: 12,
  },
  currentLocationPill: {
    backgroundColor: '#E5F1FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  darkCurrentLocationPill: {
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
  },
  currentLocationPillText: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 16,
  },
  darkCurrentLocationPillText: {
    color: '#0A84FF',
  },
  // New floating button styles transferred from App.js
  recenterContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 900,
  },
  floatingPinContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 900,
  },
  wazeReportFab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  pinGlyphOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinGlyphInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  devGearBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 14,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  darkDevGearBlur: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderColor: '#3A3A3C',
  },
  recenterIcon: {
    fontSize: 20,
    color: '#007AFF',
  },
  darkRecenterIcon: {
    color: '#0A84FF',
  },
});
