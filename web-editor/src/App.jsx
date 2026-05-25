import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEditorMap } from './hooks/useEditorMap';
import { MRT_STATIONS } from './lib/stations';
import './App.css';

// Fix Leaflet's default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getEmojiForCategory = (category) => {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('jeep')) return '🚙';
  if (cat.includes('bus')) return '🚌';
  if (cat.includes('train') || cat.includes('mrt') || cat.includes('lrt')) return '🚆';
  if (cat.includes('trike') || cat.includes('tricycle')) return '🛺';
  if (cat.includes('taxi') || cat.includes('grab')) return '🚕';
  return '📍';
};

const createEmojiIcon = (category) => {
  return L.divIcon({
    html: `<div style="font-size: 24px; background: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 2px solid #007AFF;">${getEmojiForCategory(category)}</div>`,
    className: 'custom-div-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

function MapEvents({ onClick }) {
  useMapEvents({
    click: onClick,
  });
  return null;
}

function App() {
  const {
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
  } = useEditorMap();

  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (mode === 'draw') {
          setDrawnRoute(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, setDrawnRoute]);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>Go Commute PH</h1>
          <p style={{ color: '#8E8E93', fontSize: 12, margin: 0 }}>Web Route Editor</p>
        </div>
        
        <div className="sidebar-actions">
          <button 
            className={`btn ${mode === 'view' ? 'active' : ''}`}
            onClick={() => setMode('view')}
          >
            View
          </button>
          <button 
            className={`btn ${mode === 'pin' ? 'active' : ''}`}
            onClick={() => setMode('pin')}
          >
            + Pin Terminal
          </button>
        </div>

        <div className="sidebar-content">
          {terminals.map(t => {
            const pathKeys = Object.keys(t.custom_paths || {});
            return (
              <div 
                key={t.id} 
                className={`terminal-item ${selectedTerminal?.id === t.id ? 'selected' : ''}`}
                onClick={() => setSelectedTerminal(t)}
              >
                <div className="terminal-name">{t.label || 'Unnamed Terminal'}</div>
                <div className="terminal-category">{t.category}</div>
                {pathKeys.length > 0 && (
                  <div className="terminal-paths">
                    {pathKeys.map((k, i) => {
                       const p = t.custom_paths[k];
                       const dName = p.dropoffName || (p.paths && p.paths[0]?.dropoffName) || 'Dest';
                       return <span key={i} className="path-badge">To {dName}</span>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Map Area */}
      <div className="map-container">
        {mode === 'draw' && (
          <div className="floating-overlay">
            <h3>Drawing mode active</h3>
            <p>Step 1: The starting point is automatically set.<br/>Step 2: Tap the map to trace your route.<br/>Step 3: Click "Snap & Save".</p>
            <div className="overlay-actions" style={{ flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <select 
                  className="btn" 
                  value={snappingProfile} 
                  onChange={e => setSnappingProfile(e.target.value)}
                  style={{ backgroundColor: '#F2F2F7', border: '1px solid #E5E5EA', width: 'auto' }}
                >
                  <option value="driving">Driving Mode (Highways)</option>
                  <option value="walking">Walking Mode (Ignores 1-way streets)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button className="btn active" onClick={snapAndSaveRoute} disabled={isSnapping}>
                  {isSnapping ? 'Snapping...' : 'Snap & Save'}
                </button>
                <button className="btn" style={{backgroundColor: '#FF9500', color: 'white'}} onClick={() => {
                  setDrawnRoute(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
                }}>
                  Undo
                </button>
                <button className="btn danger" onClick={cancelDraw}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {mode === 'pin' && (
          <div className="floating-overlay">
            <h3>Pinning New Terminal</h3>
            <p style={{ fontSize: 12, margin: '0 0 10px 0', color: '#8E8E93' }}>
              Click anywhere on the map to drop a pin.
            </p>
            <div className="overlay-actions">
              <button className="btn danger" onClick={() => setMode('view')}>Cancel</button>
            </div>
          </div>
        )}

        {/* View Mode Overlay */}
        {mode === 'view' && selectedTerminal && !isManageModalOpen && (
          <div className="floating-overlay">
            <h3>{selectedTerminal.label}</h3>
            <div className="overlay-actions">
              <button className="btn active" onClick={() => {
                alert("You are now in drawing mode! The starting point is automatically set to this terminal. Tap the map to continue drawing the route.");
                startDrawing();
              }}>
                + Draw Path
              </button>
              <button className="btn" style={{backgroundColor: '#E5E5EA'}} onClick={() => setIsManageModalOpen(true)}>
                Manage Paths
              </button>
              <button className="btn danger" onClick={() => setSelectedTerminal(null)}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Manage Paths Modal */}
        {isManageModalOpen && selectedTerminal && (
          <div className="modal-backdrop" onClick={() => setIsManageModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Manage Paths for {selectedTerminal.label}</h2>
                <button className="btn danger" style={{ width: 'auto' }} onClick={() => setIsManageModalOpen(false)}>✕</button>
              </div>
              
              {!selectedTerminal.custom_paths || Object.keys(selectedTerminal.custom_paths).length === 0 ? (
                <p style={{ color: '#8E8E93' }}>No custom paths have been drawn for this terminal yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(selectedTerminal.custom_paths).map(([routeId, routeData]) => (
                    <div key={routeId} className="route-list-item">
                      <div>
                        <p style={{ fontWeight: '600' }}>To: {routeData.dropoffName || "Unknown"}</p>
                        <p style={{ color: '#8E8E93', fontSize: '12px' }}>{routeData.coordinates?.length || 0} points</p>
                      </div>
                      <button 
                        className="btn danger" 
                        style={{ width: 'auto', padding: '6px 12px' }}
                        onClick={() => deleteRoute(routeId)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <MapContainer center={[14.6091, 121.0223]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onClick={handleMapClick} />
          
          {/* Terminals */}
          {terminals.map(t => (
            <Marker 
              key={t.id} 
              position={[t.latitude, t.longitude]}
              icon={createEmojiIcon(t.category)}
              eventHandlers={{
                click: () => {
                  if (mode === 'draw') {
                    setDrawnRoute(prev => [...prev, { latitude: t.latitude, longitude: t.longitude }]);
                  } else if (mode === 'view') {
                    setSelectedTerminal(t);
                  }
                }
              }}
            >
              {mode !== 'draw' && <Popup>{t.label || t.category}</Popup>}
            </Marker>
          ))}

          {/* Train Stations */}
          {MRT_STATIONS.map(station => (
            <Marker 
              key={station.id} 
              position={[station.latitude, station.longitude]}
              icon={L.divIcon({
                html: `<div style="font-size: 20px; background: white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border: 2px solid ${station.line === 'LRT-1' ? '#FFCC00' : station.line === 'LRT-2' ? '#8B5CF6' : '#5856D6'};">${station.icon}</div>`,
                className: 'custom-div-icon',
                iconSize: [26, 26],
                iconAnchor: [13, 13]
              })}
              eventHandlers={{
                click: () => {
                  if (mode === 'draw') {
                    setDrawnRoute(prev => [...prev, { latitude: station.latitude, longitude: station.longitude }]);
                  }
                }
              }}
            >
              {mode !== 'draw' && <Popup>{station.name}</Popup>}
            </Marker>
          ))}

          {/* Currently Drawing Route */}
          {drawnRoute.length > 0 && (
            <Polyline 
              positions={drawnRoute.map(p => [p.latitude, p.longitude])} 
              pathOptions={{ color: '#FF3B30', weight: 4, dashArray: '5, 10' }} 
            />
          )}

          {/* Saved Routes for Selected Terminal */}
          {selectedTerminal && selectedTerminal.custom_paths && (
            Object.values(selectedTerminal.custom_paths).map((pathObj, idx) => {
              const coords = Array.isArray(pathObj) ? pathObj : pathObj.coordinates;
              if (!coords) return null;
              return (
                <Polyline 
                  key={idx}
                  positions={coords.map(p => [p.latitude, p.longitude])} 
                  pathOptions={{ color: '#007AFF', weight: 5 }} 
                />
              )
            })
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;
