// frontend/src/components/CompanyDataTab.jsx
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
  FileText,
  Tag,
  TrendingUp,
  Building
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const CompanyDataTab = ({
  companyIdentifier,      // Company ID, name, or public identifier
  linkedinAccountId,      // LinkedIn account to use for fetching
  cnpjData = null,        // Optional CNPJ data if already available
  className = ''
}) => {
  const { t } = useTranslation(['contacts', 'common']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companyData, setCompanyData] = useState(null);

  useEffect(() => {
    if (companyIdentifier && linkedinAccountId) {
      loadCompanyData();
    }
  }, [companyIdentifier, linkedinAccountId]);

  const loadCompanyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getCompanyDetails(companyIdentifier, linkedinAccountId);
      if (response.success) {
        setCompanyData(response.data);
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
        <Loader className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (error && !companyData && !cnpjData) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">{error}</p>
        {linkedinAccountId && (
          <button
            onClick={loadCompanyData}
            className="mt-3 text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            {t('company.retry', 'Tentar novamente')}
          </button>
        )}
      </div>
    );
  }

  // If no data available at all
  if (!companyData && !cnpjData) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <Building2 className="w-10 h-10 text-gray-400 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {!linkedinAccountId
            ? t('company.selectAccount', 'Selecione uma conta LinkedIn para carregar dados da empresa')
            : t('company.noData', 'Nenhum dado de empresa disponivel')}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {/* LinkedIn Company Data Section */}
      {companyData && (
        <div className="space-y-4">
          {/* Company Header */}
          <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
            {companyData.logo ? (
              <img
                src={companyData.logo}
                alt={companyData.name}
                className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {companyData.name}
              </h3>
              {companyData.tagline && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                  {companyData.tagline}
                </p>
              )}
              {companyData.linkedin_url && (
                <a
                  href={companyData.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('company.viewOnLinkedIn', 'Ver no LinkedIn')}
                </a>
              )}
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {companyData.employee_count && (
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                <Users className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatEmployeeCount(companyData.employee_count)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('company.employees', 'Funcionarios')}
                </p>
              </div>
            )}
            {companyData.follower_count && (
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                <Star className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatFollowerCount(companyData.follower_count)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('company.followers', 'Seguidores')}
                </p>
              </div>
            )}
            {companyData.job_count && (
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                <Briefcase className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {companyData.job_count}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('company.openJobs', 'Vagas Abertas')}
                </p>
              </div>
            )}
            {companyData.founded_year && (
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {companyData.founded_year}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('company.founded', 'Fundada')}
                </p>
              </div>
            )}
          </div>

          {/* Company Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {companyData.industry && (
              <div className="flex items-center gap-3 p-3">
                <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('company.industry', 'Setor')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {Array.isArray(companyData.industry) ? companyData.industry.join(', ') : companyData.industry}
                  </p>
                </div>
              </div>
            )}
            {companyData.location && (
              <div className="flex items-center gap-3 p-3">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('company.headquarters', 'Sede')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{companyData.location}</p>
                </div>
              </div>
            )}
            {companyData.company_type && (
              <div className="flex items-center gap-3 p-3">
                <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('company.type', 'Tipo')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{companyData.company_type}</p>
                </div>
              </div>
            )}
            {companyData.website && (
              <div className="flex items-center gap-3 p-3">
                <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('company.website', 'Website')}</p>
                  <a
                    href={companyData.website.startsWith('http') ? companyData.website : `https://${companyData.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {companyData.website}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* About / Summary */}
          {companyData.summary && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                {t('company.about', 'Sobre')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                {companyData.summary}
              </p>
            </div>
          )}

          {/* Specialties */}
          {companyData.specialties && companyData.specialties.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                <Tag className="w-4 h-4 text-gray-400" />
                {t('company.specialties', 'Especialidades')}
              </h4>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(companyData.specialties) ? companyData.specialties : [companyData.specialties]).map((specialty, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full"
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
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Building2 className="w-4 h-4 text-green-600" />
            {t('company.cnpjData', 'Dados CNPJ')}
          </h4>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {cnpjData.cnpj && (
              <div className="flex justify-between p-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">CNPJ</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{cnpjData.cnpj}</span>
              </div>
            )}
            {cnpjData.razao_social && (
              <div className="flex justify-between p-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('company.legalName', 'Razao Social')}</span>
                <span className="text-sm text-gray-900 dark:text-gray-100 text-right">{cnpjData.razao_social}</span>
              </div>
            )}
            {cnpjData.nome_fantasia && (
              <div className="flex justify-between p-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('company.tradeName', 'Nome Fantasia')}</span>
                <span className="text-sm text-gray-900 dark:text-gray-100 text-right">{cnpjData.nome_fantasia}</span>
              </div>
            )}
            {cnpjData.capital_social && (
              <div className="flex justify-between p-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('company.capital', 'Capital Social')}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  R$ {typeof cnpjData.capital_social === 'number'
                    ? cnpjData.capital_social.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : cnpjData.capital_social}
                </span>
              </div>
            )}
            {cnpjData.porte && (
              <div className="flex justify-between p-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('company.size', 'Porte')}</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">{cnpjData.porte}</span>
              </div>
            )}
            {cnpjData.atividade_principal && (
              <div className="p-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  {t('company.mainActivity', 'Atividade Principal')}
                </span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {Array.isArray(cnpjData.atividade_principal)
                    ? cnpjData.atividade_principal[0]?.text || cnpjData.atividade_principal[0]
                    : cnpjData.atividade_principal}
                </span>
              </div>
            )}
          </div>

          {/* Partners / Quadro Societario */}
          {cnpjData.qsa && cnpjData.qsa.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {t('company.partners', 'Quadro Societario')}
              </h5>
              <div className="space-y-2">
                {cnpjData.qsa.map((partner, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <span className="text-sm text-gray-900 dark:text-gray-100">{partner.nome}</span>
                    {partner.qual && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{partner.qual}</span>
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
