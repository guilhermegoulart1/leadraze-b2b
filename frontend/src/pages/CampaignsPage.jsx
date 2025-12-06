// frontend/src/pages/CampaignsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Play, Pause, BarChart3, Users, Target, Calendar, Trophy, XCircle,
  Sparkles, Edit, Trash2, Rocket, RefreshCw, CheckCircle, Clock, Loader,
  Eye, TrendingUp, Activity,
  Send, UserCheck, Zap, FolderOpen
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import CampaignWizard from '../components/CampaignWizard';
import CampaignReviewModal from '../components/CampaignReviewModal';
import InviteLimitBadge from '../components/InviteLimitBadge';
import { useOnboarding } from '../contexts/OnboardingContext';

const CampaignsPage = () => {
  const { t } = useTranslation(['campaigns', 'common']);
  const { completeStep } = useOnboarding();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [collectionStatuses, setCollectionStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [loadingActions, setLoadingActions] = useState({});
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [reviewCampaign, setReviewCampaign] = useState(null);
  const [linkedinAccountId, setLinkedinAccountId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [reviewCount, setReviewCount] = useState(0);

  // Usar ref para manter referência atualizada de campaigns
  const campaignsRef = useRef(campaigns);

  // Ref para armazenar status de coleta anterior (detectar mudanças de estado)
  const previousCollectionStatusesRef = useRef({});

  // Atualizar ref sempre que campaigns mudar
  useEffect(() => {
    campaignsRef.current = campaigns;
  }, [campaigns]);

  // Completar step do onboarding quando houver campanha criada
  useEffect(() => {
    if (campaigns.length > 0) {
      completeStep('create_campaign');
    }
  }, [campaigns, completeStep]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await loadCampaigns();
        await checkCollectionStatus();
        await loadReviewCount();
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();

    const interval = setInterval(async () => {
      await loadCampaigns();
      await checkCollectionStatus();
      await loadReviewCount();
    }, 10000); // Aumentado para 10 segundos

    return () => {
      clearInterval(interval);
    };
  }, [statusFilter, pagination.page]);

  const loadCampaigns = async () => {
    try {
      console.log('📥 Loading campaigns...');
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };

      // Mapear filtros para status da API
      if (statusFilter === 'review') {
        params.status = 'draft'; // Em revisão = draft com coleta completa
      } else if (statusFilter === 'active') {
        params.status = 'active';
      } else if (statusFilter === 'completed') {
        params.status = 'completed';
      }

      const response = await api.getCampaigns(params);
      console.log('📊 Campaigns API response:', response);
      if (response.success) {
        const campaignsData = response.data.campaigns || [];
        console.log('✅ Setting campaigns:', campaignsData.length, 'campaigns');
        setCampaigns(campaignsData);
        // Atualizar ref imediatamente para checkCollectionStatus poder usar
        campaignsRef.current = campaignsData;

        // Atualizar paginação
        if (response.data.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.data.pagination.total,
            totalPages: response.data.pagination.pages,
          }));
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar campanhas:', error);
    }
  };

  const checkCollectionStatus = async () => {
    const currentCampaigns = campaignsRef.current;

    for (const campaign of currentCampaigns) {
      if (campaign.status === 'draft') {
        try {
          const statusResponse = await api.getBulkCollectionStatus(campaign.id);

          if (statusResponse.success && statusResponse.data) {
            const newStatus = statusResponse.data.status;
            const previousStatus = previousCollectionStatusesRef.current[campaign.id];

            setCollectionStatuses(prev => ({
              ...prev,
              [campaign.id]: statusResponse.data
            }));

            if (previousStatus === 'processing' && newStatus === 'completed') {
              console.log(`✅ Coleta da campanha ${campaign.name} foi concluída!`);
              await loadCampaigns();
            }

            previousCollectionStatusesRef.current[campaign.id] = newStatus;
          }
        } catch (error) {
          console.error(`Erro ao verificar status da campanha ${campaign.id}:`, error);
        }
      }
    }
  };

  const loadReviewCount = async () => {
    try {
      const response = await api.getCampaigns({ status: 'draft' });
      if (response.success && response.data.pagination) {
        setReviewCount(response.data.pagination.total || 0);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar contador de revisão:', error);
    }
  };

  const handleStartBulkCollection = async (campaignId) => {
    try {
      setLoadingActions({ ...loadingActions, [campaignId]: 'starting' });
      await api.startBulkCollection(campaignId);
      await loadCampaigns();
      checkCollectionStatus();
    } catch (error) {
      alert(error.message || t('messages.errorStartCollection'));
    } finally {
      setLoadingActions({ ...loadingActions, [campaignId]: null });
    }
  };

  const handlePauseCampaign = async (campaignId) => {
    try {
      setLoadingActions({ ...loadingActions, [campaignId]: 'pausing' });
      await api.pauseCampaign(campaignId);
      await loadCampaigns();
    } catch (error) {
      alert(error.message || t('messages.errorPause'));
    } finally {
      setLoadingActions({ ...loadingActions, [campaignId]: null });
    }
  };

  const handleResumeCampaign = async (campaignId) => {
    try {
      setLoadingActions({ ...loadingActions, [campaignId]: 'resuming' });
      await api.resumeCampaign(campaignId);
      await loadCampaigns();
    } catch (error) {
      alert(error.message || t('messages.errorResume'));
    } finally {
      setLoadingActions({ ...loadingActions, [campaignId]: null });
    }
  };

  const handleStopCampaign = async (campaignId) => {
    try {
      setLoadingActions({ ...loadingActions, [campaignId]: 'stopping' });
      await api.stopCampaign(campaignId);
      await loadCampaigns();
    } catch (error) {
      alert(error.message || t('messages.errorStop'));
    } finally {
      setLoadingActions({ ...loadingActions, [campaignId]: null });
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    try {
      setLoadingActions({ ...loadingActions, [campaignId]: 'deleting' });
      await api.deleteCampaign(campaignId);
      setDeleteConfirmation(null);
      await loadCampaigns();
    } catch (error) {
      alert(error.message || t('messages.errorDelete'));
      setLoadingActions({ ...loadingActions, [campaignId]: null });
    }
  };

  const handleActivateCampaign = async (campaignId) => {
    try {
      setLoadingActions({ ...loadingActions, [campaignId]: 'activating' });
      await api.startCampaign(campaignId);
      await loadCampaigns();
    } catch (error) {
      alert(error.message || t('messages.errorActivate'));
    } finally {
      setLoadingActions({ ...loadingActions, [campaignId]: null });
    }
  };


  const getStatusBadge = (campaign) => {
    const collectionStatus = collectionStatuses[campaign.id];

    if (collectionStatus) {
      if (collectionStatus.status === 'pending') {
        return {
          label: t('statusBadges.waiting'),
          color: 'bg-gray-500',
          textColor: 'text-gray-700 dark:text-gray-300',
          bgColor: 'bg-gray-50 dark:bg-gray-900',
          borderColor: 'border-gray-200 dark:border-gray-700',
          icon: Clock,
          iconClass: ''
        };
      }
      if (collectionStatus.status === 'processing') {
        return {
          label: t('statusBadges.collecting'),
          color: 'bg-blue-500',
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200',
          icon: RefreshCw,
          iconClass: 'animate-spin'
        };
      }
      if (collectionStatus.status === 'completed' && campaign.status === 'draft') {
        return {
          label: t('statusBadges.review'),
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: Clock,
          iconClass: ''
        };
      }
    }

    switch (campaign.status) {
      case 'active':
        return {
          label: t('status.active'),
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200',
          icon: CheckCircle,
          iconClass: ''
        };
      case 'paused':
        return {
          label: t('status.paused'),
          color: 'bg-orange-500',
          textColor: 'text-orange-700',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: Pause,
          iconClass: ''
        };
      case 'draft':
      default:
        return {
          label: t('status.draft'),
          color: 'bg-gray-500',
          textColor: 'text-gray-700 dark:text-gray-300',
          bgColor: 'bg-gray-50 dark:bg-gray-900',
          borderColor: 'border-gray-200 dark:border-gray-700',
          icon: Edit,
          iconClass: ''
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{t('messages.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Filtros Rápidos */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar por:</span>
          <div className="flex gap-2">
          <button
            onClick={() => {
              setStatusFilter('all');
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => {
              setStatusFilter('review');
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'review'
                ? 'bg-yellow-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'
            }`}
          >
            Em Revisão
            {reviewCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                statusFilter === 'review'
                  ? 'bg-yellow-700 text-white'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {reviewCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setStatusFilter('active');
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'
            }`}
          >
            Ativas
          </button>
          <button
            onClick={() => {
              setStatusFilter('completed');
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'completed'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'
            }`}
          >
            Concluídas
          </button>
          </div>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          {t('newCampaign')}
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            {pagination.total === 0 && statusFilter === 'all' ? (
              <>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Nenhuma campanha ainda</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">Crie sua primeira campanha para começar a gerar leads</p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  {t('newCampaign')}
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Nenhuma campanha {statusFilter === 'review' ? 'em revisão' : statusFilter === 'active' ? 'ativa' : statusFilter === 'completed' ? 'concluída' : ''}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Não há campanhas com este status no momento
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('table.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('table.status')}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('table.total')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {campaigns.map((campaign) => {
                  const collectionStatus = collectionStatuses[campaign.id];
                  const statusBadge = getStatusBadge(campaign);
                  const isActionLoading = loadingActions[campaign.id];

                  const isReadyToReview =
                    collectionStatus?.status === 'completed' &&
                    campaign.status === 'draft' &&
                    collectionStatus.collected_count > 0;

                  return (
                    <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                      {/* Nome da Campanha */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{campaign.name}</h3>
                          {campaign.ai_agent_name && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 rounded text-xs font-medium border border-purple-200">
                              <Sparkles className="w-3 h-3" />
                              IA
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          {campaign.ai_agent_name && (
                            <span>{t('info.agent')} {campaign.ai_agent_name}</span>
                          )}
                          {campaign.linked_accounts_count > 0 && (
                            <>
                              <span>•</span>
                              <span>{t('info.account')} {campaign.linked_accounts?.[0]?.profile_name || 'N/A'}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border w-fit ${statusBadge.bgColor} ${statusBadge.textColor} ${statusBadge.borderColor}`}>
                          <statusBadge.icon className={`w-3.5 h-3.5 ${statusBadge.iconClass}`} />
                          {statusBadge.label}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {collectionStatus?.collected_count || 0} <span className="text-gray-500 dark:text-gray-400">{t('table.of')} {collectionStatus?.target_count || 0}</span>
                        </div>
                        {collectionStatus?.status === 'processing' && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, ((collectionStatus.collected_count || 0) / (collectionStatus.target_count || 1)) * 100)}%`
                              }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {campaign.status === 'draft' && !collectionStatus && (
                            <button
                              onClick={() => handleStartBulkCollection(campaign.id)}
                              disabled={isActionLoading === 'starting'}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-xs font-medium"
                            >
                              {isActionLoading === 'starting' ? (
                                <Loader className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Rocket className="w-3.5 h-3.5" />
                              )}
                              {t('buttons.startCollection')}
                            </button>
                          )}

                          {isReadyToReview && (
                            <>
                              <button
                                onClick={() => setReviewCampaign(campaign)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {t('buttons.review')}
                              </button>
                              <button
                                onClick={() => handleActivateCampaign(campaign.id)}
                                disabled={isActionLoading === 'activating'}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-xs font-medium"
                              >
                                {isActionLoading === 'activating' ? (
                                  <Loader className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                                {t('buttons.activate')}
                              </button>
                            </>
                          )}

                          {campaign.status === 'active' && (
                            <>
                              <button
                                onClick={() => navigate(`/campaigns/${campaign.id}/report`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                                title={t('info.viewReport', 'Ver Relatório')}
                              >
                                <BarChart3 className="w-3.5 h-3.5" />
                                {t('buttons.report', 'Relatório')}
                              </button>
                              <button
                                onClick={() => handlePauseCampaign(campaign.id)}
                                disabled={isActionLoading === 'pausing'}
                                className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                                title={t('info.pauseCampaign')}
                              >
                                {isActionLoading === 'pausing' ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Pause className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}

                          {campaign.status === 'paused' && (
                            <>
                              <button
                                onClick={() => navigate(`/campaigns/${campaign.id}/report`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                                title={t('info.viewReport', 'Ver Relatório')}
                              >
                                <BarChart3 className="w-3.5 h-3.5" />
                                {t('buttons.report', 'Relatório')}
                              </button>
                              <button
                                onClick={() => handleResumeCampaign(campaign.id)}
                                disabled={isActionLoading === 'resuming'}
                                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                                title={t('info.resumeCampaign')}
                              >
                                {isActionLoading === 'resuming' ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleStopCampaign(campaign.id)}
                                disabled={isActionLoading === 'stopping'}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                title={t('info.stopCampaign')}
                              >
                                {isActionLoading === 'stopping' ? (
                                  <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setDeleteConfirmation(campaign)}
                            disabled={isActionLoading === 'deleting'}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title={t('info.deleteCampaign')}
                          >
                            {isActionLoading === 'deleting' ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Paginação */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando {campaigns.length} de {pagination.total} campanhas
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campaign Wizard Modal */}
      {showWizard && (
        <CampaignWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onCampaignCreated={() => {
            console.log('🎯 onCampaignCreated callback triggered!');
            setShowWizard(false);
            loadCampaigns();
          }}
        />
      )}

      {/* Review Modal */}
      {reviewCampaign && (
        <CampaignReviewModal
          isOpen={!!reviewCampaign}
          onClose={() => setReviewCampaign(null)}
          campaign={reviewCampaign}
          onActivate={handleActivateCampaign}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t('deleteCampaign')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('messages.confirmDeleteMessage')} <strong>"{deleteConfirmation.name}"</strong>?
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  {t('messages.confirmDeleteWarning')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmation(null)}
                disabled={loadingActions[deleteConfirmation.id] === 'deleting'}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors font-medium disabled:opacity-50"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                onClick={() => handleDeleteCampaign(deleteConfirmation.id)}
                disabled={loadingActions[deleteConfirmation.id] === 'deleting'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loadingActions[deleteConfirmation.id] === 'deleting' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {t('messages.deleting')}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {t('deleteCampaign')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
