// frontend/src/components/InstagramProfileResults.jsx
import React from 'react';
import {
  Mail,
  Phone,
  Globe,
  ExternalLink,
  MessageCircle,
  Users,
  UserCheck,
  Image,
  AtSign,
  Link2
} from 'lucide-react';

const InstagramProfileResults = ({ profiles }) => {
  if (!profiles || profiles.length === 0) {
    return null;
  }

  const formatNumber = (num) => {
    if (num == null) return null;
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    return num.toString();
  };

  const getWhatsAppLink = (phone) => {
    const clean = phone.replace(/\D/g, '');
    return `https://wa.me/${clean}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {profiles.map((profile, index) => (
        <div
          key={`${profile.username}-${index}`}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-5">
            {/* Avatar */}
            <div className="flex-shrink-0 mb-3 sm:mb-0">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-white font-bold text-lg">
                {(profile.display_name || profile.username || '?').charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {profile.display_name || profile.username}
                  </h3>
                  <div className="flex items-center text-sm text-purple-600 dark:text-purple-400">
                    <AtSign className="w-3.5 h-3.5 mr-0.5" />
                    <span>{profile.username}</span>
                  </div>
                </div>

                {/* Stats badges */}
                <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {profile.posts_count != null && (
                    <div className="flex items-center gap-1" title="Publicações">
                      <Image className="w-3.5 h-3.5" />
                      <span>{formatNumber(profile.posts_count)}</span>
                    </div>
                  )}
                  {profile.followers_count != null && (
                    <div className="flex items-center gap-1" title="Seguidores">
                      <Users className="w-3.5 h-3.5" />
                      <span>{formatNumber(profile.followers_count)}</span>
                    </div>
                  )}
                  {profile.following_count != null && (
                    <div className="flex items-center gap-1" title="Seguindo">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{formatNumber(profile.following_count)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bio */}
              {(profile.bio || profile.bio_excerpt) && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  {profile.bio || profile.bio_excerpt}
                </p>
              )}

              {/* Extracted contacts */}
              {profile.extracted_contacts && (
                profile.extracted_contacts.emails?.length > 0 ||
                profile.extracted_contacts.phones?.length > 0 ||
                profile.extracted_contacts.websites?.length > 0
              ) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  {profile.extracted_contacts.emails?.map((email, i) => (
                    <div key={`email-${i}`} className="flex items-center space-x-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <a
                        href={`mailto:${email}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                      >
                        {email}
                      </a>
                    </div>
                  ))}
                  {profile.extracted_contacts.phones?.map((phone, i) => (
                    <div key={`phone-${i}`} className="flex items-center space-x-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <a
                        href={`tel:${phone}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {phone}
                      </a>
                    </div>
                  ))}
                  {profile.extracted_contacts.websites?.map((url, i) => (
                    <div key={`web-${i}`} className="flex items-center space-x-2 text-sm">
                      <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <a
                        href={url.startsWith('http') ? url : `https://${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                      >
                        {url.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* External URL (legacy/fallback) */}
              {profile.external_url && !(profile.extracted_contacts?.websites?.length > 0) && (
                <div className="flex items-center space-x-2 text-sm mb-3">
                  <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a
                    href={profile.external_url.startsWith('http') ? profile.external_url : `https://${profile.external_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                  >
                    {profile.external_url.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                {/* Ver no Instagram */}
                <a
                  href={profile.profile_url || `https://www.instagram.com/${profile.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Ver no Instagram</span>
                </a>

                {/* WhatsApp (se tiver telefone) */}
                {profile.extracted_contacts?.phones?.length > 0 && (
                  <a
                    href={getWhatsAppLink(profile.extracted_contacts.phones[0])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>
                )}

                {/* Email */}
                {profile.extracted_contacts?.emails?.length > 0 && (
                  <a
                    href={`mailto:${profile.extracted_contacts.emails[0]}`}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>E-mail</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InstagramProfileResults;
