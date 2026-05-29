import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

export const useLocationTracking = (isCommuting = false) => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      // 1. Request Foreground Permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (isMounted) setErrorMsg('Permission to access location was denied');
        return;
      }

      // 2. Grab initial position for map rendering
      let initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (isMounted) setLocation(initialLocation);

      // Clean up previous subscription if it exists
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      // 3. Watch for live location updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: isCommuting ? 2000 : 10000,
          distanceInterval: isCommuting ? 5 : 15,
        },
        (newLocation) => {
          if (isMounted) setLocation(newLocation);
        }
      );
    })();

    // Cleanup: Remove watcher to prevent memory leaks and battery drain
    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [isCommuting]); // Re-run when commuting mode changes

  return { location, errorMsg };
};
