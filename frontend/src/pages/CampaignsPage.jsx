// frontend/src/pages/CampaignsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
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

const CampaignsPage = () => {
  const { t } = useTranslation(['campaigns', 'common']);
  const [campaigns, setCampaigns] = useState([]);
  const [collectionStatuses, setCollectionStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [loadingActions, setLoadingActions] = useState({});
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [reviewCampaign, setReviewCampaign] = useState(null);
  const [linkedinAccountId, setLinkedinAccountId] = useState(null);

  // Usar ref para manter referência atualizada de campaigns
  const campaignsRef = useRef(campaigns);

  // Ref para armazenar status de coleta anterior (detectar mudanças de estado)
  const previousCollectionStatusesRef = useRef({});

  // Atualizar ref sempre que campaigns mudar
  useEffect(() => {
    campaignsRef.current = campaigns;
  }, [campaigns]);

  // Calcular estatísticas gerais
  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    totalLeads: campaigns.reduce((sum, c) => sum + Number(c.total_leads || 0), 0),
    leadsWon: campaigns.reduce((sum, c) => sum + Number(c.leads_won || 0), 0),
  };

  useEffect(() => {
    loadCampaigns();
    checkCollectionStatus();

    const interval = setInterval(() => {
      loadCampaigns();
      checkCollectionStatus();
    }, 10000); // Aumentado para 10 segundos

    return () => {
      clearInterval(interval);
    };
  }, []);

  const loadCampaigns = async () => {
    try {
      console.log('📥 Loading campaigns...');
      const response = await api.getCampaigns();
      console.log('📊 Campaigns API response:', response);
      if (response.success) {
        console.log('✅ Setting campaigns:', response.data.campaigns?.length || 0, 'campaigns');
        setCampaigns(response.data.campaigns || []);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar campanhas:', error);
    } finally {
      setIsLoading(false);
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
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: Clock,
          iconClass: ''
        };
      }
      if (collectionStatus.status === 'processing') {
        return {
          label: t('statusBadges.collecting'),
          color: 'bg-blue-500',
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
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
          bgColor: 'bg-green-50',
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
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: Edit,
          iconClass: ''
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t('messages.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('messages.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          {t('newCampaign')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('stats.total')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCampaigns}</p>
            </div>
            <FolderOpen className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('stats.active')}</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeCampaigns}</p>
            </div>
            <Zap className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('stats.totalLeads')}</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalLeads}</p>
            </div>
            <Users className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('stats.qualified')}</p>
              <p className="text-2xl font-bold text-blue-600">{stats.leadsWon}</p>
            </div>
            <Trophy className="w-8 h-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noCampaigns')}</h3>
            <p className="text-gray-500 mb-4">{t('createFirst')}</p>
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('newCampaign')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('table.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('table.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('table.total')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('table.qualified')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('table.scheduled')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('table.won')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('table.lost')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('table.conversionRate')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((campaign) => {
                  const collectionStatus = collectionStatuses[campaign.id];
                  const statusBadge = getStatusBadge(campaign);
                  const isActionLoading = loadingActions[campaign.id];

                  const isReadyToReview =
                    collectionStatus?.status === 'completed' &&
                    campaign.status === 'draft' &&
                    collectionStatus.collected_count > 0;

                  // Calcular taxa de conversão
                  const conversionRate = campaign.total_leads > 0
                    ? ((campaign.leads_won / campaign.total_leads) * 100).toFixed(1)
                    : '0.0';

                  return (
                    <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                      {/* Nome da Campanha */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                          {campaign.ai_agent_name && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium border border-purple-200">
                              <Sparkles className="w-3 h-3" />
                              IA
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
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
                        <div className="text-sm font-medium text-gray-900">
                          {campaign.total_leads || 0} <span className="text-gray-500">{t('table.of')} {collectionStatus?.target_count || campaign.total_leads || 0}</span>
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

                      {/* Qualificados */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-purple-600">
                          {campaign.leads_won || 0}
                        </span>
                      </td>

                      {/* Agendados */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-blue-600">
                          {campaign.leads_scheduled || 0}
                        </span>
                      </td>

                      {/* Ganhos */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-green-600">
                          {campaign.leads_won || 0}
                        </span>
                      </td>

                      {/* Perdidos */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-red-600">
                          {campaign.leads_lost || 0}
                        </span>
                      </td>

                      {/* Conversão % */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-gray-900">
                          {conversionRate}%
                        </span>
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
                                onClick={() => handleResumeCampaign(campaign.id)}
                                disabled={isActionLoading === 'resuming'}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
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
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('deleteCampaign')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('messages.confirmDeleteMessage')} <strong>"{deleteConfirmation.name}"</strong>?
                </p>
                <p className="text-sm text-red-600 mt-2">
                  {t('messages.confirmDeleteWarning')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmation(null)}
                disabled={loadingActions[deleteConfirmation.id] === 'deleting'}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
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
