// frontend/src/components/GoogleMapsResults.jsx
import React from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  ExternalLink,
  MessageCircle,
  Building2
} from 'lucide-react';

const GoogleMapsResults = ({ businesses }) => {
  if (!businesses || businesses.length === 0) {
    return null;
  }

  const renderStars = (rating) => {
    if (!rating) return null;

    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
      <div className="flex items-center space-x-1">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            className={`w-4 h-4 ${
              index < fullStars
                ? 'text-yellow-400 fill-current'
                : index === fullStars && hasHalfStar
                ? 'text-yellow-400 fill-current opacity-50'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {businesses.map((business, index) => (
        <div
          key={business.placeId || index}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-start lg:space-x-6">
            {/* Foto (se disponível) */}
            {business.photos && business.photos.length > 0 && (
              <div className="flex-shrink-0 mb-4 lg:mb-0">
                <img
                  src={business.photos[0]}
                  alt={business.name}
                  className="w-full lg:w-32 h-32 object-cover rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Conteúdo principal */}
            <div className="flex-1 min-w-0">
              {/* Cabeçalho */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {business.name}
                  </h3>

                  {/* Categoria */}
                  {business.category && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <Building2 className="w-4 h-4 mr-1" />
                      <span>{business.category}</span>
                    </div>
                  )}

                  {/* Rating */}
                  {business.rating && (
                    <div className="flex items-center space-x-3">
                      {renderStars(business.rating)}
                      {business.reviewCount > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({business.reviewCount} avaliações)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Informações de contato */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {/* Endereço */}
                {business.address && (
                  <div className="flex items-start space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {business.address}
                    </span>
                  </div>
                )}

                {/* Telefone */}
                {business.phone && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <a
                      href={`tel:${business.phone}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {business.phone}
                    </a>
                  </div>
                )}

                {/* Email */}
                {business.email && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <a
                      href={`mailto:${business.email}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      {business.email}
                    </a>
                  </div>
                )}

                {/* Website */}
                {business.website && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <a
                      href={business.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      {business.website.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  </div>
                )}
              </div>

              {/* Descrição (se disponível) */}
              {business.description && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {business.description}
                  </p>
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                {/* Ver no Google Maps */}
                {business.googleMapsUrl && (
                  <a
                    href={business.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Ver no Maps</span>
                  </a>
                )}

                {/* WhatsApp (se tiver telefone) */}
                {business.phone && (
                  <a
                    href={`https://wa.me/${business.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>
                )}

                {/* Placeholder: Criar Campanha (para Fase 2) */}
                {/*
                <button
                  onClick={() => handleCreateCampaign(business)}
                  className="inline-flex items-center space-x-2 px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                >
                  <Target className="w-4 h-4" />
                  <span>Criar Campanha</span>
                </button>
                */}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GoogleMapsResults;
