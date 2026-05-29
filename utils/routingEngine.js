// Pseudo-random generator based on a seed
const seededRandom = (seed) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// Simulates real-world traffic probability, commuter wait times, and rush hour factors
// Uses a 15-minute time bucket to keep ETAs stable within a short session
const calculateTrafficMultiplier = () => {
  const now = new Date();
  const currentHour = now.getHours();
  // 15-minute bucket seed
  const timeSeed = Math.floor(now.getTime() / (1000 * 60 * 15));
  const rand = seededRandom(timeSeed);

  // Rush hours: 7-9 AM, 5-8 PM
  const isMorningRush = currentHour >= 7 && currentHour <= 9;
  const isEveningRush = currentHour >= 17 && currentHour <= 20;
  
  if (isMorningRush) return 1.6 + (rand * 0.4); // 1.6x to 2.0x delay
  if (isEveningRush) return 1.8 + (rand * 0.5); // 1.8x to 2.3x delay
  
  // Midday traffic
  if (currentHour >= 10 && currentHour <= 16) return 1.2 + (rand * 0.3);
  
  // Late night / Early morning
  return 0.9 + (rand * 0.2); // Smooth sailing but potential slight variance
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
  // Use time bucket for stable wait times
  const timeSeed = Math.floor(new Date().getTime() / (1000 * 60 * 15));
  const rand = seededRandom(timeSeed + base);
  const variance = Math.floor(rand * base); 
  return base - (base / 2) + variance; 
};

export const generateMultiModalRouteOptions = (distanceKm, durationMins, destinationName = '', hasDiscount = false) => {
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

  let trainFare = 20 + Math.floor(distanceKm * 1.5);
  if (hasDiscount) trainFare = Math.floor(trainFare * 0.8);

  options.push({
    id: 'opt_train',
    title: 'Train Combo',
    badge: 'Fastest',
    durationMins: totalTrainTime,
    duration: totalTrainTime,
    suggestedFare: trainFare,
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

  let roadFare = isBus ? 15 + Math.floor(distanceKm * 2) : 13 + Math.floor(Math.max(0, distanceKm - 4) * 1.5);
  if (hasDiscount) roadFare = Math.floor(roadFare * 0.8);

  options.push({
    id: 'opt_road',
    title: isBus ? 'Bus Route' : 'Direct Jeepney',
    badge: 'Budget',
    durationMins: totalRoadTime,
    duration: totalRoadTime,
    suggestedFare: roadFare,
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

    let uvFare = 30 + Math.floor(distanceKm * 2.5);
    if (hasDiscount) uvFare = Math.floor(uvFare * 0.8);

    options.push({
      id: 'opt_uv',
      title: 'UV Express',
      badge: 'Comfort',
      durationMins: totalUvTime,
      duration: totalUvTime,
      suggestedFare: uvFare,
      steps: uvSteps
    });
  }

  // Sort options by fastest duration so the primary ETA is always the logical best
  return options.sort((a, b) => a.durationMins - b.durationMins);
};
