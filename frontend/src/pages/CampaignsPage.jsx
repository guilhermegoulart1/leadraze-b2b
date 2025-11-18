// frontend/src/pages/CampaignsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Play, Pause, BarChart3, Users, Target, Calendar, Trophy, XCircle,
  Sparkles, Edit, Trash2, Rocket, RefreshCw, CheckCircle, Clock, Loader,
  Eye, ChevronDown, ChevronRight, TrendingUp, Activity,
  Send, UserCheck, Zap, FolderOpen
} from 'lucide-react';
import api from '../services/api';
import CampaignWizard from '../components/CampaignWizard';
import CampaignReviewModal from '../components/CampaignReviewModal';
import InviteLimitBadge from '../components/InviteLimitBadge';

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [collectionStatuses, setCollectionStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [loadingActions, setLoadingActions] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
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
    const interval = setInterval(() => {
      loadCampaigns();
      checkCollectionStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await api.getCampaigns();
      if (response.success) {
        setCampaigns(response.data.campaigns || []);
      }
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
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
      alert(error.message || 'Erro ao iniciar coleta');
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
      alert(error.message || 'Erro ao pausar campanha');
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
      alert(error.message || 'Erro ao retomar campanha');
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
      alert(error.message || 'Erro ao parar campanha');
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
      alert(error.message || 'Erro ao deletar campanha');
      setLoadingActions({ ...loadingActions, [campaignId]: null });
    }
  };

  const handleActivateCampaign = async (campaignId) => {
    try {
      setLoadingActions({ ...loadingActions, [campaignId]: 'activating' });
      await api.startCampaign(campaignId);
      await loadCampaigns();
    } catch (error) {
      alert(error.message || 'Erro ao ativar campanha');
    } finally {
      setLoadingActions({ ...loadingActions, [campaignId]: null });
    }
  };

  const toggleRow = (campaignId) => {
    setExpandedRows({
      ...expandedRows,
      [campaignId]: !expandedRows[campaignId]
    });
  };

  const getStatusBadge = (campaign) => {
    const collectionStatus = collectionStatuses[campaign.id];

    if (collectionStatus) {
      if (collectionStatus.status === 'pending') {
        return {
          label: 'Aguardando',
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
          label: 'Coletando...',
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
          label: 'Revisar',
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
          label: 'Ativa',
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: CheckCircle,
          iconClass: ''
        };
      case 'paused':
        return {
          label: 'Pausada',
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
          label: 'Rascunho',
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
          <p className="text-gray-600">Carregando campanhas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie suas campanhas de prospecção</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Nova Campanha
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCampaigns}</p>
            </div>
            <FolderOpen className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Ativas</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeCampaigns}</p>
            </div>
            <Zap className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Leads</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalLeads}</p>
            </div>
            <Users className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Qualificados</p>
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma campanha criada</h3>
            <p className="text-gray-500 mb-4">Crie sua primeira campanha para começar a prospectar</p>
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nova Campanha
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {campaigns.map((campaign) => {
              const collectionStatus = collectionStatuses[campaign.id];
              const isExpanded = expandedRows[campaign.id];
              const statusBadge = getStatusBadge(campaign);
              const isActionLoading = loadingActions[campaign.id];

              const isReadyToReview =
                collectionStatus?.status === 'completed' &&
                campaign.status === 'draft' &&
                collectionStatus.collected_count > 0;

              return (
                <div key={campaign.id} className="border-b border-gray-100 last:border-b-0 group">
                  <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      {/* Campaign Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <button
                          onClick={() => toggleRow(campaign.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge.bgColor} ${statusBadge.textColor} ${statusBadge.borderColor}`}>
                              <statusBadge.icon className={`w-3.5 h-3.5 ${statusBadge.iconClass}`} />
                              {statusBadge.label}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {campaign.total_leads || 0} leads
                            </span>
                            {campaign.ai_agent_name && (
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-4 h-4" />
                                {campaign.ai_agent_name}
                              </span>
                            )}
                            {campaign.linked_accounts_count > 0 && (
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-4 h-4" />
                                {campaign.linked_accounts_count} conta(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
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
                            Iniciar
                          </button>
                        )}

                        {isReadyToReview && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setReviewCampaign(campaign)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Revisar
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
                              Ativar
                            </button>
                            <button
                              onClick={() => setDeleteConfirmation(campaign)}
                              disabled={isActionLoading === 'deleting'}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-xs font-medium"
                              title="Excluir campanha"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {campaign.status === 'active' && (
                          <>
                            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePauseCampaign(campaign.id)}
                              disabled={isActionLoading === 'pausing'}
                              className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Pausar campanha"
                            >
                              {isActionLoading === 'pausing' ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Pause className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmation(campaign)}
                              disabled={isActionLoading === 'deleting'}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Excluir campanha"
                            >
                              {isActionLoading === 'deleting' ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
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
                              title="Retomar campanha"
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
                              title="Parar campanha"
                            >
                              {isActionLoading === 'stopping' ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Informações</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Tipo:</span>
                              <span className="font-medium text-gray-900">
                                {campaign.type === 'automatic' ? 'Automática' : 'Manual'}
                              </span>
                            </div>
                            {campaign.description && (
                              <div>
                                <span className="text-gray-500">Descrição:</span>
                                <p className="text-gray-900 mt-1">{campaign.description}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Estatísticas</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Enviados:</span>
                              <span className="font-medium text-blue-600">{campaign.leads_sent || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Aceitos:</span>
                              <span className="font-medium text-green-600">{campaign.leads_accepted || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Qualificados:</span>
                              <span className="font-medium text-purple-600">{campaign.leads_won || 0}</span>
                            </div>
                          </div>
                        </div>

                        {collectionStatus && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Coleta</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Progresso:</span>
                                <span className="font-medium text-gray-900">
                                  {collectionStatus.collected_count || 0} / {collectionStatus.target_count || 0}
                                </span>
                              </div>
                              {collectionStatus.status === 'processing' && (
                                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${((collectionStatus.collected_count || 0) / (collectionStatus.target_count || 1)) * 100}%`
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {campaign.linked_accounts && campaign.linked_accounts.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Contas LinkedIn</h4>
                          <div className="flex flex-wrap gap-2">
                            {campaign.linked_accounts.map((account) => (
                              <div
                                key={account.id}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                              >
                                <UserCheck className="w-4 h-4 text-purple-500" />
                                <span className="font-medium">{account.profile_name}</span>
                                <span className="text-gray-500">({account.daily_limit || 0}/dia)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign Wizard Modal */}
      {showWizard && (
        <CampaignWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onCampaignCreated={() => {
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
                  Excluir Campanha
                </h3>
                <p className="text-sm text-gray-600">
                  Tem certeza que deseja excluir a campanha <strong>"{deleteConfirmation.name}"</strong>?
                </p>
                <p className="text-sm text-red-600 mt-2">
                  Esta ação não pode ser desfeita. Todos os leads coletados para esta campanha também serão removidos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmation(null)}
                disabled={loadingActions[deleteConfirmation.id] === 'deleting'}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteCampaign(deleteConfirmation.id)}
                disabled={loadingActions[deleteConfirmation.id] === 'deleting'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loadingActions[deleteConfirmation.id] === 'deleting' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Excluir Campanha
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
