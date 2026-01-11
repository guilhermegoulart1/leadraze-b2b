import React, { useState } from 'react';
import { Mail, Phone, Plus, X, MessageCircle } from 'lucide-react';
import PhoneInput, { COUNTRIES } from './PhoneInput';

// Types for phones and emails
const PHONE_TYPES = [
  { value: 'mobile', label: 'Celular' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'landline', label: 'Fixo' }
];

const EMAIL_TYPES = [
  { value: 'personal', label: 'Pessoal' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'support', label: 'Suporte' }
];

// Badge colors for types
const TYPE_COLORS = {
  // Phone types
  mobile: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  landline: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  // Email types
  personal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  commercial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  support: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
};

const PhoneEmailList = ({
  type,           // 'phone' | 'email'
  items = [],     // [{ value, type, country_code?, dial_code? }]
  onChange,       // Callback: (newItems) => void
  onStartChat,    // Callback for starting WhatsApp chat: (phoneNumber) => void
  editable = true,
  compact = false,
  showIcons = true // Show icon for each item (set to false when used inline with label icon)
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState(type === 'phone' ? 'mobile' : 'personal');
  const [newCountryCode, setNewCountryCode] = useState('BR');
  const [editingIndex, setEditingIndex] = useState(null);

  const isPhone = type === 'phone';
  const types = isPhone ? PHONE_TYPES : EMAIL_TYPES;
  const Icon = isPhone ? Phone : Mail;

  // Get country info by code
  const getCountry = (code) => COUNTRIES.find(c => c.code === code);

  // Handle adding new item
  const handleAdd = () => {
    if (!newValue.trim()) return;

    let newItem;
    if (isPhone) {
      const country = getCountry(newCountryCode);
      newItem = {
        phone: newValue.trim(),
        type: newType,
        country_code: newCountryCode,
        dial_code: country?.dialCode || '+55'
      };
    } else {
      newItem = {
        email: newValue.trim(),
        type: newType
      };
    }

    onChange([...items, newItem]);
    setNewValue('');
    setNewType(isPhone ? 'mobile' : 'personal');
    setNewCountryCode('BR');
    setShowAddForm(false);
  };

  // Handle removing item
  const handleRemove = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  // Handle updating item type
  const handleTypeChange = (index, newItemType) => {
    const newItems = items.map((item, i) =>
      i === index ? { ...item, type: newItemType } : item
    );
    onChange(newItems);
    setEditingIndex(null);
  };

  // Get value from item (phone or email)
  const getValue = (item) => item.phone || item.email || item.value || '';

  // Format phone for display with dial code
  const formatPhoneDisplay = (item) => {
    const phone = item.phone || item.value || '';
    const dialCode = item.dial_code || '';
    if (dialCode && !phone.startsWith('+')) {
      return `${dialCode} ${phone}`;
    }
    return phone;
  };

  if (items.length === 0 && !editable) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Items List */}
      {items.map((item, index) => {
        const value = getValue(item);
        const itemType = item.type || (isPhone ? 'mobile' : 'personal');
        const typeConfig = types.find(t => t.value === itemType) || types[0];
        const country = isPhone && item.country_code ? getCountry(item.country_code) : null;

        return (
          <div
            key={index}
            className={`flex items-center gap-2 group ${
              compact ? 'py-1' : 'py-1.5'
            }`}
          >
            {/* Icon or Flag */}
            {showIcons && (
              isPhone && country ? (
                <img
                  src={country.flag}
                  alt={country.name}
                  className="w-5 h-4 object-cover rounded-sm flex-shrink-0"
                  title={`${country.name} (${country.dialCode})`}
                />
              ) : (
                <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              )
            )}

            {/* Value - Clickable */}
            {isPhone ? (
              <a
                href={`tel:${item.dial_code || ''}${value.replace(/\D/g, '')}`}
                className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium truncate"
              >
                {formatPhoneDisplay(item)}
              </a>
            ) : (
              <a
                href={`mailto:${value}`}
                className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium truncate"
              >
                {value}
              </a>
            )}

            {/* Type Badge */}
            <div className="relative">
              {editable && editingIndex === index ? (
                <select
                  value={itemType}
                  onChange={(e) => handleTypeChange(index, e.target.value)}
                  onBlur={() => setEditingIndex(null)}
                  autoFocus
                  className="text-xs px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  {types.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => editable && setEditingIndex(index)}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[itemType] || TYPE_COLORS.mobile} ${
                    editable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                  }`}
                >
                  {typeConfig.label}
                </button>
              )}
            </div>

            {/* WhatsApp Button (for phones) */}
            {isPhone && onStartChat && (itemType === 'mobile' || itemType === 'whatsapp') && (
              <button
                type="button"
                onClick={() => onStartChat(value)}
                className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                title="Iniciar conversa WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            )}

            {/* Remove Button */}
            {editable && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remover"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {/* Add Form */}
      {editable && showAddForm && (
        <div className="py-2 px-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          {isPhone ? (
            /* Phone Input with Country Selector and Type on same line */
            <div className="flex items-center gap-2">
              <PhoneInput
                value={newValue}
                onChange={setNewValue}
                countryCode={newCountryCode}
                onCountryChange={setNewCountryCode}
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex-shrink-0"
              >
                {types.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newValue.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewValue('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
              >
                Cancelar
              </button>
            </div>
          ) : (
            /* Email Input with Type on same line */
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="email"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') {
                    setShowAddForm(false);
                    setNewValue('');
                  }
                }}
                autoFocus
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex-shrink-0"
              >
                {types.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newValue.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewValue('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Button */}
      {editable && !showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors py-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Adicionar {isPhone ? 'telefone' : 'email'}</span>
        </button>
      )}
    </div>
  );
};

export default PhoneEmailList;
