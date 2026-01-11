import React, { useState } from 'react';

/**
 * ContactAvatar - Shows contact photo with fallback to initials
 * Handles image loading errors gracefully
 */
const ContactAvatar = ({ photoUrl, name, size = 'md', updatedAt }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 1) {
      // Se só tem um nome, pega as 2 primeiras letras
      return parts[0].substring(0, 2).toUpperCase();
    }
    // Pega primeira letra do primeiro nome + primeira letra do segundo nome
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials(name);

  // Show initials fallback
  const showFallback = !photoUrl || imageError;

  // Build URL with cache-busting that handles existing query params
  const getImageUrl = (url) => {
    if (!url || !url.startsWith('http')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_cb=${updatedAt || Date.now()}`;
  };

  return (
    <div className={`relative ${sizeClass} rounded-full flex-shrink-0`}>
      {/* Image */}
      {photoUrl && !imageError && (
        <img
          src={getImageUrl(photoUrl)}
          alt={name || 'Contact'}
          className={`${sizeClass} rounded-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
          onLoad={() => setImageLoading(false)}
          referrerPolicy="no-referrer"
        />
      )}

      {/* Initials fallback - shown when no image, image error, or while loading */}
      {(showFallback || imageLoading) && (
        <div
          className={`absolute inset-0 ${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold ${imageLoading && photoUrl && !imageError ? 'animate-pulse' : ''}`}
        >
          {initials}
        </div>
      )}
    </div>
  );
};

export default ContactAvatar;
