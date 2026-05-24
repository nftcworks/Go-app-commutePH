// Simulates real-world traffic probability, commuter wait times, and rush hour factors
const calculateTrafficMultiplier = () => {
  const currentHour = new Date().getHours();
  // Rush hours: 7-9 AM, 5-8 PM
  const isMorningRush = currentHour >= 7 && currentHour <= 9;
  const isEveningRush = currentHour >= 17 && currentHour <= 20;
  
  if (isMorningRush) return 1.6 + (Math.random() * 0.4); // 1.6x to 2.0x delay
  if (isEveningRush) return 1.8 + (Math.random() * 0.5); // 1.8x to 2.3x delay
  
  // Midday traffic
  if (currentHour >= 10 && currentHour <= 16) return 1.2 + (Math.random() * 0.3);
  
  // Late night / Early morning
  return 0.9 + (Math.random() * 0.2); // Smooth sailing but potential slight variance
};

// Generates probabilistic wait times for transit vehicles
const getWaitTime = (vehicleType) => {
  const baseWait = {
    'train': 5, // Trains are relatively scheduled, 3-8 mins
    'jeep': 10, // Waiting for it to fill up, 5-15 mins
    'uv': 15,   // UV express takes longer to fill up, 10-25 mins
    'bus': 12   // Waiting for bus arrival
  };
  
  const base = baseWait[vehicleType] || 5;
  const variance = Math.floor(Math.random() * base); 
  return base - (base / 2) + variance; 
};

export const generateMultiModalRouteOptions = (distanceKm, durationMins, destinationName = '') => {
  const options = [];
  const trafficMlt = calculateTrafficMultiplier();
  
  // Option 1: Train/LRT Combo (Fastest, Immune to Traffic, High wait probability during rush hour)
  const trainWait = getWaitTime('train');
  const trainWaitRushFactor = trafficMlt > 1.6 ? trainWait * 1.5 : trainWait; // Longer lines to get IN the station
  const trainSteps = [];
  
  trainSteps.push({ id: 't1', type: 'walk', icon: '🚶', instruction: 'Walk to nearest transit stop', duration: Math.max(3, Math.floor(durationMins * 0.15)) });
  trainSteps.push({ id: 'twait', type: 'wait', icon: '⏱️', instruction: 'Wait in line / Platform', duration: Math.floor(trainWaitRushFactor) });
  trainSteps.push({ id: 't2', type: 'ride', icon: '🚆', instruction: 'Ride LRT/MRT towards destination', duration: Math.max(5, Math.floor(durationMins * 0.6)) }); // Trains don't suffer road traffic
  trainSteps.push({ id: 't3', type: 'walk', icon: '🚶', instruction: 'Walk to destination', duration: Math.max(2, Math.floor(durationMins * 0.15)) });
  
  const totalTrainTime = trainSteps.reduce((acc, step) => acc + step.duration, 0);

  options.push({
    id: 'opt_train',
    title: 'Train Combo',
    badge: 'Fastest',
    durationMins: totalTrainTime,
    steps: trainSteps
  });

  // Option 2: Direct Jeepney/Bus (Very susceptible to traffic)
  const isBus = distanceKm > 10;
  const roadWait = getWaitTime(isBus ? 'bus' : 'jeep');
  const roadSteps = [];
  
  roadSteps.push({ id: 'r1', type: 'walk', icon: '🚶', instruction: 'Walk to main road / terminal', duration: Math.max(3, Math.floor(durationMins * 0.15)) });
  roadSteps.push({ id: 'rwait', type: 'wait', icon: '⏱️', instruction: isBus ? 'Wait for Bus arrival' : 'Wait for Jeep to fill up', duration: roadWait });
  roadSteps.push({ id: 'r2', type: 'ride', icon: isBus ? '🚌' : '🚙', instruction: isBus ? 'Ride Bus towards destination' : 'Ride Jeepney towards destination', duration: Math.floor((durationMins * 0.75) * trafficMlt) }); // heavy traffic factor
  roadSteps.push({ id: 'r3', type: 'walk', icon: '🚶', instruction: 'Walk to destination', duration: Math.max(2, Math.floor(durationMins * 0.1)) });

  const totalRoadTime = roadSteps.reduce((acc, step) => acc + step.duration, 0);

  options.push({
    id: 'opt_road',
    title: isBus ? 'Bus Route' : 'Direct Jeepney',
    badge: 'Budget',
    durationMins: totalRoadTime,
    steps: roadSteps
  });

  // Option 3: UV Express (Only if distance > 5km)
  if (distanceKm > 5) {
    const uvWait = Math.floor(getWaitTime('uv') * (trafficMlt > 1.6 ? 1.4 : 1)); // Harder to get UV during rush hour
    const uvSteps = [];
    
    uvSteps.push({ id: 'u1', type: 'walk', icon: '🚶', instruction: 'Walk to UV Express Terminal', duration: Math.max(5, Math.floor(durationMins * 0.2)) });
    uvSteps.push({ id: 'uwait', type: 'wait', icon: '⏱️', instruction: 'Queue for UV Express', duration: uvWait });
    uvSteps.push({ id: 'u2', type: 'ride', icon: '🚐', instruction: 'Ride UV Express', duration: Math.floor((durationMins * 0.5) * (trafficMlt * 0.85)) }); // UVs utilize skyways sometimes, slightly less traffic penalty
    uvSteps.push({ id: 'u3', type: 'walk', icon: '🚶', instruction: 'Walk to destination', duration: Math.max(2, Math.floor(durationMins * 0.15)) });
    
    const totalUvTime = uvSteps.reduce((acc, step) => acc + step.duration, 0);

    options.push({
      id: 'opt_uv',
      title: 'UV Express',
      badge: 'Comfort',
      durationMins: totalUvTime,
      steps: uvSteps
    });
  }

  // Sort options by fastest duration so the primary ETA is always the logical best
  return options.sort((a, b) => a.durationMins - b.durationMins);
};
