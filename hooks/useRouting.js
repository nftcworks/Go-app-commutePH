import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Alert, LayoutAnimation } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateMultiModalRouteOptions } from '../utils/routingEngine';
import { MRT_STATIONS } from '../utils/stations';

export const useRouting = (location, destination, selectedTerminal, customPaths, terminals, mapRef, hasDiscount = false, sortPreference = 'fastest') => {
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [etaInfo, setEtaInfo] = useState(null);
  const [geometries, setGeometries] = useState([]);
  const [weatherAlert, setWeatherAlert] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const lastRouted = useRef({ locLat: null, locLng: null, destLat: null, destLng: null });

  const locLat = location?.coords?.latitude;
  const locLng = location?.coords?.longitude;
  const destLat = destination?.latitude;
  const destLng = destination?.longitude;
  const destName = destination?.name;

  const customPathsStr = JSON.stringify(customPaths || {});
  const terminalsPathsStr = JSON.stringify((terminals || []).map(t => t.custom_paths || {}));
  const combinedPathsHash = customPathsStr + terminalsPathsStr;

  const selectedTerminalId = selectedTerminal?.id || null;

  useEffect(() => {
    if (!locLat || !locLng || !destLat || !destLng) return;

    const destChanged = destLat !== lastRouted.current.destLat || destLng !== lastRouted.current.destLng;
    const originDiff = Math.abs(locLat - (lastRouted.current.locLat || locLat)) + Math.abs(locLng - (lastRouted.current.locLng || locLng));
    const terminalChanged = selectedTerminalId !== lastRouted.current.selectedTerminalId;
    const customPathsChanged = combinedPathsHash !== lastRouted.current.combinedPathsHash;

    // Only reroute if destination changed, origin moved significantly (> ~200m), terminal changed, or custom paths updated
    if (lastRouted.current.destLat && !destChanged && originDiff < 0.002 && !terminalChanged && !customPathsChanged) {
      return;
    }

    lastRouted.current = { locLat, locLng, destLat, destLng, selectedTerminalId, combinedPathsHash, hasDiscount };

    let isMounted = true;
    setIsCalculating(true);

    const getRoute = async () => {
      try {
        let allGeometries = [];
        let allOptions = [];

        // Merge local custom paths with cloud custom paths from all terminals
        const combinedPaths = { ...(customPaths || {}) };
        if (terminals && Array.isArray(terminals)) {
          terminals.forEach(t => {
            if (t.custom_paths) {
              Object.assign(combinedPaths, t.custom_paths);
            }
          });
        }

        const getDistance = (lat1, lon1, lat2, lon2) => {
          const p = 0.017453292519943295;
          const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * (1 - Math.cos((lon2 - lon1) * p)) / 2;
          return 12742 * Math.asin(Math.sqrt(a));
        };

        const fetchWalkRoute = async (lat1, lon1, lat2, lon2) => {
          try {
            const res = await axios.get(`https://router.project-osrm.org/route/v1/walking/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`);
            if (res.data.routes && res.data.routes.length > 0) {
              return res.data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
            }
          } catch (e) { }
          return [{ latitude: lat1, longitude: lon1 }, { latitude: lat2, longitude: lon2 }];
        };

        // --- AUTO-DISCOVERY LOGIC (MULTI-MODAL ALTERNATIVES) ---
        let activeTerminals = [];

        if (selectedTerminal) {
          activeTerminals.push(selectedTerminal);
        } else if (terminals && terminals.length > 0) {
          let bestJeepTerminal = null;
          let bestJeepScore = Infinity;

          let bestFlexTerminal = null;
          let bestFlexScore = Infinity;
          let bestTrainTerminal = null;

          let closestTrainOrig = null;
          let minTrainOrigWalk = Infinity;
          let closestTrainDest = null;
          let minTrainDestWalk = Infinity;

          let bestComboTerminal = null;
          let bestComboScore = Infinity;

          for (const terminal of terminals) {
            const walkToTerm = getDistance(locLat, locLng, terminal.latitude, terminal.longitude);

            if (terminal.category === 'tricycle' || terminal.category === 'taxi' || terminal.category === 'grab') {
              if (walkToTerm < 1.0) {
                const rideDistApprox = getDistance(terminal.latitude, terminal.longitude, destLat, destLng);
                if (rideDistApprox > 8.0 && terminal.category === 'tricycle') continue;
                const flexScore = (walkToTerm * 3) + 0 + (rideDistApprox * 0.1);

                if (flexScore < bestFlexScore) {
                  bestFlexScore = flexScore;
                  bestFlexTerminal = terminal;
                }
              }
              continue;
            }

            if (terminal.category === 'train' || terminal.category === 'mrt' || terminal.category === 'lrt') {
              if (walkToTerm < 2.5 && walkToTerm < minTrainOrigWalk) {
                minTrainOrigWalk = walkToTerm;
                closestTrainOrig = terminal;
              }
              const walkFromDest = getDistance(terminal.latitude, terminal.longitude, destLat, destLng);
              if (walkFromDest < 2.5 && walkFromDest < minTrainDestWalk) {
                minTrainDestWalk = walkFromDest;
                closestTrainDest = terminal;
              }
              continue;
            }

            if (walkToTerm > 2.5) continue; // Too far to walk to this jeep/bus terminal

            const routeKeys = Object.keys(combinedPaths).filter(k => k.startsWith(`route_from_${terminal.id}`));
            for (let rKey of routeKeys) {
              const rObj = combinedPaths[rKey];
              const paths = rObj.paths ? rObj.paths : [rObj];
              const coords = Array.isArray(paths[0]) ? paths[0] : paths[0].coordinates;

              if (coords && coords.length > 0) {
                let minWalkFromDropoff = Infinity;
                let bestDropoffIdx = coords.length - 1;

                let minWalkToTrain = Infinity;
                let bestTrainDropoffIdx = -1;
                let bestTrainStationForPath = null;

                // Smart Drop-off: Find the closest coordinate along the custom path
                for (let i = 0; i < coords.length; i++) {
                  const d = getDistance(coords[i].latitude, coords[i].longitude, destLat, destLng);
                  if (d < minWalkFromDropoff) {
                    minWalkFromDropoff = d;
                    bestDropoffIdx = i;
                  }

                  // Combo detection: if destination is far, does this path go near a train station?
                  if (closestTrainDest) {
                    for (let ts of MRT_STATIONS) {
                      if (ts.id === closestTrainDest.id) continue;
                      const dTrain = getDistance(coords[i].latitude, coords[i].longitude, ts.latitude, ts.longitude);
                      if (dTrain < minWalkToTrain && dTrain < 1.0) { // must be < 1km walk to transfer
                        minWalkToTrain = dTrain;
                        bestTrainDropoffIdx = i;
                        bestTrainStationForPath = ts;
                      }
                    }
                  }
                }

                const walkFromDropoff = minWalkFromDropoff;
                const score = (walkToTerm * 3) + (walkFromDropoff * 3) + (bestDropoffIdx * 0.05);

                if (walkFromDropoff < 3.0 && score < bestJeepScore) {
                  bestJeepScore = score;
                  bestJeepTerminal = terminal;
                }

                if (closestTrainDest && bestTrainStationForPath) {
                  const trainDist = getDistance(bestTrainStationForPath.latitude, bestTrainStationForPath.longitude, closestTrainDest.latitude, closestTrainDest.longitude);
                  const comboScore = (walkToTerm * 3) + (minWalkToTrain * 3) + (trainDist * 0.02) + (minTrainDestWalk * 3) + (bestTrainDropoffIdx * 0.05);
                  if (comboScore < bestComboScore) {
                    bestComboScore = comboScore;
                    bestComboTerminal = { ...terminal, isComboPair: true, comboTrainOrig: bestTrainStationForPath, comboTrainDest: closestTrainDest, comboDropoffIdx: bestTrainDropoffIdx, comboRouteKey: rKey };
                  }
                }
              }
            }
          }

          bestTrainTerminal = null; // Ensure 'let' is removed here!
          if (closestTrainOrig && closestTrainDest && closestTrainOrig.id !== closestTrainDest.id) {
            const trainDist = getDistance(closestTrainOrig.latitude, closestTrainOrig.longitude, closestTrainDest.latitude, closestTrainDest.longitude);
            const trainScore = (minTrainOrigWalk * 3) + (minTrainDestWalk * 3) + (trainDist * 0.02);
            bestTrainTerminal = { ...closestTrainOrig, isTrainPair: true, trainDest: closestTrainDest, trainScore };
          }

          if (bestTrainTerminal) activeTerminals.push(bestTrainTerminal);
          if (bestJeepTerminal) activeTerminals.push(bestJeepTerminal);
          if (bestFlexTerminal) activeTerminals.push(bestFlexTerminal);
          if (bestComboTerminal) activeTerminals.push(bestComboTerminal);
        }

        // Loop through all collected best candidates to generate Alternative Routes!
        for (let activeTerminal of activeTerminals) {

          // --- COMBO JEEP -> TRAIN EXCEPTION ---
          if (activeTerminal.isComboPair && activeTerminal.comboTrainOrig && activeTerminal.comboTrainDest) {
            const trainOrig = activeTerminal.comboTrainOrig;
            const trainDest = activeTerminal.comboTrainDest;
            const customRouteObj = combinedPaths[activeTerminal.comboRouteKey];
            const paths = customRouteObj.paths ? customRouteObj.paths : [customRouteObj];
            const fullCoords = Array.isArray(paths[0]) ? paths[0] : paths[0].coordinates;

            const pathCoords = fullCoords.slice(0, activeTerminal.comboDropoffIdx + 1);
            const jeepDropoff = pathCoords[pathCoords.length - 1];

            const res = await axios.get(`https://router.project-osrm.org/route/v1/driving/${trainOrig.longitude},${trainOrig.latitude};${trainDest.longitude},${trainDest.latitude}?overview=full&geometries=geojson`).catch(() => ({ data: { routes: [] } }));
            let trainCoords = [{ latitude: trainOrig.latitude, longitude: trainOrig.longitude }, { latitude: trainDest.latitude, longitude: trainDest.longitude }];
            if (res.data.routes && res.data.routes.length > 0) {
              trainCoords = res.data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
            }

            // Instead of sequentially awaiting each, we can run them concurrently using Promise.all for speed.
            const [walkToTerminal, walkToTrain, walkToDest] = await Promise.all([
              fetchWalkRoute(locLat, locLng, activeTerminal.latitude, activeTerminal.longitude),
              fetchWalkRoute(jeepDropoff.latitude, jeepDropoff.longitude, trainOrig.latitude, trainOrig.longitude),
              fetchWalkRoute(trainDest.latitude, trainDest.longitude, destLat, destLng)
            ]);

            const segments = [
              { type: 'walk', coords: walkToTerminal },
              { type: 'ride', coords: pathCoords, isDashed: false, category: activeTerminal.category },
              { type: 'walk', coords: walkToTrain },
              { type: 'ride', coords: trainCoords, isDashed: false, category: 'train' },
              { type: 'walk', coords: walkToDest }
            ];

            allGeometries.push(segments);
            let walk1Mins = Math.ceil(getDistance(locLat, locLng, activeTerminal.latitude, activeTerminal.longitude) * 12);
            let ride1Mins = Math.ceil(pathCoords.length * 0.5);
            let walk2Mins = Math.ceil(getDistance(jeepDropoff.latitude, jeepDropoff.longitude, trainOrig.latitude, trainOrig.longitude) * 12);
            let ride2Mins = Math.ceil(getDistance(trainOrig.latitude, trainOrig.longitude, trainDest.latitude, trainDest.longitude) * 2);

            let durationMinutes = walk1Mins + ride1Mins + walk2Mins + ride2Mins + 5;

            let finalSteps = [
              { id: 'w1', type: 'walk', icon: '🚶', instruction: `Walk to ${activeTerminal.label || activeTerminal.category} terminal`, duration: walk1Mins },
              { id: 'r1', type: 'ride', icon: '🚙', instruction: `Ride to ${trainOrig.name || 'Train Station'}`, duration: ride1Mins },
              { id: 'w2', type: 'walk', icon: '🚶', instruction: `Walk to ${trainOrig.name} platform`, duration: walk2Mins },
              { id: 'r2', type: 'ride', icon: '🚆', instruction: `Ride Train to ${trainDest.name}`, duration: ride2Mins },
            ];

            const distToDest = getDistance(trainDest.latitude, trainDest.longitude, destLat, destLng);
            let chainedTricycle = false;
            if (distToDest > 1.0) {
              const tricycles = (terminals || []).filter(t => t.category === 'tricycle');
              let closestTricycle = null; let minDist = 0.5;
              for (let t of tricycles) {
                const d = getDistance(trainDest.latitude, trainDest.longitude, t.latitude, t.longitude);
                if (d < minDist) { minDist = d; closestTricycle = t; }
              }
              if (closestTricycle) {
                chainedTricycle = true;
                segments.push({ type: 'walk', coords: await fetchWalkRoute(trainDest.latitude, trainDest.longitude, closestTricycle.latitude, closestTricycle.longitude) });
                try {
                  const tricyRes = await axios.get(`https://router.project-osrm.org/route/v1/driving/${closestTricycle.longitude},${closestTricycle.latitude};${destLng},${destLat}?overview=full&geometries=geojson`);
                  if (tricyRes.data.routes && tricyRes.data.routes.length > 0) {
                    const tricyRideCoords = tricyRes.data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
                    segments.push({ type: 'ride', coords: tricyRideCoords, isDashed: false, category: 'tricycle' });
                    const tricyDuration = Math.ceil(tricyRes.data.routes[0].duration / 60);
                    durationMinutes += tricyDuration + 3;
                    finalSteps.push({ id: 'w3', type: 'walk', icon: '🚶', instruction: 'Walk to tricycle terminal', duration: 3 });
                    finalSteps.push({ id: 'r3', type: 'ride', icon: '🛺', instruction: 'Ride tricycle to final destination', duration: tricyDuration });
                  } else { chainedTricycle = false; }
                } catch (e) { chainedTricycle = false; }
              }
            }

            if (!chainedTricycle) {
              segments.push({ type: 'walk', coords: await fetchWalkRoute(trainDest.latitude, trainDest.longitude, destLat, destLng) });
              const walk3Mins = Math.ceil(distToDest * 12);
              finalSteps.push({ id: 'w3', type: 'walk', icon: '🚶', instruction: 'Walk to destination', duration: walk3Mins });
              durationMinutes += walk3Mins;
            }

            const comboSortScore = (walk1Mins * 2.0) + (ride1Mins * 1.2) + (walk2Mins * 2.5) + (ride2Mins * 0.8) + (chainedTricycle ? 10 : (distToDest * 12 * 2.0));

            allOptions.push({
              id: 'opt_combo',
              routeId: activeTerminal.comboRouteKey,
              terminalId: activeTerminal.id,
              isCustom: true,
              title: 'Intermodal Route',
              badge: 'Combo',
              durationMins: durationMinutes,
              distance: (pathCoords.length * 0.05 + getDistance(trainOrig.latitude, trainOrig.longitude, trainDest.latitude, trainDest.longitude)).toFixed(1),
              sortScore: comboSortScore,
              duration: durationMinutes,
              steps: finalSteps
            });
            continue;
          }

          // --- TRAIN EXCEPTION ---
          if (activeTerminal.isTrainPair && activeTerminal.trainDest) {
            const destStation = activeTerminal.trainDest;
            const res = await axios.get(`https://router.project-osrm.org/route/v1/driving/${activeTerminal.longitude},${activeTerminal.latitude};${destStation.longitude},${destStation.latitude}?overview=full&geometries=geojson`);

            let rideCoords = [{ latitude: activeTerminal.latitude, longitude: activeTerminal.longitude }, { latitude: destStation.latitude, longitude: destStation.longitude }];
            if (res.data.routes && res.data.routes.length > 0) {
              rideCoords = res.data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
            }

            allGeometries.push([
              { type: 'walk', coords: await fetchWalkRoute(locLat, locLng, activeTerminal.latitude, activeTerminal.longitude) },
              { type: 'ride', coords: rideCoords, isDashed: false, category: 'train' },
              { type: 'walk', coords: await fetchWalkRoute(destStation.latitude, destStation.longitude, destLat, destLng) }
            ]);

            const trainRideDist = getDistance(activeTerminal.latitude, activeTerminal.longitude, destStation.latitude, destStation.longitude);
            const durationMinutes = Math.ceil(trainRideDist * 2); // Roughly 2 mins per km for train
            const walk1Duration = Math.ceil(getDistance(locLat, locLng, activeTerminal.latitude, activeTerminal.longitude) * 12);
            const walk2Duration = Math.ceil(getDistance(destStation.latitude, destStation.longitude, destLat, destLng) * 12);

            // Smart Scoring: heavily penalize walking, slightly favor train speeds
            const trainSortScore = (walk1Duration * 2.5) + (durationMinutes * 0.8) + (walk2Duration * 2.5);

            allOptions.push({
              id: 'opt_train',
              title: 'Train Route',
              badge: 'Fastest',
              durationMins: durationMinutes + walk1Duration + walk2Duration,
              distance: trainRideDist.toFixed(1),
              sortScore: trainSortScore,
              duration: durationMinutes + walk1Duration + walk2Duration,
              steps: [
                { id: 'w1', type: 'walk', icon: '🚶', instruction: `Walk to ${activeTerminal.label || 'Train'} Station`, duration: walk1Duration },
                { id: 'r1', type: 'ride', icon: '🚆', instruction: `Ride Train to ${destStation.label || 'Destination'} Station`, duration: durationMinutes },
                { id: 'w2', type: 'walk', icon: '🚶', instruction: 'Walk to destination', duration: walk2Duration }
              ]
            });
          }
          // --- CUSTOM PATHS & FALLBACKS ---
          else {
            const routeKeys = Object.keys(combinedPaths).filter(k => k.startsWith(`route_from_${activeTerminal.id}`));

            if (routeKeys.length > 0) {
              let bestRouteKey = routeKeys[0];
              let minDestDist = Infinity;

              for (let rKey of routeKeys) {
                const rObj = combinedPaths[rKey];
                const paths = rObj.paths ? rObj.paths : [rObj];
                const firstPath = paths[0];
                const coords = Array.isArray(firstPath) ? firstPath : firstPath.coordinates;
                if (coords && coords.length > 0) {
                  let minWalkFromDropoff = Infinity;
                  for (let i = 0; i < coords.length; i++) {
                    const d = getDistance(coords[i].latitude, coords[i].longitude, destLat, destLng);
                    if (d < minWalkFromDropoff) {
                      minWalkFromDropoff = d;
                    }
                  }
                  if (minWalkFromDropoff < minDestDist) {
                    minDestDist = minWalkFromDropoff;
                    bestRouteKey = rKey;
                  }
                }
              }

              const customRouteObj = combinedPaths[bestRouteKey];
              const pathsToRender = customRouteObj.paths ? customRouteObj.paths : [customRouteObj];

              for (let idx = 0; idx < pathsToRender.length; idx++) {
                const pathObj = pathsToRender[idx];
                const pathCoords = Array.isArray(pathObj) ? pathObj : pathObj.coordinates;
                const isDashed = Array.isArray(pathObj) ? false : pathObj.isDashed;
                const dropoffName = !Array.isArray(pathObj) ? pathObj.dropoffName : null;

                if (!pathCoords || pathCoords.length === 0) continue;

                // Smart Drop-off: Find closest point along the path
                let minWalkFromPath = Infinity;
                let bestDropoffIdx = pathCoords.length - 1;
                for (let i = 0; i < pathCoords.length; i++) {
                  const d = getDistance(pathCoords[i].latitude, pathCoords[i].longitude, destLat, destLng);
                  if (d < minWalkFromPath) {
                    minWalkFromPath = d;
                    bestDropoffIdx = i;
                  }
                }

                // Truncate path so the line actually stops at the dropoff point
                const truncatedCoords = pathCoords.slice(0, bestDropoffIdx + 1);
                const endPoint = truncatedCoords[truncatedCoords.length - 1];

                const segments = [];
                let startChainedTricycle = false;
                const distToOrigin = getDistance(locLat, locLng, activeTerminal.latitude, activeTerminal.longitude);
                let finalSteps = [];
                let durationMinutes = 0;
                let customSortScore = 0;

                if (distToOrigin > 1.0) {
                  const tricycles = (terminals || []).filter(t => t.category === 'tricycle');
                  let closestStartTricycle = null;
                  let minStartDist = 0.5;
                  for (let t of tricycles) {
                    const d = getDistance(locLat, locLng, t.latitude, t.longitude);
                    if (d < minStartDist) { minStartDist = d; closestStartTricycle = t; }
                  }
                  if (closestStartTricycle) {
                    startChainedTricycle = true;
                    segments.push({ type: 'walk', coords: await fetchWalkRoute(locLat, locLng, closestStartTricycle.latitude, closestStartTricycle.longitude) });
                    try {
                      const startTricyRes = await axios.get(`https://router.project-osrm.org/route/v1/driving/${closestStartTricycle.longitude},${closestStartTricycle.latitude};${activeTerminal.longitude},${activeTerminal.latitude}?overview=full&geometries=geojson`);
                      if (startTricyRes.data.routes && startTricyRes.data.routes.length > 0) {
                        const tricyRideCoords = startTricyRes.data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
                        segments.push({ type: 'ride', coords: tricyRideCoords, isDashed: false, category: 'tricycle' });
                        const tricyDuration = Math.ceil(startTricyRes.data.routes[0].duration / 60);
                        durationMinutes += tricyDuration + 3;
                        finalSteps.push({ id: 'w0', type: 'walk', icon: '🚶', instruction: 'Walk to tricycle terminal', duration: 3 });
                        finalSteps.push({ id: 'r0', type: 'ride', icon: '🛺', instruction: `Ride tricycle to ${activeTerminal.label || activeTerminal.category} terminal`, duration: tricyDuration });
                        customSortScore += (3 * 2.0) + (tricyDuration * 1.5) + 5;
                      } else { startChainedTricycle = false; }
                    } catch (e) { startChainedTricycle = false; }
                  }
                }

                if (!startChainedTricycle) {
                  segments.push({ type: 'walk', coords: await fetchWalkRoute(locLat, locLng, activeTerminal.latitude, activeTerminal.longitude) });
                  const walk1Mins = Math.ceil(distToOrigin * 12);
                  finalSteps.push({ id: 'w1', type: 'walk', icon: '🚶', instruction: `Walk to ${activeTerminal.label || activeTerminal.category} terminal`, duration: walk1Mins });
                  durationMinutes += walk1Mins;
                  customSortScore += (walk1Mins * 2.0);
                }

                // Main Custom Path Ride
                segments.push({ type: 'ride', coords: truncatedCoords, isDashed: isDashed, category: activeTerminal.category });
                const mainRideMins = Math.ceil(truncatedCoords.length * 0.5);
                finalSteps.push({ id: 'r1', type: 'ride', icon: '🚙', instruction: `Ride and drop-off near destination`, duration: mainRideMins });
                durationMinutes += mainRideMins + 5;
                customSortScore += (mainRideMins * 1.2);

                // --- MULTI-MODAL CHAINING ---
                // If destination is far from drop-off (> 1km), search for tricycle terminal near drop-off
                const distToDest = getDistance(endPoint.latitude, endPoint.longitude, destLat, destLng);
                let chainedTricycle = false;

                if (distToDest > 1.0) {
                  const tricycles = (terminals || []).filter(t => t.category === 'tricycle');
                  let closestTricycle = null;
                  let minDist = 0.5; // max 500m walk to tricycle terminal

                  for (let t of tricycles) {
                    const d = getDistance(endPoint.latitude, endPoint.longitude, t.latitude, t.longitude);
                    if (d < minDist) { minDist = d; closestTricycle = t; }
                  }

                  if (closestTricycle) {
                    chainedTricycle = true;
                    segments.push({ type: 'walk', coords: await fetchWalkRoute(endPoint.latitude, endPoint.longitude, closestTricycle.latitude, closestTricycle.longitude) });

                    try {
                      const tricyRes = await axios.get(`https://router.project-osrm.org/route/v1/driving/${closestTricycle.longitude},${closestTricycle.latitude};${destLng},${destLat}?overview=full&geometries=geojson`);
                      if (tricyRes.data.routes && tricyRes.data.routes.length > 0) {
                        const tricyRideCoords = tricyRes.data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
                        segments.push({ type: 'ride', coords: tricyRideCoords, isDashed: false, category: 'tricycle' });

                        const tricyDuration = Math.ceil(tricyRes.data.routes[0].duration / 60);
                        durationMinutes += tricyDuration + 3;
                        finalSteps.push({ id: 'w2', type: 'walk', icon: '🚶', instruction: 'Walk to tricycle terminal', duration: 3 });
                        finalSteps.push({ id: 'r2', type: 'ride', icon: '🛺', instruction: 'Ride tricycle to final destination', duration: tricyDuration });

                        // Penalize tricycle chaining
                        customSortScore += (3 * 2.0) + (tricyDuration * 1.5) + 5;
                      } else {
                        chainedTricycle = false;
                      }
                    } catch (e) { chainedTricycle = false; }
                  }
                }

                if (!chainedTricycle) {
                  segments.push({ type: 'walk', coords: await fetchWalkRoute(endPoint.latitude, endPoint.longitude, destLat, destLng) });
                  const walk2Mins = Math.ceil(distToDest * 12);
                  finalSteps.push({ id: 'w2', type: 'walk', icon: '🚶', instruction: 'Walk to destination', duration: walk2Mins });
                  durationMinutes += walk2Mins;
                  customSortScore += (walk2Mins * 2.0); // Penalize final walk
                }

                // Smart Scoring: Heavily penalize tricycles if they travel long distances (mahal at malayo)
                if (activeTerminal.category === 'tricycle' || activeTerminal.category === 'taxi' || activeTerminal.category === 'grab') {
                  const rideDistKm = truncatedCoords.length * 0.05;
                  customSortScore += (rideDistKm * 5); // Base penalty per km
                  if (rideDistKm > 3.5) customSortScore += 30; // Massive penalty if trying to use trike for very long distance
                }

                allGeometries.push(segments);
                const distKm = (truncatedCoords.length * 0.05 + (chainedTricycle ? 2 : distToDest)).toFixed(1);

                allOptions.push({
                  id: `custom_${activeTerminal.id}_${idx}`,
                  routeId: bestRouteKey,
                  terminalId: activeTerminal.id,
                  isCustom: true,
                  title: idx === 0 ? (chainedTricycle ? 'Multi-Modal Route' : 'Main Custom Route') : `Alternative ${idx}`,
                  badge: idx === 0 ? 'Best' : 'Alt',
                  durationMins: durationMinutes,
                  distance: distKm,
                  sortScore: customSortScore,
                  duration: durationMinutes,
                  suggestedFare: 20,
                  steps: finalSteps
                });
              }
            }
          }

        } // End of activeTerminals loop

        // Sort all alternative options using the Smart Score to automatically pick the absolute best commuting experience
        if (sortPreference === 'cheapest') {
          allOptions.sort((a, b) => a.suggestedFare - b.suggestedFare);
        } else {
          // fastest
          allOptions.sort((a, b) => a.duration - b.duration);
        }

        // If no custom paths were found, fallback to OSRM
        if (allGeometries.length === 0) {
          const res = await axios.get(`https://router.project-osrm.org/route/v1/driving/${locLng},${locLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true&alternatives=true`);

          if (res.data.routes && res.data.routes.length > 0) {
            res.data.routes.forEach((route, idx) => {
              const coords = route.geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
              allGeometries.push([{ type: 'ride', coords, isDashed: false, category: 'car' }]);

              const distKm = (route.distance / 1000).toFixed(1);
              let durationMinutes = Math.ceil(route.duration / 60);

              // Only first route gets multi-modal expansion for MVP
              if (idx === 0) {
                allOptions = generateMultiModalRouteOptions(parseFloat(distKm), durationMinutes, destination.name ? destination.name : '', hasDiscount);
              } else {
                allOptions.push({
                  id: `osrm_${idx}`,
                  title: `Alternative Route ${idx}`,
                  badge: 'Alt',
                  durationMins: durationMinutes + 5,
                  duration: durationMinutes + 5,
                  distance: distKm,
                  suggestedFare: 100,
                  steps: [
                    { id: 'r1', type: 'ride', icon: '🚙', instruction: 'Ride alternative route', duration: durationMinutes + 5 }
                  ]
                });
              }
            });
          }
        }

        if (isMounted && allGeometries.length > 0) {
          // Apply custom ETA if exists
          try {
            const customEta = await AsyncStorage.getItem(`@custom_eta_${destination.name}`);
            if (customEta) {
              allOptions[0].durationMins = parseInt(customEta, 10);
            }
          } catch (e) { }

          setRouteOptions(allOptions);
          setSelectedRouteIndex(0);
          setEtaInfo({
            distance: allOptions[0].distance || (allOptions[0].steps ? "..." : ""),
            duration: allOptions[0].durationMins * 60,
            isCustom: false,
            destinationName: destination.name ? destination.name.split(',')[0] : 'Destination'
          });
          setGeometries(allGeometries);

          // Fit map to first route's ride coordinates or all coordinates
          if (mapRef && mapRef.current) {
            const allCoords = allGeometries[0].flatMap(seg => seg.coords);
            mapRef.current.fitToCoordinates(allCoords, {
              edgePadding: { top: 150, right: 50, bottom: 250, left: 50 },
              animated: true,
            });
          }
        }

        // Weather check
        try {
          const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${destination.latitude}&longitude=${destination.longitude}&current=precipitation,weathercode`);
          if (isMounted) {
            const current = weatherRes.data.current;
            if (current) {
              let alert = null;
              if (current.weathercode === 95 || current.weathercode === 96 || current.weathercode === 99) {
                alert = { type: 'thunderstorm', message: 'Thunderstorm expected!', icon: '⛈️' };
              } else if (current.precipitation > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(current.weathercode)) {
                alert = { type: 'rain', message: 'Rain expected. Bring an umbrella!', icon: '🌧️' };
              } else if ([71, 73, 75, 77, 85, 86].includes(current.weathercode)) {
                alert = { type: 'snow', message: 'Snow expected!', icon: '❄️' };
              } else if ([45, 48].includes(current.weathercode)) {
                alert = { type: 'fog', message: 'Foggy conditions!', icon: '🌫️' };
              }
              setWeatherAlert(alert);
            }
          }
        } catch (err) {
          console.log("Weather check failed", err);
        }
      } catch (err) {
        console.error("Route fetching error:", err);
        Alert.alert("Routing Error", "Failed to fetch route. The routing server might be down.");
      } finally {
        if (isMounted) {
          setIsCalculating(false);
        }
      }
    };

    // Yield to the main thread to allow the "Calculating Route..." spinner to render
    // before starting the heavy synchronous multi-modal route calculations.
    setTimeout(() => {
      getRoute();
    }, 100);

    return () => { isMounted = false; };
  }, [locLat, locLng, destLat, destLng, destName, selectedTerminalId, combinedPathsHash, hasDiscount, sortPreference]);

  useEffect(() => {
    if (routeOptions.length > 0) {
      const option = routeOptions[selectedRouteIndex];
      setEtaInfo(prev => prev ? { ...prev, duration: option.durationMins * 60 } : null);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    }
  }, [selectedRouteIndex]);

  const clearRoute = () => {
    setRouteOptions([]);
    setSelectedRouteIndex(0);
    setEtaInfo(null);
    setGeometries([]);
    setWeatherAlert(null);
    setIsCalculating(false);
    lastRouted.current = { locLat: null, locLng: null, destLat: null, destLng: null, selectedTerminalId: null, combinedPathsHash: null };
  };

  return { routeOptions, selectedRouteIndex, setSelectedRouteIndex, geometries, etaInfo, weatherAlert, setEtaInfo, clearRoute, isCalculating };
};
