// frontend/src/components/SearchResults.jsx
import React, { useState } from 'react';
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
  Users
} from 'lucide-react';

const SearchResults = ({
  results = [],
  loading = false,
  selectedProfiles = [],
  onToggleProfile,
  hasMoreResults = false,
  loadingMore = false,
  onLoadMore,
  onBulkCollection
}) => {
  const [viewMode, setViewMode] = useState('table'); // 'table' ou 'grid'

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
        className={`bg-white rounded-lg shadow-sm p-4 border-2 transition-all cursor-pointer hover:shadow-md ${
          isSelected
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-100 hover:border-gray-300'
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
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {profile.name}
                  </h3>
                  {profile.is_premium && (
                    <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" title="Membro Premium" />
                  )}
                  {profile.verified && (
                    <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" title="Perfil Verificado" />
                  )}
                </div>

                {title && (
                  <p className="text-sm text-gray-600 truncate mb-2">
                    {title}
                  </p>
                )}

                <div className="space-y-1.5">
                  {company && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Building className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{company}</span>
                    </div>
                  )}

                  {profile.location && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{profile.location}</span>
                    </div>
                  )}

                  {/* Conexões / Seguidores */}
                  {((profile.connections || profile.connections_count) || profile.follower_count) && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Users className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <div className="flex items-center gap-2">
                        {(profile.connections || profile.connections_count) && (
                          <span>
                            <span className="font-medium text-gray-700">{profile.connections || profile.connections_count}</span> conexões
                          </span>
                        )}
                        {profile.follower_count && (
                          <>
                            {(profile.connections || profile.connections_count) && <span>•</span>}
                            <span>
                              <span className="font-medium text-gray-700">{profile.follower_count}</span> seguidores
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
                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Ver perfil no LinkedIn"
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
            ? 'bg-purple-50'
            : 'hover:bg-gray-50'
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
                <div className="font-semibold text-sm text-gray-900 truncate">
                  {profile.name}
                </div>
                {profile.is_premium && (
                  <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" title="Membro Premium" />
                )}
                {profile.verified && (
                  <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Perfil Verificado" />
                )}
              </div>
              {title && (
                <div className="text-xs text-gray-500 truncate">{title}</div>
              )}
            </div>
          </div>
        </td>

        {/* Localização */}
        <td className="px-4 py-3" style={{ width: '220px' }} onClick={() => onToggleProfile(profile)}>
          {profile.location && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{profile.location}</span>
            </div>
          )}
        </td>

        {/* Conexões / Seguidores */}
        <td className="px-4 py-3" style={{ width: '180px' }} onClick={() => onToggleProfile(profile)}>
          <div className="flex flex-col gap-1 cursor-pointer">
            {(profile.connections || profile.connections_count) && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="font-medium">{profile.connections || profile.connections_count}</span>
                <span className="text-gray-500">conexões</span>
              </div>
            )}
            {profile.follower_count && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="font-medium">{profile.follower_count}</span>
                <span className="text-gray-500">seguidores</span>
              </div>
            )}
            {!profile.connections && !profile.connections_count && !profile.follower_count && (
              <span className="text-xs text-gray-400" title="Informação não disponível">
                Não disponível
              </span>
            )}
          </div>
        </td>

        {/* Ações */}
        <td className="px-4 py-3 text-right" style={{ width: '100px' }}>
          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Ver no LinkedIn"
            >
              <Linkedin className="w-4 h-4 text-blue-600" />
            </a>
          )}
        </td>
      </tr>
    );
  };

  if (loading && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Buscando perfis...</h3>
          <p className="text-sm text-gray-500">Isso pode levar alguns segundos</p>
        </div>
      </div>
    );
  }

  if (!loading && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum perfil encontrado
          </h3>
          <p className="text-sm text-gray-600">
            Configure os filtros na barra lateral e clique em "Buscar Perfis" para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Resultados da Busca</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {results.length} {results.length === 1 ? 'perfil encontrado' : 'perfis encontrados'}
              {selectedProfiles.length > 0 && ` • ${selectedProfiles.length} selecionado${selectedProfiles.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Visualização em tabela"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Visualização em grade"
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
                Coleta em Lote
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
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase" style={{ width: '60px' }}></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase" style={{ width: '320px' }}>
                  Perfil
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase" style={{ width: '220px' }}>
                  Localização
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase" style={{ width: '180px' }}>
                  Conexões / Seguidores
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase" style={{ width: '100px' }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {results.map(profile => (
                <ProfileRow key={profile.id} profile={profile} />
              ))}
            </tbody>
          </table>
        )}

        {/* Load More Button */}
        {hasMoreResults && (
          <div className="py-8 px-6 text-center border-t border-gray-200">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-all shadow-sm"
            >
              {loadingMore && <Loader className="w-5 h-5 animate-spin" />}
              <span>{loadingMore ? 'Carregando...' : 'Carregar Mais Resultados'}</span>
              {!loadingMore && <ArrowRight className="w-5 h-5" />}
            </button>
            <p className="text-sm text-gray-500 mt-3">
              Mostrando {results.length} perfis • Clique para carregar mais
            </p>
          </div>
        )}

        {/* End of Results */}
        {!hasMoreResults && results.length > 0 && (
          <div className="py-6 text-center text-gray-500 border-t border-gray-200">
            <p className="text-sm">✓ Todos os perfis foram carregados</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
