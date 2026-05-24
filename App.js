import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, LayoutAnimation, TouchableOpacity, Platform, useColorScheme, Alert, UIManager } from 'react-native';
import MapView, { PROVIDER_DEFAULT, Polyline, Marker } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import SakayanTracker from './components/SakayanTracker';
import BetaDisclaimer from './components/BetaDisclaimer';
import ProfileModal from './components/ProfileModal';
import ReportModal from './components/ReportModal';
import { MRT_STATIONS } from './utils/stations';
import { googleMapDarkStyle } from './utils/mapStyles';

import { useLocationTracking } from './hooks/useLocationTracking';
import { useRouting } from './hooks/useRouting';
import { useTerminals } from './hooks/useTerminals';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  const [destination, setDestination] = useState(null);
  const [customOrigin, setCustomOrigin] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [devSettingsVisible, setDevSettingsVisible] = useState(false);
  const [routeDrawMode, setRouteDrawMode] = useState(false);
  const [themePreference, setThemePreference] = useState('system');
  const [showPinButton, setShowPinButton] = useState(true);
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [pinVisible, setPinVisible] = useState(false);
  const [isCommuting, setIsCommuting] = useState(false);
  const [isPinningMode, setIsPinningMode] = useState(false);
  const [terminalsToPin, setTerminalsToPin] = useState([]);
  const [pinningStep, setPinningStep] = useState(0);
  const [drawnRoute, setDrawnRoute] = useState([]);
  const [isGpsRecording, setIsGpsRecording] = useState(false);
  const [destinationTerminal, setDestinationTerminal] = useState(null);
  const [mapTapCounter, setMapTapCounter] = useState(0);
  const [trackerSnapHeight, setTrackerSnapHeight] = useState(168);
  const [customPaths, setCustomPaths] = useState({});
  const mapRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('@custom_routes').then(data => {
      if (data) setCustomPaths(JSON.parse(data));
    });
  }, [routeDrawMode]);


  const colorScheme = useColorScheme();
  const effectiveColorScheme = themePreference === 'dark' ? 'dark' : themePreference === 'light' ? 'light' : colorScheme;
  const isDarkMode = effectiveColorScheme === 'dark';

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const stored = await AsyncStorage.getItem('@theme_preference');
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemePreference(stored);
        }
      } catch (error) {}
    };

    const loadPinButtonPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem('@show_pin_button');
        if (stored === 'true') setShowPinButton(true);
        if (stored === 'false') setShowPinButton(false);
      } catch (error) {}
    };

    loadThemePreference();
    loadPinButtonPreference();
  }, []);

  const handleThemeChange = async (nextTheme) => {
    setThemePreference(nextTheme);
    try {
      await AsyncStorage.setItem('@theme_preference', nextTheme);
    } catch (error) {}
  };

  const handlePinButtonChange = async (nextValue) => {
    setShowPinButton(nextValue);
    try {
      await AsyncStorage.setItem('@show_pin_button', nextValue ? 'true' : 'false');
    } catch (error) {}
  };

  const { location, errorMsg } = useLocationTracking();
  
  // Use custom origin if set, otherwise fallback to live GPS location
  const effectiveLocation = customOrigin 
    ? { coords: { latitude: customOrigin.latitude, longitude: customOrigin.longitude } } 
    : location;

  // GPS Route Tracing
  useEffect(() => {
    if (isGpsRecording && location) {
      setDrawnRoute(prev => {
        const lastPoint = prev[prev.length - 1];
        // Only add if moved significantly (e.g., > 10 meters) to avoid jitter
        if (!lastPoint || 
            (Math.abs(lastPoint.latitude - location.coords.latitude) > 0.0001 || 
             Math.abs(lastPoint.longitude - location.coords.longitude) > 0.0001)) {
          return [...prev, { latitude: location.coords.latitude, longitude: location.coords.longitude }];
        }
        return prev;
      });
    }
  }, [location, isGpsRecording]);

  const { incidents, dbStatus, addTerminal, removeTerminal, updateTerminal } = useTerminals();
  const { routeOptions, selectedRouteIndex, setSelectedRouteIndex, geometries, etaInfo, weatherAlert, setEtaInfo, clearRoute, isCalculating } = useRouting(effectiveLocation, destination, selectedTerminal, customPaths, incidents, mapRef);

  const togglePinningMode = (mode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsPinningMode(mode);
  };

  if (errorMsg) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  if (!location) {
    return (
    <View style={[styles.centerContainer, isDarkMode && styles.darkCenterContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, isDarkMode && styles.darkLoadingText]}>Finding your location...</Text>
      </View>
    );
  }

  const getTerminalIcon = (category) => {
    switch (category) {
      case 'jeep': return '🚙';
      case 'tricycle': return '🛺';
      case 'uv': return '🚐';
      case 'bus': return '🚌';
      case 'carousel': return '🚌'; // EDSA Carousel
      case 'train': return '🚆';
      default: return '📍';
    }
  };

  const getTerminalName = (route) => {
    if (!route) return 'Terminal';
    const parts = route.split(' ⇄ ');
    return parts[0] ? parts[0].trim() : 'Terminal';
  };

  const getMarkerTitle = (incident) => {
    if (!incident) return '';
    const defaultLabels = ['Jeepney', 'Tricycle', 'UV Express', 'Bus', 'EDSA Carousel', 'Train/MRT'];
    return (incident.label && !defaultLabels.includes(incident.label))
      ? `${incident.label} Terminal`
      : `${getTerminalName(incident.route)} Terminal`;
  };

  const recenterMap = () => {
    if (location && mapRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      mapRef.current.animateCamera({
        center: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        pitch: 0,
        heading: 0,
        altitude: 100,
        zoom: 18,
      }, { duration: 1000 });
    }
  };

  return (
    <View style={styles.container}>
      {/* Full-screen Map Layer */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        userInterfaceStyle={isDarkMode ? "dark" : "light"}
        customMapStyle={isDarkMode ? googleMapDarkStyle : []}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={(e) => {
          if (routeDrawMode && !isGpsRecording) {
            const coords = e.nativeEvent.coordinate;
            setDrawnRoute(prev => [...prev, coords]);
          } else if (isPinningMode && terminalsToPin.length > 0) {
            const coords = e.nativeEvent.coordinate;
            const updatedTerminals = [...terminalsToPin];
            updatedTerminals[pinningStep].coords = coords;
            
            if (pinningStep + 1 < terminalsToPin.length) {
              setTerminalsToPin(updatedTerminals);
              setPinningStep(pinningStep + 1);
            } else {
              updatedTerminals.forEach((t, i) => {
                addTerminal({
                  category: t.category,
                  label: t.name,
                  route: t.route,
                  latitude: t.coords.latitude,
                  longitude: t.coords.longitude,
                  id: Date.now().toString() + i.toString()
                });
              });
              Alert.alert("Terminals Pinned", `Successfully added ${updatedTerminals.length} terminal(s) to the database!`);
              setIsPinningMode(false);
              setTerminalsToPin([]);
              setPinningStep(0);
            }
          } else {
            setMapTapCounter(c => c + 1);
            if (selectedTerminal) setSelectedTerminal(null);
          }
        }}
      >
        {destination && (
          <Marker
            coordinate={destination}
            title={destination.name}
            pinColor="#FF3B30"
          />
        )}

        {/* Render Custom Origin Pin */}
        {customOrigin && (
          <Marker
            coordinate={customOrigin}
            title={customOrigin.name || "Start Location"}
            pinColor="#34C759" 
          />
        )}

        {/* Draw Alternative Routes */}
        {geometries && geometries.map((segments, index) => {
          const isActive = index === selectedRouteIndex;
          
          const getRouteColor = (type, category, isDark, active) => {
            let color = '';
            if (type === 'walk') color = isDark ? '#8E8E93' : '#A0A0A5';
            else {
              switch (category) {
                case 'jeep': color = '#007AFF'; break; // Blue
                case 'bus': color = '#34C759'; break; // Green
                case 'tricycle': color = '#FF9500'; break; // Orange
                case 'uv': color = '#AF52DE'; break; // Purple
                case 'train': color = '#5856D6'; break; // Indigo
                case 'carousel': color = '#5AC8FA'; break; // Light Blue
                default: color = '#007AFF'; break;
              }
            }
            // Append hex alpha channel (40 = ~25% opacity) for inactive routes
            return active ? color : color + '40'; 
          };

          return segments.map((seg, segIdx) => (
            <Polyline
              key={`route_${index}_seg_${segIdx}`}
              coordinates={seg.coords}
              strokeWidth={seg.type === 'walk' ? 4 : 6}
              strokeColor={getRouteColor(seg.type, seg.category, isDarkMode, isActive)}
              lineDashPattern={seg.type === 'walk' || seg.isDashed ? [6, 6] : null}
              lineCap="round"
              zIndex={isActive ? 10 : 5}
            />
          ));
        })}

        {/* Drawn Route (Editor Mode) */}
        {routeDrawMode && drawnRoute.length > 0 && (
          <Polyline
            coordinates={drawnRoute}
            strokeWidth={5}
            strokeColor="#FF3B30"
            lineDashPattern={[1]}
            zIndex={20}
          />
        )}

        {/* Render Train Stations (MRT-3 + LRT-1 + LRT-2) */}
        {MRT_STATIONS.map((station) => {
          const lineColor = station.line === 'LRT-1' ? '#FFCC00' : station.line === 'LRT-2' ? '#8B5CF6' : '#5856D6';
          return (
            <Marker
              key={station.id}
              coordinate={{ latitude: station.latitude, longitude: station.longitude }}
              title={station.name}
            >
              <View style={[styles.stationMarker, { borderColor: lineColor }]}>
                <Text style={styles.stationIcon}>{station.icon}</Text>
              </View>
            </Marker>
          );
        })}

        {/* Render Custom Pinned Terminals */}
        {incidents.map((incident) => {
          return (
            <Marker
              key={incident.id}
              coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
              title={getMarkerTitle(incident)}
              description="Tap to view routes"
              onPress={(e) => {
                e.stopPropagation();
                if (routeDrawMode) {
                  if (!selectedTerminal) {
                    setSelectedTerminal(incident);
                    if (drawnRoute.length === 0 && !isGpsRecording) {
                      setDrawnRoute([{ latitude: incident.latitude, longitude: incident.longitude }]);
                    }
                  } else if (incident.id !== selectedTerminal.id) {
                    Alert.alert(
                      "Final Destination?",
                      `Set ${getMarkerTitle(incident)} as the final destination for this route?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { 
                          text: "Yes", 
                          onPress: () => {
                            setDestinationTerminal(incident);
                            setDrawnRoute(prev => [...prev, { latitude: incident.latitude, longitude: incident.longitude }]);
                          }
                        }
                      ]
                    );
                  }
                } else {
                  setSelectedTerminal(incident);
                }
              }}
            >
              <View style={styles.terminalMarker}>
                <Text style={styles.terminalIcon}>{getTerminalIcon(incident.category)}</Text>
              </View>
            </Marker>
          );
        })}

        {/* Temporary Draft Pin while adding */}
        {pinVisible && terminalsToPin[pinningStep] && terminalsToPin[pinningStep].coords && (
          <Marker coordinate={terminalsToPin[pinningStep].coords}>
            <View style={styles.draftMarker}>
              <View style={styles.draftMarkerInner} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Floating HUD Overlay Layer */}
      {/* Search and Bottom Sheet Tracker (Hidden during Draw Mode and Pinning Mode) */}
      {!isPinningMode && !routeDrawMode && (
        <SakayanTracker
          currentLocation={location}
          customOrigin={customOrigin}
          etaInfo={etaInfo}
          routeOptions={routeOptions}
          selectedRouteIndex={selectedRouteIndex}
          onSelectRoute={setSelectedRouteIndex}
          onOriginSelect={setCustomOrigin}
          onLocationSelect={setDestination}
          selectedTerminal={selectedTerminal}
          onCloseTerminal={() => {
            setSelectedTerminal(null);
            setDrawnRoute([]);
            setDestinationTerminal(null);
          }}
          onRemoveTerminal={(id) => {
            removeTerminal(id);
            setSelectedTerminal(null);
          }}
          onRideStateChange={setIsCommuting}
          onPinTerminal={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setPinVisible(true);
          }}
          onDrawRoute={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setRouteDrawMode(true);
            setDrawnRoute([{ latitude: selectedTerminal.latitude, longitude: selectedTerminal.longitude }]);
          }}
          onEtaUpdate={setEtaInfo}
          isMapTapped={mapTapCounter}
          destination={destination}
            isDarkMode={isDarkMode}
          onSheetSnapChange={setTrackerSnapHeight}
          onCancelRoute={() => {
            setDestination(null);
            setCustomOrigin(null);
            setSelectedTerminal(null);
            setDrawnRoute([]);
            setDestinationTerminal(null);
            clearRoute();
            // Run animation after state updates to prevent MapView rendering bugs
            setTimeout(() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }, 50);
          }}
        />
      )}

      {/* Floating UI Elements */}
      {!isCommuting && !isPinningMode && (
        <>
          <View style={[styles.recenterContainer, { bottom: trackerSnapHeight + 16 }]}>
            <TouchableOpacity onPress={recenterMap} activeOpacity={0.7} hitSlop={10}>
              <View style={[styles.devGearBlur, isDarkMode && styles.darkDevGearBlur]}>
                <Text style={[styles.recenterIcon, isDarkMode && styles.darkRecenterIcon]}>➤</Text>
              </View>
            </TouchableOpacity>
          </View>

          {showPinButton && (
            <View style={[styles.floatingPinContainer, { bottom: trackerSnapHeight + 80 }]}>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setPinVisible(true);
              }} 
              activeOpacity={0.8} 
              hitSlop={10}
            >
              <View style={styles.wazeReportFab}>
                <View style={styles.pinGlyphOuter}>
                  <View style={styles.pinGlyphInner} />
                </View>
              </View>
            </TouchableOpacity>
            </View>
          )}

          <View style={styles.devGearContainer}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setProfileVisible(true);
              }}
              activeOpacity={0.7}
              hitSlop={10}
            >
              <View style={styles.devGearBlur}>
                <Text style={styles.devGearIcon}>☰</Text>
              </View>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Weather Warning Banner */}
      {!isCommuting && weatherAlert && (
        <View style={styles.weatherBanner}>
          <Text style={styles.weatherText}>🌧️ Rain expected at your destination. Bring an umbrella!</Text>
        </View>
      )}

      {/* Database Status Indicator */}
      {!isCommuting && !isPinningMode && (
        <View style={styles.dbStatusPill}>
          <Text style={styles.dbStatusText}>
            {dbStatus === 'connecting' ? '🟡 DB Syncing...' :
              dbStatus === 'connected' ? '🟢 DB Connected' : '🔴 DB Offline'}
          </Text>
        </View>
      )}

      {/* Tap-to-Pin Mode Banner */}
      {isPinningMode && terminalsToPin.length > 0 && (
        <View style={[styles.tapToPinBanner, isDarkMode && styles.darkTapToPinBanner]}>
          <Text style={[styles.tapToPinText, isDarkMode && styles.darkTapToPinText]}>Tap to drop pin for {terminalsToPin[pinningStep].name} 📍</Text>
          <TouchableOpacity
            style={[styles.tapToPinCancel, isDarkMode && styles.darkTapToPinCancel]}
            onPress={() => {
              Alert.alert("Cancel Pinning?", "Are you sure you want to stop pinning the new terminal?", [
                { text: "No", style: "cancel" },
                { text: "Yes", onPress: () => {
                  togglePinningMode(false);
                  setTerminalsToPin([]);
                  setPinningStep(0);
                }}
              ]);
            }}
          >
            <Text style={[styles.tapToPinCancelText, { fontSize: 16 }, isDarkMode && styles.darkTapToPinCancelText]}>✖</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Apple-style Modals */}
      <BetaDisclaimer />

      {/* Calculating Route Overlay */}
      {isCalculating && (
        <View style={[styles.calculatingBanner, isDarkMode && styles.darkCalculatingBanner]}>
          <ActivityIndicator size="small" color={isDarkMode ? "#FFFFFF" : "#000000"} style={{ marginRight: 8 }} />
          <Text style={[styles.calculatingText, isDarkMode && styles.darkCalculatingText]}>Calculating route...</Text>
        </View>
      )}

      <ProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        isDarkMode={isDarkMode}
        themePreference={themePreference}
        onThemeChange={handleThemeChange}
        showPinButton={showPinButton}
        onPinButtonChange={handlePinButtonChange}
        routeDrawMode={routeDrawMode}
        onRouteDrawModeChange={(val) => {
          setRouteDrawMode(val);
          if (val && selectedTerminal && drawnRoute.length === 0) {
            setDrawnRoute([{ latitude: selectedTerminal.latitude, longitude: selectedTerminal.longitude }]);
          } else if (!val) {
            setDrawnRoute([]);
            setDestinationTerminal(null);
            setIsGpsRecording(false);
          }
        }}
      />

      <ReportModal
        visible={pinVisible}
        incidents={incidents}
        isDarkMode={isDarkMode}
        onClose={() => {
          setPinVisible(false);
        }}
        onReport={(data) => {
          if (data.missingTerminals.length > 0) {
            setTerminalsToPin(data.missingTerminals);
            setPinningStep(0);
            setIsPinningMode(true);
            setPinVisible(false);
            Alert.alert(
              "New Terminal Locations",
              `We need to pin ${data.missingTerminals.length} terminal(s) for this route. Tap OK to begin.`,
              [{ text: "OK" }]
            );
          } else {
            Alert.alert("Terminals Exist", "Both terminals for this route are already pinned in the database!");
            setPinVisible(false);
          }
        }}
      />

      {/* Route Draw Mode Overlay */}
      {routeDrawMode && (
        <View style={[styles.drawModeOverlay, isDarkMode && styles.darkDrawModeOverlay]}>
          <Text style={[styles.drawModeTitle, isDarkMode && styles.darkText]}>Route Editor</Text>
          <Text style={styles.drawModeSub}>
            {selectedTerminal && destinationTerminal 
              ? `${getMarkerTitle(selectedTerminal)} ➡️ ${getMarkerTitle(destinationTerminal)}`
              : selectedTerminal 
                ? `Tap destination on map, or press Record to trace path manually.`
                : "Select a starting terminal marker"}
          </Text>
          
          <View style={styles.drawModeActions}>
            <TouchableOpacity 
              style={[styles.drawBtn, isGpsRecording ? styles.drawBtnStop : styles.drawBtnStart]}
              onPress={() => setIsGpsRecording(!isGpsRecording)}
            >
              <Text style={styles.drawBtnText}>{isGpsRecording ? "Stop" : "Record"}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.drawBtn, styles.drawBtnClear]}
              onPress={() => {
                setDrawnRoute(selectedTerminal ? [{ latitude: selectedTerminal.latitude, longitude: selectedTerminal.longitude }] : []);
                setDestinationTerminal(null);
              }}
            >
              <Text style={styles.drawBtnText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.drawBtn, styles.drawBtnSave, drawnRoute.length < 2 && styles.drawBtnDisabled]}
              onPress={async () => {
                if (drawnRoute.length < 2) return;
                if (!selectedTerminal) {
                   Alert.alert("Missing Terminal", "Please tap a starting terminal on the map first.");
                   return;
                }
                
                let dropoffNameStr = null;
                if (!destinationTerminal) {
                  if (Platform.OS === 'ios') {
                    dropoffNameStr = await new Promise(resolve => {
                      Alert.prompt(
                        "Drop-off Name",
                        "You only selected 1 terminal. Enter a name for the drop-off location (e.g., SM North):",
                        [
                          { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
                          { text: "Save", onPress: (text) => resolve(text || "Drop-off") }
                        ],
                        'plain-text'
                      );
                    });
                  } else {
                    const proceed = await new Promise(resolve => {
                      Alert.alert(
                        "Drop-off Route",
                        "You only selected 1 terminal. Save this path as a Drop-off route?",
                        [
                          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                          { text: "Save", onPress: () => resolve(true) }
                        ]
                      );
                    });
                    if (proceed) dropoffNameStr = "Drop-off";
                  }
                  if (!dropoffNameStr) return;
                }
                
                try {
                  Alert.alert("Aligning...", "Snapping to road network...");
                  
                  let pointsToSend = drawnRoute;
                  if (drawnRoute.length > 50) {
                    pointsToSend = drawnRoute.filter((_, i) => i % Math.ceil(drawnRoute.length / 50) === 0);
                  }
                  if (pointsToSend[pointsToSend.length - 1] !== drawnRoute[drawnRoute.length - 1]) {
                    pointsToSend.push(drawnRoute[drawnRoute.length - 1]);
                  }
                  
                  const coordsStr = pointsToSend.map(p => `${p.longitude},${p.latitude}`).join(';');
                  const res = await axios.get(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`);
                  
                  let finalRoute = drawnRoute;
                  if (res.data.routes && res.data.routes.length > 0) {
                    finalRoute = res.data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
                  } else {
                    throw new Error("No route found");
                  }
                  
                  const saveRouteData = async (isAlternative, dashed = false) => {
                    const routePayload = { 
                      coordinates: dashed ? drawnRoute : finalRoute, 
                      isDashed: dashed, 
                      category: selectedTerminal.category,
                      dropoffName: dropoffNameStr 
                    };
                    
                    const saved = await AsyncStorage.getItem('@custom_routes') || '{}';
                    const parsed = JSON.parse(saved);
                    const destId = destinationTerminal ? destinationTerminal.id : 'none';
                    const routeId = `route_from_${selectedTerminal.id}_to_${destId}`;
                    
                    let terminalPaths = selectedTerminal.custom_paths || {};
                    
                    if (isAlternative) {
                      if (!terminalPaths[routeId]) terminalPaths[routeId] = { paths: [] };
                      if (!terminalPaths[routeId].paths) terminalPaths[routeId].paths = [];
                      terminalPaths[routeId].paths.push(routePayload);
                    } else {
                      if (terminalPaths[routeId] && terminalPaths[routeId].paths) {
                        terminalPaths[routeId] = { ...routePayload, paths: terminalPaths[routeId].paths };
                      } else {
                        terminalPaths[routeId] = routePayload;
                      }
                    }
                    
                    parsed[routeId] = terminalPaths[routeId];
                    await AsyncStorage.setItem('@custom_routes', JSON.stringify(parsed));
                    setLocalCustomPaths(parsed);
                    
                    const targetDestName = destinationTerminal ? getTerminalName(destinationTerminal.route) : dropoffNameStr;
                    let newRouteString = selectedTerminal.route || '';
                    
                    if (targetDestName) {
                      const currentDests = newRouteString.split(/ ⇄ | ➡️ | \/ /).map(s => s.trim());
                      if (!currentDests.includes(targetDestName)) {
                        newRouteString = newRouteString ? `${newRouteString} ⇄ ${targetDestName}` : targetDestName;
                      }
                    }
                    
                    updateTerminal(selectedTerminal.id, { 
                      route: newRouteString,
                      custom_paths: terminalPaths 
                    });

                    Alert.alert("Route Saved to Database", isAlternative ? "Saved as Alternative path." : `Path saved and synced to the cloud!`);
                    setDrawnRoute([]);
                    setRouteDrawMode(false);
                    setIsGpsRecording(false);
                    setDestinationTerminal(null);
                  };

                  // Check local config to see if we prompt for alternative
                  const savedForCheck = await AsyncStorage.getItem('@custom_routes') || '{}';
                  const parsedForCheck = JSON.parse(savedForCheck);
                  const checkRouteId = `route_from_${selectedTerminal.id}_to_${destinationTerminal ? destinationTerminal.id : 'none'}`;
                  
                  if (parsedForCheck[checkRouteId] && parsedForCheck[checkRouteId].coordinates) {
                    Alert.alert(
                      "Path Exists",
                      "A path already exists for this route.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Overwrite Main", onPress: () => saveRouteData(false) },
                        { text: "Save as Alternative 1", onPress: () => saveRouteData(true) }
                      ]
                    );
                  } else {
                    await saveRouteData(false);
                  }
                } catch(e) {
                  Alert.alert(
                    "Network Issue", 
                    "Could not perfectly snap to the road. Do you want to save it as a direct dashed walking path instead?",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Save as Dashed", onPress: () => saveRouteData(false, true) }
                    ]
                  );
                }
              }}
              disabled={drawnRoute.length < 2}
            >
              <Text style={styles.drawBtnText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.drawBtn, { backgroundColor: '#3A3A3C' }]}
              onPress={() => {
                setRouteDrawMode(false);
                setIsGpsRecording(false);
                setDrawnRoute([]);
                setDestinationTerminal(null);
              }}
            >
              <Text style={styles.drawBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkCenterContainer: {
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 17,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: 'System',
    letterSpacing: -0.2,
  },
  darkLoadingText: {
    color: '#98989D',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
    fontFamily: 'System',
    padding: 20,
    textAlign: 'center',
  },
  terminalMarker: {
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  terminalIcon: {
    fontSize: 20,
  },
  draftMarker: {
    width: 28,
    height: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 4,
    borderColor: '#007AFF', // Blue ring
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  draftMarkerInner: {
    width: 8,
    height: 8,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  recenterContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 90,
  },
  floatingPinContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 90,
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
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  pinGlyphOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinGlyphInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#007AFF',
  },
  recenterIcon: {
    color: '#007AFF',
    fontSize: 34,
    fontWeight: '900',
    transform: [{ rotate: '-45deg' }],
    marginTop: -1,
  },
  darkRecenterIcon: {
    color: '#FFFFFF',
  },
  devGearContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    zIndex: 90,
  },
  devGearBlur: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  devGearIcon: {
    fontSize: 24,
  },
  weatherBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 80,
    right: 16,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 12,
    zIndex: 95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  weatherText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  dbStatusPill: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 95,
  },
  dbStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  tapToPinBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 65 : 45,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  darkTapToPinBanner: {
    backgroundColor: '#2C2C2E',
    shadowColor: '#000',
    shadowOpacity: 0.5,
  },
  tapToPinText: {
    color: '#1C1C1E',
    fontWeight: '700',
    fontSize: 16,
    marginRight: 16,
    letterSpacing: -0.3,
  },
  darkTapToPinText: {
    color: '#FFFFFF',
  },
  calculatingBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 65 : 45,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  darkCalculatingBanner: {
    backgroundColor: '#2C2C2E',
    shadowColor: '#000',
    shadowOpacity: 0.5,
  },
  calculatingText: {
    color: '#1C1C1E',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  darkCalculatingText: {
    color: '#FFFFFF',
  },
  tapToPinCancel: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  darkTapToPinCancel: {
    backgroundColor: '#3A3A3C',
  },
  tapToPinCancelText: {
    color: '#FF3B30',
    fontWeight: '700',
    fontSize: 14,
  },
  darkTapToPinCancelText: {
    color: '#FF453A',
  },
  stationMarker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#5856D6',
  },
  stationIcon: {
    fontSize: 16,
  },
  drawModeOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 999,
    width: '90%',
  },
  darkDrawModeOverlay: {
    backgroundColor: 'rgba(28,28,30,0.95)',
  },
  drawModeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  drawModeSub: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  drawModeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drawBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  drawBtnStart: {
    backgroundColor: '#007AFF',
  },
  drawBtnStop: {
    backgroundColor: '#FF3B30',
  },
  drawBtnClear: {
    backgroundColor: '#8E8E93',
  },
  drawBtnSave: {
    backgroundColor: '#34C759',
  },
  drawBtnDisabled: {
    backgroundColor: '#E5E5EA',
  },
  drawBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
