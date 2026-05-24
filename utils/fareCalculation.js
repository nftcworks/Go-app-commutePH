/**
 * Calculates the estimated fare based on transport mode and distance.
 * 
 * Jeepney Default: ₱13 for the first 4km, +₱1.50 per succeeding km.
 * Bus (Aircon) Default: ₱15 for the first 5km, +₱2.65 per succeeding km.
 * UV Express Default: ~₱2.00 per km (usually flat rates apply but estimating).
 * Tricycle Default: ₱20 base for 1km, +₱5 per succeeding km.
 * Train (MRT): ₱13 base + distance-based, capping at ~₱28.
 * 
 * @param {number} distanceKm Distance in kilometers
 * @param {string} mode Transport mode string
 * @returns {number} Estimated fare in PHP
 */
export const calculateFare = (distanceKm, mode = 'Jeepney') => {
  if (!distanceKm || distanceKm <= 0) return 0;
  
  const dist = parseFloat(distanceKm);
  let fare = 0;

  switch (mode.toLowerCase()) {
    case 'jeep':
    case 'jeepney':
      fare = 13 + (dist > 4 ? Math.ceil(dist - 4) * 1.5 : 0);
      break;
    
    case 'bus':
      fare = 15 + (dist > 5 ? Math.ceil(dist - 5) * 2.65 : 0);
      break;
    
    case 'uv':
    case 'uv express':
      fare = 20 + Math.ceil(dist) * 2;
      break;
      
    case 'tricycle':
      fare = 20 + (dist > 1 ? Math.ceil(dist - 1) * 5 : 0);
      break;

    case 'train':
    case 'train (mrt/lrt)':
      fare = 13 + Math.ceil(dist) * 1;
      if (fare > 28) fare = 28;
      break;

    default:
      // Default to Jeepney rates if unknown
      fare = 13 + (dist > 4 ? Math.ceil(dist - 4) * 1.5 : 0);
      break;
  }
  
  return Math.round(fare);
};
