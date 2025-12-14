// frontend/src/components/LocationMiniMap.jsx
// Static mini-map component for displaying contact/lead location

import React from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon (Leaflet issue with webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const LocationMiniMap = ({ latitude, longitude, height = 150, className = '' }) => {
  // Don't render if coordinates are missing
  if (!latitude || !longitude) return null;

  // Convert to numbers if strings
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  // Validate coordinates
  if (isNaN(lat) || isNaN(lng)) return null;

  return (
    <div className={`rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height, width: '100%' }}
        zoomControl={true}
        dragging={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} />
      </MapContainer>
    </div>
  );
};

export default LocationMiniMap;
