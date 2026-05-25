import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import axios from 'axios';

export const useEditorMap = () => {
  const [terminals, setTerminals] = useState([]);
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [mode, setMode] = useState('view'); // 'view', 'pin', 'draw'
  const [drawnRoute, setDrawnRoute] = useState([]);
  const [isSnapping, setIsSnapping] = useState(false);
  const [snappingProfile, setSnappingProfile] = useState('driving');

  useEffect(() => {
    fetchTerminals();
    
    // Subscribe to realtime changes
    const subscription = supabase
      .channel('public:terminals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'terminals' }, (payload) => {
        fetchTerminals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchTerminals = async () => {
    const { data, error } = await supabase.from('terminals').select('*');
    if (!error && data) {
      setTerminals(data);
      if (selectedTerminal) {
        const updated = data.find(t => t.id === selectedTerminal.id);
        if (updated) setSelectedTerminal(updated);
      }
    }
  };

  const handleMapClick = async (e) => {
    const { lat, lng } = e.latlng;
    
    if (mode === 'pin') {
      const category = window.prompt("Enter terminal category (jeepney, bus, tricycle, train):", "jeepney");
      if (!category) return;
      const label = window.prompt("Enter terminal name/label:", "New Terminal");
      
      const { error } = await supabase.from('terminals').insert([{
        category,
        label,
        latitude: lat,
        longitude: lng,
      }]);
      
      if (error) {
        alert("Failed to pin terminal: " + error.message);
      } else {
        setMode('view');
      }
    } else if (mode === 'draw') {
      if (!selectedTerminal) {
        alert("Please select a terminal from the sidebar first.");
        return;
      }
      setDrawnRoute(prev => [...prev, { latitude: lat, longitude: lng }]);
    }
  };

  const snapAndSaveRoute = async () => {
    if (drawnRoute.length < 2) {
      alert("Draw at least 2 points.");
      return;
    }
    
    setIsSnapping(true);
    try {
      // Filter out points that are practically identical to prevent OSRM loop confusion
      const filteredRoute = drawnRoute.filter((p, i) => {
        if (i === 0) return true;
        const prev = drawnRoute[i-1];
        return Math.abs(p.latitude - prev.latitude) > 0.00005 || Math.abs(p.longitude - prev.longitude) > 0.00005;
      });

      if (filteredRoute.length < 2) {
        alert("Not enough unique points to snap.");
        setIsSnapping(false);
        return;
      }

      const coordsStr = filteredRoute.map(p => `${p.longitude},${p.latitude}`).join(';');
      const extraParams = snappingProfile === 'driving' ? '&continue_straight=true' : '';
      const res = await axios.get(`https://router.project-osrm.org/route/v1/${snappingProfile}/${coordsStr}?overview=full&geometries=geojson${extraParams}`);
      
      let finalRoute = filteredRoute;
      if (res.data.routes && res.data.routes.length > 0) {
        finalRoute = res.data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
      }
      
      const dropoffName = window.prompt("Enter drop-off landmark name (e.g., SM North):", "Drop-off");
      if (!dropoffName) {
        setIsSnapping(false);
        return;
      }
      
      const routePayload = {
        coordinates: finalRoute,
        isDashed: false,
        category: selectedTerminal.category,
        dropoffName: dropoffName
      };
      
      const routeId = `route_from_${selectedTerminal.id}_to_none_${Date.now()}`;
      const currentPaths = selectedTerminal.custom_paths || {};
      currentPaths[routeId] = routePayload;
      
      const { error } = await supabase.from('terminals').update({
        custom_paths: currentPaths
      }).eq('id', selectedTerminal.id);
      
      if (error) throw error;
      
      alert("Route snapped and saved successfully!");
      setDrawnRoute([]);
      setMode('view');
      
    } catch (err) {
      console.error(err);
      alert("Failed to snap/save route. Check console for details.");
    } finally {
      setIsSnapping(false);
    }
  };

  const cancelDraw = () => {
    setDrawnRoute([]);
    setMode('view');
  };

  const startDrawing = () => {
    if (!selectedTerminal) {
      alert("Please select a terminal from the sidebar first.");
      return;
    }
    setDrawnRoute([{ latitude: selectedTerminal.latitude, longitude: selectedTerminal.longitude }]);
    setMode('draw');
  };

  const deleteRoute = async (routeId) => {
    if (!selectedTerminal || !selectedTerminal.custom_paths || !selectedTerminal.custom_paths[routeId]) return;
    
    if (!window.confirm("Are you sure you want to delete this route?")) return;
    
    const currentPaths = { ...selectedTerminal.custom_paths };
    delete currentPaths[routeId];
    
    const { error } = await supabase.from('terminals').update({
      custom_paths: currentPaths
    }).eq('id', selectedTerminal.id);
    
    if (error) {
      alert("Failed to delete route: " + error.message);
    } else {
      setSelectedTerminal({ ...selectedTerminal, custom_paths: currentPaths });
      alert("Route deleted successfully!");
    }
  };

  return {
    terminals,
    selectedTerminal,
    setSelectedTerminal,
    mode,
    setMode,
    drawnRoute,
    setDrawnRoute,
    handleMapClick,
    snapAndSaveRoute,
    cancelDraw,
    startDrawing,
    deleteRoute,
    isSnapping,
    snappingProfile,
    setSnappingProfile
  };
};
