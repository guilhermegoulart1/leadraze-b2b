// frontend/src/components/LocationMapPicker.jsx
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import { Search, MapPin, Loader } from 'lucide-react';
import { searchLocation, getIPLocation, reverseGeocode, debounce } from '../utils/nominatim';
import { parseGoogleMapsUrl, isGoogleMapsUrl } from '../utils/googleMapsParser';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon issue with Vite/Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Map events handler component
 */
const MapEventsHandler = ({ onMarkerDrag }) => {
  useMapEvents({
    click: (e) => {
      onMarkerDrag(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

/**
 * Map controller - updates map center and zoom
 */
const MapController = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  return null;
};

/**
 * Location Map Picker Component
 * Interactive map for selecting location with radius
 */
const LocationMapPicker = ({ value, onChange }) => {
  const [mapCenter, setMapCenter] = useState([20, 0]); // World center default
  const [zoom, setZoom] = useState(2);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [radius, setRadius] = useState(10); // km
  const [locationInput, setLocationInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [searching, setSearching] = useState(false);
  const mapRef = useRef();
  const abortControllerRef = useRef(null);

  // Initialize map
  useEffect(() => {
    // Only initialize if no value provided
    if (!value || (!value.lat && !value.lng)) {
      // Keep default world center
      // No initialization needed - already set in state
    } else {
      // Use provided value
      const center = [value.lat, value.lng];
      setMapCenter(center);
      setMarkerPosition(center);
      setRadius(value.radius || 10);
      setLocationName(value.location || '');
      setZoom(10);
    }
  }, []);

  // Handle marker drag
  const handleMarkerDrag = async (lat, lng) => {
    const newPos = [lat, lng];
    setMarkerPosition(newPos);
    setMapCenter(newPos);

    // Reverse geocode to get location name
    const location = await reverseGeocode(lat, lng);
    const displayName = location?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    setLocationName(displayName);

    // Notify parent
    if (onChange) {
      onChange({
        lat,
        lng,
        radius,
        location: displayName,
        city: location?.city,
        country: location?.country
      });
    }
  };

  // Handle radius change
  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);

    // Notify parent with updated radius
    if (onChange && markerPosition) {
      onChange({
        lat: markerPosition[0],
        lng: markerPosition[1],
        radius: newRadius,
        location: locationName
      });
    }
  };

  // Handle search button click
  const handleSearch = async () => {
    const query = locationInput.trim();

    if (query.length < 3) {
      return;
    }

    // Check if it's a Google Maps URL
    if (isGoogleMapsUrl(query)) {
      const parsed = parseGoogleMapsUrl(query);

      if (parsed && parsed.lat && parsed.lng) {
        handleMarkerDrag(parsed.lat, parsed.lng);
        setLocationInput('');
        setSearchResults([]);
        setShowSuggestions(false);
        return;
      }
    }

    try {
      setSearching(true);
      // Regular location search
      const results = await searchLocation(query, 5);
      setSearchResults(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle suggestion select
  const handleSelectSuggestion = (result) => {
    handleMarkerDrag(result.lat, result.lng);
    setLocationInput('');
    setSearchResults([]);
    setShowSuggestions(false);
    setZoom(12);
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar cidade ou colar link do Google Maps..."
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setShowSuggestions(searchResults.length > 0)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || locationInput.trim().length < 3}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {searching ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Buscando...
              </>
            ) : (
              'Buscar'
            )}
          </button>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && searchResults.length > 0 && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowSuggestions(false)}
            />
            <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-[350px] overflow-y-auto py-1">
              {searchResults.map((result, index) => (
                <li key={index}>
                  <button
                    onClick={() => handleSelectSuggestion(result)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start space-x-2"
                  >
                    <MapPin className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm font-medium text-gray-900 whitespace-normal leading-snug">
                        {result.display_name}
                      </p>
                      {result.importance && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {result.type}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Radius Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Raio de busca
          </label>
          <span className="text-sm font-semibold text-purple-600">
            {radius} km
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-gray-500">1km</span>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={radius}
            onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-purple"
          />
          <span className="text-xs text-gray-500">50km</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Área: ~{(Math.PI * radius * radius).toFixed(1)} km²</span>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border-2 border-gray-200" style={{ height: '400px' }}>
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
            <div className="flex flex-col items-center space-y-2">
              <Loader className="w-8 h-8 text-purple-600 animate-spin" />
              <p className="text-sm text-gray-600">Carregando mapa...</p>
            </div>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Map Controller - updates center/zoom */}
          <MapController center={mapCenter} zoom={zoom} />

          {/* Map Events */}
          <MapEventsHandler onMarkerDrag={handleMarkerDrag} />

          {/* Draggable Marker */}
          {markerPosition && (
            <>
              <Marker
                position={markerPosition}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    handleMarkerDrag(position.lat, position.lng);
                  }
                }}
              />

              {/* Radius Circle */}
              <Circle
                center={markerPosition}
                radius={radius * 1000} // Convert km to meters
                pathOptions={{
                  color: '#7c3aed',
                  fillColor: '#7c3aed',
                  fillOpacity: 0.1,
                  weight: 2
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Selected Location Display */}
      {locationName && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <MapPin className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-purple-900">{locationName}</p>
              {markerPosition && (
                <p className="text-xs text-purple-600 mt-0.5">
                  {markerPosition[0].toFixed(6)}, {markerPosition[1].toFixed(6)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS for slider */}
      <style>{`
        .slider-purple::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);
        }

        .slider-purple::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);
        }

        .slider-purple::-webkit-slider-runnable-track {
          background: linear-gradient(to right, #7c3aed 0%, #7c3aed var(--value), #e5e7eb var(--value), #e5e7eb 100%);
        }
      `}</style>
    </div>
  );
};

export default LocationMapPicker;
