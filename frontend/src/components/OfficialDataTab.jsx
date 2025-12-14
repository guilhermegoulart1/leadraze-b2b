import React from 'react';
import {
  Building2, MapPin, Calendar, DollarSign, Briefcase,
  Users, FileText, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * OfficialDataTab - Exibe dados oficiais da empresa (ReceitaWS/CNPJ)
 *
 * @param {Object} props
 * @param {string} props.cnpj - CNPJ formatado
 * @param {Object} props.cnpjData - Dados completos do ReceitaWS (parsed from JSON)
 */
const OfficialDataTab = ({ cnpj, cnpjData }) => {
  const { t } = useTranslation('contacts');

  // Parse cnpjData if it's a string
  const data = typeof cnpjData === 'string' ? JSON.parse(cnpjData) : cnpjData;

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{t('officialData.noData')}</p>
      </div>
    );
  }

  // Format capital social
  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Format: DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return dateStr;
    }
    // Try ISO format
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Get status color and icon
  const getStatusInfo = (situacao) => {
    const status = situacao?.toUpperCase() || '';
    if (status.includes('ATIVA')) {
      return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle };
    }
    if (status.includes('BAIXADA') || status.includes('INATIVA')) {
      return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircle };
    }
    return { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: AlertCircle };
  };

  const statusInfo = getStatusInfo(data.situacao);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      {/* Header com status */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-5 h-5" />
          <h3 className="font-semibold">{t('officialData.title')}</h3>
        </div>
        <p className="text-sm text-blue-100">
          {t('officialData.source')}
        </p>
      </div>

      {/* Status da empresa */}
      <div className={`flex items-center gap-3 p-3 rounded-lg ${statusInfo.bg}`}>
        <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
        <div>
          <p className={`font-medium ${statusInfo.color}`}>{data.situacao}</p>
          {data.dataSituacao && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('officialData.since')}: {formatDate(data.dataSituacao)}
            </p>
          )}
        </div>
      </div>

      {/* Informacoes principais */}
      <div className="space-y-4">
        {/* CNPJ */}
        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-gray-400 mt-1" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('officialData.cnpj')}</p>
            <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{cnpj || data.cnpj}</p>
          </div>
        </div>

        {/* Razao Social */}
        <div className="flex items-start gap-3">
          <Building2 className="w-4 h-4 text-gray-400 mt-1" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('officialData.razaoSocial')}</p>
            <p className="text-sm text-gray-900 dark:text-gray-100">{data.razaoSocial || '-'}</p>
          </div>
        </div>

        {/* Nome Fantasia */}
        {data.nomeFantasia && (
          <div className="flex items-start gap-3">
            <Building2 className="w-4 h-4 text-gray-400 mt-1" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('officialData.nomeFantasia')}</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">{data.nomeFantasia}</p>
            </div>
          </div>
        )}

        {/* Data de Abertura */}
        <div className="flex items-start gap-3">
          <Calendar className="w-4 h-4 text-gray-400 mt-1" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('officialData.openDate')}</p>
            <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(data.dataAbertura)}</p>
          </div>
        </div>

        {/* Capital Social */}
        {data.capitalSocial && (
          <div className="flex items-start gap-3">
            <DollarSign className="w-4 h-4 text-gray-400 mt-1" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('officialData.capitalSocial')}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(data.capitalSocial)}</p>
              {data.porte && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{data.porte}</p>
              )}
            </div>
          </div>
        )}

        {/* Endereco */}
        {data.endereco && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-gray-400 mt-1" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('officialData.address')}</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {data.endereco.logradouro}{data.endereco.numero ? `, ${data.endereco.numero}` : ''}
                {data.endereco.complemento ? ` - ${data.endereco.complemento}` : ''}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {data.endereco.bairro} - {data.endereco.municipio}/{data.endereco.uf}
              </p>
              {data.endereco.cep && (
                <p className="text-xs text-gray-500 dark:text-gray-400">CEP: {data.endereco.cep}</p>
              )}
            </div>
          </div>
        )}

        {/* Atividade Principal */}
        {data.atividadePrincipal && (
          <div className="flex items-start gap-3">
            <Briefcase className="w-4 h-4 text-gray-400 mt-1" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('officialData.mainActivity')}</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {data.atividadePrincipal.text || data.atividadePrincipal.code}
              </p>
              {data.atividadePrincipal.code && (
                <p className="text-xs text-gray-500 dark:text-gray-400">CNAE: {data.atividadePrincipal.code}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quadro Societario (QSA) */}
      {data.qsa && data.qsa.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-400" />
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t('officialData.partners')} ({data.qsa.length})
            </h4>
          </div>
          <div className="space-y-2">
            {data.qsa.slice(0, 5).map((partner, idx) => (
              <div
                key={idx}
                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm"
              >
                <p className="font-medium text-gray-900 dark:text-gray-100">{partner.nome}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{partner.qualificacao}</p>
              </div>
            ))}
            {data.qsa.length > 5 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                +{data.qsa.length - 5} {t('officialData.morePartners')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer com data de atualizacao */}
      {data._fetchedAt && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-2">
          {t('officialData.lastUpdate')}: {new Date(data._fetchedAt).toLocaleDateString('pt-BR')}
        </p>
      )}
    </div>
  );
};

export default OfficialDataTab;
