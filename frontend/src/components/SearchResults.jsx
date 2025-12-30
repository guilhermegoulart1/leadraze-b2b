// frontend/src/components/SearchResults.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader,
  Search,
  MapPin,
  Building,
  Linkedin,
  ExternalLink,
  CheckCircle,
  Zap,
  ArrowRight,
  Grid,
  List,
  MoreVertical,
  Crown,
  BadgeCheck,
  Users,
  UserPlus,
  Briefcase,
  MessageCircle,
  UserCheck
} from 'lucide-react';

const SearchResults = ({
  results = [],
  loading = false,
  selectedProfiles = [],
  onToggleProfile,
  hasMoreResults = false,
  loadingMore = false,
  onLoadMore,
  onBulkCollection,
  onSendInvite,
  onStartConversation
}) => {
  const { t } = useTranslation('search');
  const [viewMode, setViewMode] = useState('table'); // 'table' ou 'grid'

  // Helper para determinar o Network Distance
  const getNetworkDistanceInfo = (profile) => {
    const dist = profile.network_distance;
    const isConnection = profile.is_connection;

    // 1º Grau (conexão direta)
    if (isConnection || dist === 1 || dist === '1' || dist === 'F' || dist === 'DISTANCE_1' || dist === 'FIRST_DEGREE') {
      return {
        label: '1º',
        isFirstDegree: true,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-300'
      };
    }

    // 2º Grau
    if (dist === 2 || dist === '2' || dist === 'S' || dist === 'DISTANCE_2' || dist === 'SECOND_DEGREE') {
      return {
        label: '2º',
        isFirstDegree: false,
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-300'
      };
    }

    // 3º Grau ou mais
    if (dist === 3 || dist === '3' || dist === 'O' || dist === 'DISTANCE_3' || dist === 'THIRD_DEGREE' || dist === 'OUT_OF_NETWORK') {
      return {
        label: '3º+',
        isFirstDegree: false,
        bgColor: 'bg-gray-100 dark:bg-gray-700',
        textColor: 'text-gray-600 dark:text-gray-400'
      };
    }

    // Se não tiver informação, não mostrar badge
    return null;
  };

  // Card View Component
  const ProfileCard = ({ profile }) => {
    const isSelected = selectedProfiles.find(p => p.id === profile.id);

    const profilePicture = profile.profile_picture ||
                          profile.profile_picture_url ||
                          profile.profile_picture_url_large ||
                          profile.picture ||
                          profile.photo ||
                          profile.image ||
                          profile.avatar ||
                          profile.photoUrl ||
                          null;

    const linkedinUrl = profile.profile_url ||
                       profile.url ||
                       profile.public_profile_url ||
                       (profile.provider_id ? `https://linkedin.com/in/${profile.provider_id}` : null);

    // Buscar empresa em múltiplos campos possíveis
    const company = profile.company ||
                   profile.current_company ||
                   (profile.current_positions && profile.current_positions.length > 0
                     ? profile.current_positions[0].company
                     : null) ||
                   profile.organization ||
                   profile.employer ||
                   null;

    // Buscar título/cargo
    const title = profile.title ||
                 profile.headline ||
                 (profile.current_positions && profile.current_positions.length > 0
                   ? profile.current_positions[0].role
                   : null) ||
                 null;

    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border-2 transition-all cursor-pointer hover:shadow-md ${
          isSelected
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
            : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
        onClick={() => onToggleProfile(profile)}
      >
        <div className="flex items-start space-x-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={profile.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-purple-200"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold"
              style={{ display: profilePicture ? 'none' : 'flex' }}
            >
              {profile.name?.charAt(0) || '?'}
            </div>

            {profile.already_lead && (
              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                Lead
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {profile.name}
                  </h3>
                  {profile.is_premium && (
                    <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" title={t('table.premiumMember')} />
                  )}
                  {profile.verified && (
                    <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" title={t('table.verifiedProfile')} />
                  )}
                  {(profile.is_open_to_work || profile.open_to_work) && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 rounded-full flex-shrink-0" title="Open to Work">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-[10px] font-medium text-green-700 dark:text-green-300">Open</span>
                    </div>
                  )}
                  {(profile.is_hiring || profile.hiring) && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex-shrink-0" title="Hiring">
                      <Briefcase className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">Hiring</span>
                    </div>
                  )}
                </div>

                {title && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-2">
                    {title}
                  </p>
                )}

                <div className="space-y-1.5">
                  {company && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <Building className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{company}</span>
                    </div>
                  )}

                  {profile.location && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{profile.location}</span>
                    </div>
                  )}

                  {/* Conexões / Seguidores */}
                  {((profile.connections || profile.connections_count) || profile.follower_count) && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Users className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <div className="flex items-center gap-2">
                        {(profile.connections || profile.connections_count) && (
                          <span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{profile.connections || profile.connections_count}</span> {t('table.connectionsLabel')}
                          </span>
                        )}
                        {profile.follower_count && (
                          <>
                            {(profile.connections || profile.connections_count) && <span>•</span>}
                            <span>
                              <span className="font-medium text-gray-700 dark:text-gray-300">{profile.follower_count}</span> {t('table.followersLabel')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-3">
                {/* Badge de Network Distance - sempre mostrar se disponível */}
                {(() => {
                  const networkInfo = getNetworkDistanceInfo(profile);
                  if (!networkInfo) return null;

                  return (
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${networkInfo.bgColor} ${networkInfo.textColor}`}>
                      {networkInfo.isFirstDegree && <UserCheck className="w-3 h-3" />}
                      {networkInfo.label}
                    </span>
                  );
                })()}

                {/* Se é conexão de 1º grau, mostrar "Iniciar Conversa", senão "Enviar Convite" */}
                {getNetworkDistanceInfo(profile)?.isFirstDegree ? (
                  // Já é conexão - mostrar "Iniciar Conversa"
                  onStartConversation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartConversation(profile);
                      }}
                      className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors group"
                      title={t('table.startConversation', 'Iniciar Conversa')}
                    >
                      <MessageCircle className="w-5 h-5 text-blue-600 group-hover:text-blue-700 dark:group-hover:text-blue-400" />
                    </button>
                  )
                ) : (
                  // Não é conexão de 1º grau - mostrar "Enviar Convite"
                  onSendInvite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendInvite(profile);
                      }}
                      className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors group"
                      title={t('table.sendInvite', 'Enviar Convite')}
                    >
                      <UserPlus className="w-5 h-5 text-purple-600 group-hover:text-purple-700 dark:group-hover:text-purple-400" />
                    </button>
                  )
                )}

                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title={t('table.viewProfile')}
                  >
                    <Linkedin className="w-5 h-5 text-blue-600" />
                  </a>
                )}

                {isSelected ? (
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                ) : (
                  <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  // Table Row Component
  const ProfileRow = ({ profile }) => {
    const isSelected = selectedProfiles.find(p => p.id === profile.id);

    const profilePicture = profile.profile_picture ||
                          profile.profile_picture_url ||
                          profile.profile_picture_url_large ||
                          profile.picture ||
                          profile.photo ||
                          profile.image ||
                          profile.avatar ||
                          profile.photoUrl ||
                          null;

    const linkedinUrl = profile.profile_url ||
                       profile.url ||
                       profile.public_profile_url ||
                       (profile.provider_id ? `https://linkedin.com/in/${profile.provider_id}` : null);

    // Buscar empresa em múltiplos campos possíveis
    const company = profile.company ||
                   profile.current_company ||
                   (profile.current_positions && profile.current_positions.length > 0
                     ? profile.current_positions[0].company
                     : null) ||
                   profile.organization ||
                   profile.employer ||
                   null;

    // Buscar título/cargo
    const title = profile.title ||
                 profile.headline ||
                 (profile.current_positions && profile.current_positions.length > 0
                   ? profile.current_positions[0].role
                   : null) ||
                 null;

    return (
      <tr
        className={`transition-colors ${
          isSelected
            ? 'bg-purple-50 dark:bg-purple-900/30'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        {/* Checkbox */}
        <td className="px-4 py-3" style={{ width: '60px' }} onClick={() => onToggleProfile(profile)}>
          {isSelected ? (
            <CheckCircle className="w-5 h-5 text-purple-600 cursor-pointer" />
          ) : (
            <div className="w-5 h-5 border-2 border-gray-300 rounded cursor-pointer" />
          )}
        </td>

        {/* Perfil */}
        <td className="px-4 py-3" style={{ width: '320px' }} onClick={() => onToggleProfile(profile)}>
          <div className="flex items-center gap-3 cursor-pointer">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={profile.name}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {profile.name?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                  {profile.name}
                </div>
                {profile.is_premium && (
                  <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" title={t('table.premiumMember')} />
                )}
                {profile.verified && (
                  <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title={t('table.verifiedProfile')} />
                )}
                {(profile.is_open_to_work || profile.open_to_work) && (
                  <div className="flex items-center gap-0.5 px-1 py-0.5 bg-green-100 dark:bg-green-900/30 rounded flex-shrink-0" title="Open to Work">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-[9px] font-medium text-green-700 dark:text-green-300">Open</span>
                  </div>
                )}
                {(profile.is_hiring || profile.hiring) && (
                  <div className="flex items-center gap-0.5 px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded flex-shrink-0" title="Hiring">
                    <Briefcase className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
              </div>
              {title && (
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{title}</div>
              )}
            </div>
          </div>
        </td>

        {/* Localização */}
        <td className="px-4 py-3" style={{ width: '220px' }} onClick={() => onToggleProfile(profile)}>
          {profile.location && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{profile.location}</span>
            </div>
          )}
        </td>

        {/* Conexões / Seguidores */}
        <td className="px-4 py-3" style={{ width: '180px' }} onClick={() => onToggleProfile(profile)}>
          <div className="flex flex-col gap-1 cursor-pointer">
            {(profile.connections || profile.connections_count) && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="font-medium">{profile.connections || profile.connections_count}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('table.connectionsLabel')}</span>
              </div>
            )}
            {profile.follower_count && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="font-medium">{profile.follower_count}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('table.followersLabel')}</span>
              </div>
            )}
            {!profile.connections && !profile.connections_count && !profile.follower_count && (
              <span className="text-xs text-gray-400" title={t('table.notAvailable')}>
                {t('table.notAvailable')}
              </span>
            )}
          </div>
        </td>

        {/* Ações */}
        <td className="px-4 py-3 text-right" style={{ width: '160px' }}>
          <div className="flex items-center justify-end gap-1">
            {/* Badge de Network Distance - sempre mostrar se disponível */}
            {(() => {
              const networkInfo = getNetworkDistanceInfo(profile);
              if (!networkInfo) return null;

              return (
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] mr-1 ${networkInfo.bgColor} ${networkInfo.textColor}`}>
                  {networkInfo.isFirstDegree && <UserCheck className="w-3 h-3" />}
                  {networkInfo.label}
                </span>
              );
            })()}

            {/* Se é conexão de 1º grau, mostrar "Iniciar Conversa", senão "Enviar Convite" */}
            {getNetworkDistanceInfo(profile)?.isFirstDegree ? (
              // Já é conexão - mostrar botão de conversa
              onStartConversation && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartConversation(profile);
                  }}
                  className="inline-flex items-center justify-center p-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors group"
                  title={t('table.startConversation', 'Iniciar Conversa')}
                >
                  <MessageCircle className="w-4 h-4 text-blue-600 group-hover:text-blue-700 dark:group-hover:text-blue-400" />
                </button>
              )
            ) : (
              // Não é conexão de 1º grau - mostrar "Enviar Convite"
              onSendInvite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendInvite(profile);
                  }}
                  className="inline-flex items-center justify-center p-2 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors group"
                  title={t('table.sendInvite', 'Enviar Convite')}
                >
                  <UserPlus className="w-4 h-4 text-purple-600 group-hover:text-purple-700 dark:group-hover:text-purple-400" />
                </button>
              )
            )}
            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={t('table.viewOnLinkedin')}
              >
                <Linkedin className="w-4 h-4 text-blue-600" />
              </a>
            )}
          </div>
        </td>
      </tr>
    );
  };

  if (loading && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-800">
        <div className="text-center">
          <Loader className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('results.loading')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('results.loadingHint')}</p>
        </div>
      </div>
    );
  }

  if (!loading && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-800">
        <div className="text-center max-w-md px-6">
          <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {t('results.noResults')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('results.noResultsHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('results.title')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {results.length === 1 ? t('results.foundSingular', { count: results.length }) : t('results.found', { count: results.length })}
              {selectedProfiles.length > 0 && ` • ${selectedProfiles.length === 1 ? t('results.selectedSingular', { count: selectedProfiles.length }) : t('results.selected', { count: selectedProfiles.length })}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title={t('results.tableView')}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title={t('results.gridView')}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            {/* Bulk Collection Button */}
            {selectedProfiles.length > 0 && onBulkCollection && (
              <button
                onClick={onBulkCollection}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium transition-all shadow-sm"
              >
                <Zap className="w-4 h-4" />
                {t('results.bulkCollection')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="p-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {results.map(profile => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          </div>
        ) : (
          /* Table View */
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase" style={{ width: '60px' }}></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase" style={{ width: '320px' }}>
                  {t('table.profile')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase" style={{ width: '220px' }}>
                  {t('table.location')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase" style={{ width: '180px' }}>
                  {t('table.connections')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase" style={{ width: '140px' }}>
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {results.map(profile => (
                <ProfileRow key={profile.id} profile={profile} />
              ))}
            </tbody>
          </table>
        )}

        {/* Load More Button */}
        {hasMoreResults && (
          <div className="py-8 px-6 text-center border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-all shadow-sm"
            >
              {loadingMore && <Loader className="w-5 h-5 animate-spin" />}
              <span>{loadingMore ? t('results.loadingMore') : t('results.loadMore')}</span>
              {!loadingMore && <ArrowRight className="w-5 h-5" />}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              {t('results.showingProfiles', { count: results.length })}
            </p>
          </div>
        )}

        {/* End of Results */}
        {!hasMoreResults && results.length > 0 && (
          <div className="py-6 text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm">✓ {t('results.allLoaded')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
