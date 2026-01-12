// frontend/src/components/MultipleLocationsManager.jsx
import React, { useState } from 'react';
import { Plus, Trash2, MapPin, Edit2, Check, X } from 'lucide-react';
import LocationMapPicker from './LocationMapPicker';

const MultipleLocationsManager = ({ locations, onChange, locationDistribution, onDistributionChange }) => {
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  const handleAddLocation = (locationData) => {
    const newLocation = {
      id: `loc-${Date.now()}`,
      ...locationData,
      current_page: 0
    };

    onChange([...locations, newLocation]);
    setIsAddingLocation(false);
  };

  const handleEditLocation = (index, locationData) => {
    const updatedLocations = [...locations];
    updatedLocations[index] = {
      ...updatedLocations[index],
      ...locationData
    };
    onChange(updatedLocations);
    setEditingIndex(null);
  };

  const handleRemoveLocation = (index) => {
    const updatedLocations = locations.filter((_, i) => i !== index);
    onChange(updatedLocations);
  };

  const getLocationLabel = (location) => {
    if (location.location) return location.location;
    if (location.city && location.country) return `${location.city}, ${location.country}`;
    if (location.city) return location.city;
    return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
  };

  return (
    <div className="space-y-4">
      {/* Distribution Mode Selection */}
      {locations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Modo de Distribuição
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                locationDistribution === 'proportional'
                  ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
              }`}
            >
              <input
                type="radio"
                name="distribution"
                checked={locationDistribution === 'proportional'}
                onChange={() => onDistributionChange('proportional')}
                className="w-4 h-4 text-blue-600"
              />
              <div className="ml-3">
                <span className="block font-medium text-gray-900 dark:text-gray-100 text-sm">
                  Proporcional
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Divide leads igualmente entre locais
                </span>
              </div>
            </label>

            <label
              className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                locationDistribution === 'sequential'
                  ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
              }`}
            >
              <input
                type="radio"
                name="distribution"
                checked={locationDistribution === 'sequential'}
                onChange={() => onDistributionChange('sequential')}
                className="w-4 h-4 text-blue-600"
              />
              <div className="ml-3">
                <span className="block font-medium text-gray-900 dark:text-gray-100 text-sm">
                  Sequencial
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Exaure um local antes do próximo
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Locations List */}
      {locations.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Localizações ({locations.length})
          </label>
          {locations.map((location, index) => (
            <div
              key={location.id || index}
              className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg"
            >
              <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {getLocationLabel(location)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {location.searchType === 'radius' && `Raio: ${location.radius || 10}km`}
                  {location.searchType === 'city' && 'Cidade inteira'}
                  {location.searchType === 'state' && 'Estado inteiro'}
                  {location.searchType === 'country' && 'País inteiro'}
                  {!location.searchType && `Raio: ${location.radius || 10}km`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingIndex(index)}
                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Editar localização"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleRemoveLocation(index)}
                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Remover localização"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Location Button */}
      {!isAddingLocation && editingIndex === null && (
        <button
          type="button"
          onClick={() => setIsAddingLocation(true)}
          className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">
            {locations.length === 0 ? 'Adicionar primeira localização' : 'Adicionar outra localização'}
          </span>
        </button>
      )}

      {/* Add/Edit Location Modal */}
      {(isAddingLocation || editingIndex !== null) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingIndex !== null ? 'Editar Localização' : 'Adicionar Localização'}
              </h3>
              <button
                onClick={() => {
                  setIsAddingLocation(false);
                  setEditingIndex(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Map Picker */}
            <div className="flex-1 overflow-y-auto p-4">
              <LocationMapPicker
                value={editingIndex !== null ? locations[editingIndex] : null}
                onChange={(locationData) => {
                  if (editingIndex !== null) {
                    handleEditLocation(editingIndex, locationData);
                  } else {
                    handleAddLocation(locationData);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      {locations.length > 0 && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
          <p className="text-sm text-purple-700 dark:text-purple-300">
            <strong>💡 Dica:</strong>{' '}
            {locationDistribution === 'proportional'
              ? 'No modo proporcional, os leads serão divididos igualmente entre todas as localizações a cada execução.'
              : 'No modo sequencial, cada localização será completamente esgotada antes de passar para a próxima.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default MultipleLocationsManager;
