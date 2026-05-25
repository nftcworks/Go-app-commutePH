import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

export const useTerminals = () => {
  const [incidents, setIncidents] = useState([]);
  const [dbStatus, setDbStatus] = useState('connecting');

  useEffect(() => {
    let isMounted = true;
    
    const loadTerminals = async () => {
      try {
        const localData = await AsyncStorage.getItem('@terminals_cache');
        if (localData && isMounted) {
          setIncidents(JSON.parse(localData));
        }

        const { data, error } = await supabase.from('terminals').select('*');
        if (error) throw error;
        
        if (isMounted) setDbStatus('connected');
        if (data && data.length > 0 && isMounted) {
          const loadedTerminals = data.map(t => ({
            id: t.id || t.category + Date.now(),
            category: t.category,
            label: t.label,
            route: t.route,
            latitude: t.latitude,
            longitude: t.longitude,
            custom_paths: t.custom_paths,
          }));
          setIncidents(loadedTerminals);
          await AsyncStorage.setItem('@terminals_cache', JSON.stringify(loadedTerminals));
        }
      } catch (err) {
        if (isMounted) setDbStatus('offline');
        console.log("Could not load terminals from Supabase", err);
      }
    };
    
    loadTerminals();

    // Supabase Realtime Subscription for updates
    const subscription = supabase
      .channel('public:terminals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'terminals' }, (payload) => {
        if (payload.eventType === 'INSERT') {
           setIncidents(prev => {
             const exists = prev.find(i => i.id === payload.new.id);
             if (exists) return prev;
             const newIncidents = [...prev, payload.new];
             AsyncStorage.setItem('@terminals_cache', JSON.stringify(newIncidents)).catch(e => console.log(e));
             return newIncidents;
           });
        } else if (payload.eventType === 'UPDATE') {
           setIncidents(prev => {
             const newIncidents = prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t);
             AsyncStorage.setItem('@terminals_cache', JSON.stringify(newIncidents)).catch(e => console.log(e));
             return newIncidents;
           });
        } else if (payload.eventType === 'DELETE') {
           setIncidents(prev => {
             const newIncidents = prev.filter(t => t.id !== payload.old.id);
             AsyncStorage.setItem('@terminals_cache', JSON.stringify(newIncidents)).catch(e => console.log(e));
             return newIncidents;
           });
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, []);

  const addTerminal = async (newTerminal) => {
    // Optimistic UI update
    setIncidents(prev => {
      const newIncidents = [...prev, newTerminal];
      AsyncStorage.setItem('@terminals_cache', JSON.stringify(newIncidents)).catch(e => console.log(e));
      return newIncidents;
    });

    try {
      const { error } = await supabase.from('terminals').insert([{
        category: newTerminal.category,
        label: newTerminal.label,
        route: newTerminal.route || '',
        latitude: newTerminal.latitude,
        longitude: newTerminal.longitude,
      }]);
      if (error) throw error;
    } catch (err) {
      console.log("Supabase save error", err);
      setDbStatus('offline');
    }
  };

  const removeTerminal = async (id) => {
    // Optimistic UI update
    setIncidents(prev => {
      const newIncidents = prev.filter(t => t.id !== id);
      AsyncStorage.setItem('@terminals_cache', JSON.stringify(newIncidents)).catch(e => console.log(e));
      return newIncidents;
    });

    try {
      const { error } = await supabase.from('terminals').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.log("Supabase delete error", err);
    }
  };

  const updateTerminal = async (id, updates) => {
    // Optimistic UI update
    setIncidents(prev => {
      const newIncidents = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      AsyncStorage.setItem('@terminals_cache', JSON.stringify(newIncidents)).catch(e => console.log(e));
      return newIncidents;
    });

    try {
      const { error } = await supabase.from('terminals').update(updates).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.log("Supabase update error", err);
    }
  };

  return { incidents, dbStatus, addTerminal, removeTerminal, updateTerminal };
};
