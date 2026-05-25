import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import axios from 'axios';

export default function SearchBar({ onLocationSelect, onFocus, onBlur, isDarkMode, placeholder = "Where to?", initialValue = "", containerStyle, inputStyle }) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef(null);
  const colorScheme = useColorScheme();
  const isDark = typeof isDarkMode === 'boolean' ? isDarkMode : colorScheme === 'dark';

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);



  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem('@search_history');
        if (stored) setHistory(JSON.parse(stored));
      } catch (e) {}
    };
    loadHistory();
  }, []);

  const searchLocations = (text) => {
    setQuery(text);
    if (text.length < 3) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        // Nominatim Free Geocoding API
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: text,
            format: 'json',
            limit: 5,
            countrycodes: 'ph' // Limit to Philippines
          },
          headers: {
            'User-Agent': 'GoCommutePH/1.0'
          }
        });
        setResults(response.data);
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
      setLoading(false);
    }, 500); // 500ms debounce
  };

  const handleSelect = async (item) => {
    Haptics.selectionAsync(); // Apple-like subtle click
    setQuery(item.display_name.split(',')[0]); // Keep it clean
    setResults([]);
    
    // Save to history (keep top 5)
    const newHistory = [item, ...history.filter(h => h.place_id !== item.place_id)].slice(0, 5);
    setHistory(newHistory);
    try {
      await AsyncStorage.setItem('@search_history', JSON.stringify(newHistory));
    } catch(e) {}

    onLocationSelect({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      name: item.display_name
    });
  };

  const handleRemoveHistory = async (place_id) => {
    Haptics.selectionAsync();
    const newHistory = history.filter(h => h.place_id !== place_id);
    setHistory(newHistory);
    try {
      await AsyncStorage.setItem('@search_history', JSON.stringify(newHistory));
    } catch(e) {}
  };

  return (
    <View style={styles.container}>
      <View style={[styles.searchBox, isDark && styles.darkSearchBox, containerStyle]}>
        <TextInput
          style={[styles.input, isDark && styles.darkInput, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
          value={query}
          onChangeText={searchLocations}
          clearButtonMode="while-editing"
          onFocus={(e) => {
            setIsFocused(true);
            if (onFocus) onFocus(e);
          }}
          onBlur={(e) => {
            setTimeout(() => setIsFocused(false), 200);
            if (onBlur) onBlur(e);
          }}
        />
        {loading && <ActivityIndicator size="small" color="#007AFF" style={styles.loader} />}
      </View>

      {isFocused && (results.length > 0 || (query.length === 0 && history.length > 0)) && (
        <View style={[styles.resultsContainer, isDark && styles.darkResultsContainer]}>
          {query.length === 0 && history.length > 0 && (
            <Text style={styles.historyTitle}>Recent Searches</Text>
          )}
          <FlatList
            data={query.length > 0 ? results : history}
            keyExtractor={(item) => item.place_id.toString()}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View style={[styles.resultItem, isDark && styles.darkResultItem]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => handleSelect(item)} activeOpacity={0.7} hitSlop={6}>
                  <Text style={[styles.resultText, isDark && styles.darkInput]} numberOfLines={1}>
                    {item.display_name.split(',')[0]}
                  </Text>
                  <Text style={styles.resultSubtext} numberOfLines={1}>{item.display_name}</Text>
                </TouchableOpacity>
                {query.length === 0 && (
                  <TouchableOpacity style={styles.removeHistoryBtn} onPress={() => handleRemoveHistory(item.place_id)} hitSlop={10}>
                    <Text style={styles.removeHistoryText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  darkSearchBox: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  darkInput: {
    color: '#FFFFFF',
  },
  darkResultsContainer: {
    backgroundColor: '#1C1C1E',
    borderColor: '#2C2C2E',
  },
  darkResultItem: {
    borderBottomColor: '#2C2C2E',
  },
  container: {
    zIndex: 100, // Ensure dropdown floats above other items in sheet
  },
  searchBox: {
    backgroundColor: '#F2F2F7', // Waze-style solid gray contrast
    borderRadius: 100, // Google Maps pill shape
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'System',
    color: '#1C1C1E',
    paddingVertical: 14,
  },
  loader: {
    marginLeft: 8,
  },
  resultsContainer: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: 250,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  historyTitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  resultItem: {
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeHistoryBtn: {
    padding: 8,
    marginLeft: 8,
  },
  removeHistoryText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  resultText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: 'System',
    marginBottom: 2,
  },
  resultSubtext: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'System',
  },
});
