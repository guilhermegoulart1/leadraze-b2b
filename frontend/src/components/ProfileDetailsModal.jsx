// frontend/src/components/ProfileDetailsModal.jsx
import React from 'react';
import {
  X,
  Loader,
  MapPin,
  Building,
  Briefcase,
  Mail,
  Phone,
  Linkedin,
  ExternalLink,
  Users,
  Calendar,
  Award,
  BookOpen,
  Globe
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ProfileDetailsModal = ({ profile, loading, onClose }) => {
  const { t } = useTranslation('modals');
  if (!profile && !loading) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900">{t('profileDetails.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Loader className="w-12 h-12 text-purple-600 animate-spin mb-4" />
            <p className="text-gray-600">{t('profileDetails.loadingDetails')}</p>
          </div>
        ) : profile ? (
          <div className="p-6 space-y-6">
            {/* Aviso sobre dados limitados para perfis de 2º grau */}
            {profile.network_distance === 'SECOND_DEGREE' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                  i
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">{t('profileDetails.secondDegreeConnection')}</p>
                  <p className="text-xs text-blue-700">
                    {t('profileDetails.secondDegreeInfo')}
                  </p>
                </div>
              </div>
            )}

            {/* Profile Header */}
            <div className="flex items-start gap-6 pb-6 border-b border-gray-200">
              {/* Avatar */}
              {profile.profile_picture || profile.profile_picture_url || profile.profile_picture_url_large ? (
                <img
                  src={profile.profile_picture || profile.profile_picture_url || profile.profile_picture_url_large}
                  alt={profile.first_name || profile.name || profile.full_name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-purple-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                  {(profile.first_name || profile.name || profile.full_name)?.charAt(0) || '?'}
                </div>
              )}

              {/* Basic Info */}
              <div className="flex-1">
                <div className="flex items-start gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {profile.first_name && profile.last_name
                      ? `${profile.first_name} ${profile.last_name}`
                      : profile.name || profile.full_name || t('profileDetails.nameNotAvailable')}
                  </h3>
                  {(profile.verified || profile.is_premium) && (
                    <div className="flex items-center gap-1">
                      {profile.verified && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full" title={t('profileDetails.verified')}>
                          ✓ {t('profileDetails.verified')}
                        </span>
                      )}
                      {profile.is_premium && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full" title="Membro Premium">
                          Premium
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {(profile.headline || profile.title) && (
                  <p className="text-lg text-gray-700 mb-3">
                    {profile.headline || profile.title}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  {profile.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      {profile.location}
                    </div>
                  )}

                  {(profile.connections || profile.connections_count) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      {profile.connections || profile.connections_count} {t('profileDetails.connections')}
                    </div>
                  )}

                  {profile.follower_count && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      {profile.follower_count} {t('profileDetails.followers')}
                    </div>
                  )}

                  {(profile.profile_url || profile.public_profile_url || profile.url) && (
                    <a
                      href={profile.profile_url || profile.public_profile_url || profile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Linkedin className="w-4 h-4" />
                      {t('profileDetails.viewOnLinkedIn')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Network Distance Badge */}
                {profile.network_distance && (
                  <div className="mt-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      profile.network_distance === 'FIRST_DEGREE'
                        ? 'bg-green-100 text-green-800'
                        : profile.network_distance === 'SECOND_DEGREE'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile.network_distance === 'FIRST_DEGREE'
                        ? t('profileDetails.firstDegree')
                        : profile.network_distance === 'SECOND_DEGREE'
                        ? t('profileDetails.secondDegree')
                        : profile.network_distance === 'THIRD_DEGREE'
                        ? t('profileDetails.thirdDegree')
                        : t('profileDetails.outOfNetwork')}
                      {profile.shared_connections_count > 0 &&
                        ` • ${profile.shared_connections_count} ${profile.shared_connections_count > 1 ? t('profileDetails.sharedConnections') : t('profileDetails.sharedConnection')}`
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Summary/About */}
            {(profile.summary || profile.description || profile.about) && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  {t('profileDetails.about')}
                </h4>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {profile.summary || profile.description || profile.about}
                </p>
              </div>
            )}

            {/* Current Position */}
            {profile.current_positions && profile.current_positions.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-purple-600" />
                  {t('profileDetails.currentPosition')}
                </h4>
                <div className="space-y-3">
                  {profile.current_positions.map((position, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="font-semibold text-gray-900">{position.role || position.title}</div>
                      {position.company && (
                        <div className="flex items-center gap-2 text-gray-700 mt-1">
                          <Building className="w-4 h-4" />
                          {position.company}
                        </div>
                      )}
                      {(position.start_date || position.duration) && (
                        <div className="text-sm text-gray-600 mt-1">
                          {position.start_date && `${t('profileDetails.since')} ${position.start_date}`}
                          {position.duration && ` • ${position.duration}`}
                        </div>
                      )}
                      {position.description && (
                        <p className="text-gray-600 mt-2 text-sm">{position.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {profile.experiences && profile.experiences.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-purple-600" />
                  {t('profileDetails.experience')}
                </h4>
                <div className="space-y-3">
                  {profile.experiences.map((exp, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="font-semibold text-gray-900">{exp.role || exp.title}</div>
                      {exp.company && (
                        <div className="flex items-center gap-2 text-gray-700 mt-1">
                          <Building className="w-4 h-4" />
                          {exp.company}
                        </div>
                      )}
                      {(exp.start_date || exp.end_date || exp.duration) && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <Calendar className="w-4 h-4" />
                          {exp.start_date} {exp.end_date && `- ${exp.end_date}`}
                          {exp.duration && ` • ${exp.duration}`}
                        </div>
                      )}
                      {exp.location && (
                        <div className="text-sm text-gray-600 mt-1">{exp.location}</div>
                      )}
                      {exp.description && (
                        <p className="text-gray-600 mt-2 text-sm">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {profile.education && profile.education.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  {t('profileDetails.education')}
                </h4>
                <div className="space-y-3">
                  {profile.education.map((edu, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="font-semibold text-gray-900">{edu.school || edu.institution}</div>
                      {edu.degree && (
                        <div className="text-gray-700 mt-1">{edu.degree}</div>
                      )}
                      {edu.field_of_study && (
                        <div className="text-gray-600 mt-1">{edu.field_of_study}</div>
                      )}
                      {(edu.start_date || edu.end_date) && (
                        <div className="text-sm text-gray-600 mt-1">
                          {edu.start_date} {edu.end_date && `- ${edu.end_date}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  {t('profileDetails.skills')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full"
                    >
                      {typeof skill === 'string' ? skill : skill.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {profile.languages && profile.languages.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-600" />
                  {t('profileDetails.languages')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((lang, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                    >
                      {typeof lang === 'string' ? lang : `${lang.name}${lang.proficiency ? ` - ${lang.proficiency}` : ''}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mensagem quando não há mais informações disponíveis */}
            {profile.network_distance === 'SECOND_DEGREE' &&
             !profile.experiences?.length &&
             !profile.education?.length &&
             !profile.skills?.length && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  {t('profileDetails.additionalInfoUnavailable')}
                </h4>
                <p className="text-xs text-gray-600 max-w-md mx-auto">
                  {t('profileDetails.additionalInfoMessage')}
                </p>
              </div>
            )}

            {/* Contact Info */}
            {(profile.email || profile.phone || profile.website) && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  {t('profileDetails.contactInfo')}
                </h4>
                <div className="space-y-2">
                  {profile.email && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail className="w-4 h-4" />
                      <a href={`mailto:${profile.email}`} className="text-blue-600 hover:text-blue-700">
                        {profile.email}
                      </a>
                    </div>
                  )}
                  {profile.phone && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${profile.phone}`} className="text-blue-600 hover:text-blue-700">
                        {profile.phone}
                      </a>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Globe className="w-4 h-4" />
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                        {profile.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Raw Data Debug (optional - can be removed in production) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('profileDetails.rawData')}</h4>
                <pre className="text-xs text-gray-600 overflow-auto max-h-60">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-600">
            {t('profileDetails.noProfileSelected')}
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
          >
            {t('profileDetails.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileDetailsModal;
