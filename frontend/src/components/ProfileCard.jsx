import React from 'react';
import { MapPin, Building2, Briefcase, Users, CheckCircle, ExternalLink } from 'lucide-react';

const ProfileCard = ({ profile, isSelected, onToggleSelect }) => {
  return (
    <div 
      className={`bg-white rounded-xl p-6 border-2 transition-all cursor-pointer hover:shadow-lg ${
        isSelected ? 'border-purple-600 bg-purple-50' : 'border-gray-200'
      }`}
      onClick={onToggleSelect}
    >
      <div className="flex items-start space-x-4">
        
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-1">
          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected 
              ? 'bg-purple-600 border-purple-600' 
              : 'border-gray-300'
          }`}>
            {isSelected && <CheckCircle className="w-5 h-5 text-white" />}
          </div>
        </div>

        {/* Profile Picture */}
        <div className="flex-shrink-0">
          {profile.profile_picture ? (
            <img 
              src={profile.profile_picture} 
              alt={profile.name}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-xl font-bold">
              {profile.name?.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {profile.name}
                {profile.is_private && (
                  <span className="ml-2 text-xs text-gray-500">(Perfil Privado)</span>
                )}
              </h3>
              {profile.title && (
                <p className="text-sm text-gray-600 flex items-center">
                  <Briefcase className="w-4 h-4 mr-1" />
                  {profile.title}
                </p>
              )}
            </div>

            {/* Score */}
            {profile.profile_score && (
              <div className="flex flex-col items-end">
                <div className="text-xs text-gray-500 mb-1">Score</div>
                <div className={`text-lg font-bold ${
                  profile.profile_score >= 80 ? 'text-green-600' :
                  profile.profile_score >= 60 ? 'text-yellow-600' :
                  'text-gray-600'
                }`}>
                  {profile.profile_score}
                </div>
              </div>
            )}
          </div>

          {/* Company & Location */}
          <div className="space-y-1 mb-3">
            {profile.company && (
              <p className="text-sm text-gray-600 flex items-center">
                <Building2 className="w-4 h-4 mr-1" />
                {profile.company}
              </p>
            )}
            {profile.location && (
              <p className="text-sm text-gray-600 flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                {profile.location}
              </p>
            )}
            {profile.connections && (
              <p className="text-sm text-gray-600 flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {profile.connections} conexões
              </p>
            )}
          </div>

          {/* Summary */}
          {profile.summary && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
              {profile.summary}
            </p>
          )}

          {/* Tags */}
          <div className="flex items-center space-x-2 mb-3">
            {profile.industry && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {profile.industry}
              </span>
            )}
            {profile.already_lead && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                ✓ Já é Lead
              </span>
            )}
            {profile.can_get_details && !profile.hasDetailedData && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                Detalhes Disponíveis
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {profile.profile_url && (
              
                <a href={profile.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center space-x-1 px-3 py-1 text-sm text-purple-600 hover:text-purple-700 font-semibold"
              >
                <span>Ver Perfil</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfileCard;