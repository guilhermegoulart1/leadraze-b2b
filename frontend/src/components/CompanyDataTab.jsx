// frontend/src/components/CompanyDataTab.jsx
// Company data display with LinkedIn enrichment support
import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Users,
  Globe,
  Briefcase,
  Calendar,
  Star,
  ExternalLink,
  Loader,
  AlertCircle,
  Tag,
  TrendingUp,
  Building,
  RefreshCw,
  Clock,
  Linkedin
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

// Section Title Component (matches other tabs style)
const SectionTitle = ({ icon: Icon, title, iconColor = 'text-purple-500' }) => (
  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
    <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
    {title}
  </h4>
);

// Format relative time
const formatRelativeTime = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'agora mesmo';
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem atrás`;
  return date.toLocaleDateString('pt-BR');
};

const CompanyDataTab = ({
  contactId,           // Contact ID to load company data
  cnpjData = null,     // Optional CNPJ data if already available
  className = ''
}) => {
  const { t } = useTranslation(['contacts', 'common']);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [canEnrich, setCanEnrich] = useState(false);
  const [companyName, setCompanyName] = useState(null);

  useEffect(() => {
    if (contactId) {
      // Always bust cache on load to get fresh data after enrichment
      loadCompanyData(true);
    }
  }, [contactId]);

  const loadCompanyData = async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      // Add timestamp to bust cache when needed
      const response = await api.getContactCompany(contactId, bustCache ? Date.now() : null);
      // Backend wraps data in response.data
      const data = response.data || response;
      if (response.success) {
        setCompanyData(data.company);
        setCanEnrich(data.can_enrich);
        setCompanyName(data.company_name);
      } else {
        setError(response.message || 'Erro ao carregar dados da empresa');
      }
    } catch (err) {
      console.error('Error loading company data:', err);
      setError(err.message || 'Erro ao carregar dados da empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrich = async () => {
    if (!contactId) return;
    setEnriching(true);
    setError(null);
    try {
      const response = await api.enrichContactCompany(contactId, { force: true });
      // Backend wraps data in response.data
      const data = response.data || response;
      if (response.success && data.company) {
        setCompanyData(data.company);
        setCanEnrich(true);
      } else if (data.skipped) {
        // Show message from backend and reload to get latest data (bust cache)
        if (response.message) {
          setError(response.message);
        }
        await loadCompanyData(true);
      } else {
        setError(response.message || 'Erro ao enriquecer dados da empresa');
      }
    } catch (err) {
      console.error('Error enriching company:', err);
      setError(err.message || 'Erro ao enriquecer dados da empresa');
    } finally {
      setEnriching(false);
    }
  };

  // Parse JSON values that might be strings or arrays
  const parseJsonValue = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [value];
      }
    }
    return [value];
  };

  // Format array values for display
  const formatArrayValue = (value) => {
    const arr = parseJsonValue(value);
    if (!arr || arr.length === 0) return null;
    return arr.join(', ');
  };

  // Format employee count
  const formatEmployeeCount = (count) => {
    if (!count) return null;
    if (typeof count === 'string') return count;
    if (count >= 10000) return `${(count / 1000).toFixed(0)}k+`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  // Format follower count
  const formatFollowerCount = (count) => {
    if (!count) return null;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader className="w-6 h-6 text-purple-500 animate-spin" />
      </div>
    );
  }

  // If no data available at all
  if (!companyData && !cnpjData) {
    return (
      <div className={`space-y-5 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Dados da Empresa
            </span>
          </div>
          {/* Show button if can enrich OR has company name (backend will search by name) */}
          {(canEnrich || companyName) && (
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${enriching ? 'animate-spin' : ''}`} />
              {enriching ? 'Buscando...' : 'Buscar dados'}
            </button>
          )}
        </div>

        {/* Empty state */}
        <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
          <Building2 className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {companyName || 'Nenhuma empresa associada'}
          </p>
          {(canEnrich || companyName) ? (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              Clique em "Buscar dados" para enriquecer via LinkedIn
            </p>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              Enriqueça o perfil do contato na aba "Perfil LinkedIn" para obter dados da empresa
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Dados da Empresa
          </span>
          {companyData?.linkedin_company_id && (
            <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {companyData?.enriched_at && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatRelativeTime(companyData.enriched_at)}
            </span>
          )}
          {canEnrich && (
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${enriching ? 'animate-spin' : ''}`} />
              {enriching ? 'Atualizando...' : 'Atualizar'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* LinkedIn Company Data */}
      {companyData && (
        <div className="space-y-4">
          {/* Company Header */}
          <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700">
            {companyData.logo ? (
              <img
                src={companyData.logo}
                alt={companyData.name}
                className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-600 bg-white"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {companyData.name}
              </h3>
              {companyData.tagline && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                  {companyData.tagline}
                </p>
              )}
              {companyData.linkedin_url && (
                <a
                  href={companyData.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Ver no LinkedIn
                </a>
              )}
            </div>
          </div>

          {/* Stats */}
          {(companyData.employee_count || companyData.follower_count || companyData.founded_year) && (
            <div className="flex flex-wrap items-center gap-4 py-2 border-b border-gray-100 dark:border-gray-700">
              {companyData.employee_count && (
                <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <strong className="text-gray-700 dark:text-gray-300">
                    {formatEmployeeCount(companyData.employee_count)}
                  </strong>
                  funcionários
                </span>
              )}
              {companyData.follower_count && (
                <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-gray-400" />
                  <strong className="text-gray-700 dark:text-gray-300">
                    {formatFollowerCount(companyData.follower_count)}
                  </strong>
                  seguidores
                </span>
              )}
              {companyData.founded_year && (
                <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  Fundada em
                  <strong className="text-gray-700 dark:text-gray-300">
                    {companyData.founded_year}
                  </strong>
                </span>
              )}
            </div>
          )}

          {/* Details */}
          <div className="pt-2">
            <SectionTitle icon={TrendingUp} title="Informações" />
            <div className="space-y-2">
              {companyData.industry && (
                <div className="flex items-start gap-2.5 py-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500">Setor</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      {formatArrayValue(companyData.industry)}
                    </p>
                  </div>
                </div>
              )}
              {companyData.location && (
                <div className="flex items-start gap-2.5 py-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500">Sede</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">{companyData.location}</p>
                  </div>
                </div>
              )}
              {companyData.company_type && (
                <div className="flex items-start gap-2.5 py-1.5">
                  <Building className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500">Tipo</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">{companyData.company_type}</p>
                  </div>
                </div>
              )}
              {companyData.website && (
                <div className="flex items-start gap-2.5 py-1.5">
                  <Globe className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500">Website</p>
                    <a
                      href={companyData.website.startsWith('http') ? companyData.website : `https://${companyData.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {companyData.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* About / Summary */}
          {companyData.summary && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <SectionTitle icon={Briefcase} title="Sobre" />
              <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line line-clamp-6">
                {companyData.summary}
              </p>
            </div>
          )}

          {/* Specialties */}
          {companyData.specialties && companyData.specialties.length > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <SectionTitle icon={Tag} title="Especialidades" />
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(companyData.specialties) ? companyData.specialties : [companyData.specialties]).map((specialty, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[11px] rounded"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CNPJ Data Section (Brazil) */}
      {cnpjData && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <SectionTitle icon={Building2} title="Dados CNPJ" />
          <div className="space-y-2">
            {cnpjData.cnpj && (
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-500">CNPJ</span>
                <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{cnpjData.cnpj}</span>
              </div>
            )}
            {cnpjData.razao_social && (
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-500">Razão Social</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 text-right max-w-[60%] truncate">
                  {cnpjData.razao_social}
                </span>
              </div>
            )}
            {cnpjData.nome_fantasia && (
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-500">Nome Fantasia</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 text-right max-w-[60%] truncate">
                  {cnpjData.nome_fantasia}
                </span>
              </div>
            )}
            {cnpjData.capital_social && (
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-500">Capital Social</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  R$ {typeof cnpjData.capital_social === 'number'
                    ? cnpjData.capital_social.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : cnpjData.capital_social}
                </span>
              </div>
            )}
            {cnpjData.porte && (
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-500">Porte</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">{cnpjData.porte}</span>
              </div>
            )}
            {cnpjData.atividade_principal && (
              <div className="py-1.5">
                <span className="text-[10px] text-gray-500 dark:text-gray-500 block mb-1">
                  Atividade Principal
                </span>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {Array.isArray(cnpjData.atividade_principal)
                    ? cnpjData.atividade_principal[0]?.text || cnpjData.atividade_principal[0]
                    : cnpjData.atividade_principal}
                </span>
              </div>
            )}
          </div>

          {/* Partners / Quadro Societario */}
          {cnpjData.qsa && cnpjData.qsa.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-[10px] text-gray-500 dark:text-gray-500 mb-2">Quadro Societário</p>
              <div className="space-y-1.5">
                {cnpjData.qsa.slice(0, 5).map((partner, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 px-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{partner.nome}</span>
                    {partner.qual && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                        {partner.qual}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanyDataTab;
