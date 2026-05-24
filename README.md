# WazeCommuteApp (Public Transit Tracker)

A highly accurate, multi-modal public transit routing engine designed specifically to handle the complex realities of commuting in the Philippines. Unlike standard map apps that rely on generic transit data, this app introduces a **Custom Route Editor** and **Smart Multi-Modal Chaining** to handle Jeepneys, Tricycles, UV Express, Buses, and Trains with pinpoint accuracy.

## Key Features

### Smart Multi-Modal Routing
- **Intelligent Chaining**: Automatically chains different modes of transport. If your destination is far from a Jeepney drop-off, the engine will scan for nearby Tricycle terminals and seamlessly string together a `Walk ➡️ Jeep ➡️ Walk ➡️ Tricycle ➡️ Walk` route.
- **Tricycle Zone Exception**: Recognizes that tricycles operate point-to-point like local taxis. Bypasses fixed custom paths and dynamically snaps a direct route from the tricycle terminal straight to your exact destination.
- **Alternative Routes**: Calculates multiple route options for the same destination, allowing users to pick between primary and alternative transit paths.

### Developer Route Editor
- **Precision Tracing**: A built-in developer console that lets you draw directional public transit paths by tapping waypoints on the map.
- **OSRM Road-Snapping**: Automatically aligns your manually drawn waypoints strictly to the physical road network via the OSRM API, ensuring routes don't phase through buildings.
- **Drop-off Points**: Support for "1-Terminal" routes. You can name specific drop-off landmarks (e.g., "SM North") instead of requiring formal terminal-to-terminal connections.

### Path Management Console
- Easily view and delete locally saved transit routes.
- Routes are visually categorized by vehicle type inherited automatically from their origin terminals.
- Supports managing multiple "Alternative" paths for a single route.

### Minimalist UI
- **Premium Aesthetics**: Features a highly responsive Map UI with a dynamic Bottom Sheet.
- **True-Black Dark Mode**: Uses deep blacks (`#000000` and `#1C1C1E`) to mirror the sleek, high-contrast dark modes of premium navigation apps.
- **Dashed Walking Lines**: Visually distinguishes walking segments (dashed lines) from riding segments (solid lines) on the map.

## Tech Stack & Tools

* **React Native / Expo**: Core frontend framework for building the cross-platform mobile application.
* **React Native Maps**: Handles all map rendering, markers, and polyline drawing.
* **OSRM API (Open Source Routing Machine)**: Used for snapping custom drawn paths to physical roads and dynamically calculating walking/tricycle directions.
* **Supabase**: Backend database used to sync and load verified public transit terminals across devices.
* **AsyncStorage**: Currently used to store custom drawn paths, alternative routes, and user preferences locally on the device.
* **Axios**: Handles all external API requests (OSRM Routing, Open-Meteo Weather).
* **React Native Bottom Sheet / Reanimated**: Powers the smooth, interactive drag-and-snap UI panels.

## How It Works Under The Hood

1. **Path Storage**: When a developer draws a path, it is snapped to the road and saved to `AsyncStorage` under a specific ID (e.g., `route_from_[OriginID]_to_dropoff`).
2. **Routing Engine (`useRouting.js`)**: 
   - When a user searches for a destination, the engine checks if a custom path exists for the selected origin terminal.
   - It calculates walking distance to the terminal, overlays the custom transit path, and calculates the remaining distance.
   - If the remaining distance is > 1km, it actively scans the `terminals` list for a Tricycle terminal, executes a secondary OSRM request for the tricycle leg, and stitches the massive multi-leg JSON payload together for the UI to render as a single seamless journey.

## Credits
- Developed by **Neon Felix**
- Powered by open-source routing data from **OSRM / OpenStreetMap**.
