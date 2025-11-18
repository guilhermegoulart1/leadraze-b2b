import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  MapPin,
  Building,
  Briefcase,
  Calendar,
  Trophy,
  XCircle,
  MoreVertical,
  UserPlus,
  Send,
  Target,
  CheckCircle2,
  TrendingUp,
  Mail,
  Phone
} from 'lucide-react';
import api from '../services/api';

const LeadsPage = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Configuração dos estágios do pipeline CRM
  const pipelineStages = {
    lead: {
      label: 'LEAD',
      icon: UserPlus,
      color: 'gray',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      iconColor: 'text-gray-500'
    },
    invite_sent: {
      label: 'CONVITE ENVIADO',
      icon: Send,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-500'
    },
    qualifying: {
      label: 'QUALIFICAÇÃO',
      icon: Target,
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600'
    },
    scheduled: {
      label: 'AGENDAMENTO',
      icon: Calendar,
      color: 'purple',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      iconColor: 'text-purple-500'
    },
    won: {
      label: 'GANHO',
      icon: Trophy,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600'
    },
    lost: {
      label: 'PERDIDO',
      icon: XCircle,
      color: 'red',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-500'
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const response = await api.getLeads({});

      if (response.success) {
        setLeads(response.data.leads || []);
      }
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getLeadsByStage = (stage) => {
    return filteredLeads.filter(lead => lead.status === stage);
  };

  const getStageCount = (stage) => {
    return getLeadsByStage(stage).length;
  };

  // Card de Lead no Kanban
  const LeadCard = ({ lead }) => {
    const stage = pipelineStages[lead.status] || pipelineStages.lead;
    const profilePicture = lead.profile_picture || null;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-2 hover:shadow-md transition-shadow cursor-pointer group">
        <div className="flex items-start space-x-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={lead.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold"
              style={{ display: profilePicture ? 'none' : 'flex' }}
            >
              {lead.name?.charAt(0) || '?'}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {lead.name}
            </h4>

            {lead.title && (
              <p className="text-xs text-gray-600 truncate flex items-center gap-1 mt-0.5">
                <Briefcase className="w-3 h-3" />
                {lead.title}
              </p>
            )}

            {lead.company && (
              <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                <Building className="w-3 h-3" />
                {lead.company}
              </p>
            )}

            {lead.location && (
              <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {lead.location}
              </p>
            )}

            {/* Email */}
            {lead.email && (
              <p className="text-xs text-blue-600 truncate flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" />
                {lead.email}
              </p>
            )}

            {/* Phone */}
            {lead.phone && (
              <p className="text-xs text-green-600 truncate flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" />
                {lead.phone}
              </p>
            )}

            {/* Score */}
            {lead.score > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`bg-${stage.color}-500 h-1.5 rounded-full`}
                    style={{ width: `${lead.score}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600">{lead.score}</span>
              </div>
            )}
          </div>

          {/* Menu */}
          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded">
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Data */}
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
        </div>
      </div>
    );
  };

  // Coluna do Kanban
  const KanbanColumn = ({ stage, stageKey }) => {
    const Icon = stage.icon;
    const stageLeads = getLeadsByStage(stageKey);
    const count = stageLeads.length;

    return (
      <div className={`flex-1 min-w-[280px] ${stage.bgColor} rounded-lg p-3 flex flex-col h-full`}>
        {/* Header da Coluna */}
        <div className={`flex items-center justify-between mb-3 pb-3 border-b-2 ${stage.borderColor} flex-shrink-0`}>
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${stage.iconColor}`} />
            <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wide">
              {stage.label}
            </h3>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${stage.iconColor} bg-white`}>
            {count}
          </span>
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
          {stageLeads.length > 0 ? (
            stageLeads.map(lead => (
              <LeadCard key={lead.id} lead={lead} />
            ))
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              Nenhum lead neste estágio
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Pipeline de Vendas CRM
          </h2>
          <button className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 shadow-sm text-sm">
            <Download className="w-4 h-4" />
            <span>Exportar</span>
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou empresa..."
                className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <button className="flex items-center space-x-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <div className="flex gap-3 h-full overflow-x-auto scrollbar-thin">
          {Object.entries(pipelineStages).map(([stageKey, stage]) => (
            <KanbanColumn key={stageKey} stage={stage} stageKey={stageKey} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeadsPage;
