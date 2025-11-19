import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  MapPin,
  Building,
  Briefcase,
  Calendar as CalendarIcon,
  Trophy,
  XCircle,
  MoreVertical,
  UserPlus,
  Send,
  Target,
  CheckCircle2,
  Eye,
  Edit,
  Trash2,
  Mail,
  Phone,
  List as ListIcon,
  LayoutGrid,
  Plus,
  ChevronUp,
  ChevronDown,
  FileText,
  AlertCircle,
  Crown,
  Star,
  Users,
  UserCheck,
  ExternalLink,
  X,
  Linkedin,
  Globe,
  GraduationCap,
  Award,
  Languages,
  FileText as FileTextIcon,
  Clock
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../services/api';

const LeadsPage = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // kanban, list, calendar
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedLead, setSelectedLead] = useState(null); // For details modal

  // Pipeline stages matching backend
  const pipelineStages = {
    leads: {
      label: 'Novos Leads',
      color: 'slate',
      icon: UserPlus
    },
    invite_sent: {
      label: 'Convite Enviado',
      color: 'blue',
      icon: Send
    },
    qualifying: {
      label: 'Qualificando',
      color: 'amber',
      icon: Target
    },
    qualified: {
      label: 'Qualificado',
      color: 'emerald',
      icon: CheckCircle2
    },
    discarded: {
      label: 'Descartado',
      color: 'red',
      icon: XCircle
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
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getLeadsByStage = (stage) => {
    return filteredLeads.filter(lead => lead.status === stage);
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // Dropped outside the list
    if (!destination) return;

    // No movement
    if (source.droppableId === destination.droppableId) return;

    const leadId = parseInt(draggableId.replace('lead-', ''));
    const newStatus = destination.droppableId;

    // Optimistic update
    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      )
    );

    // Update on backend
    try {
      await api.updateLeadStatus(leadId, newStatus);
      console.log(`✅ Lead ${leadId} movido para ${newStatus}`);
    } catch (error) {
      console.error('Erro ao atualizar lead:', error);
      // Revert on error
      loadLeads();
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // Handle null/undefined values
    if (!aVal) return 1;
    if (!bVal) return -1;

    // String comparison
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal?.toLowerCase() || '';
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Lead Card Component
  const LeadCard = ({ lead, index }) => {
    const stage = pipelineStages[lead.status] || pipelineStages.leads;
    const profilePicture = lead.profile_picture || null;
    const isOrganic = lead.campaign_name?.toLowerCase().includes('organic');
    const isDraft = lead.campaign_status === 'draft';

    return (
      <Draggable draggableId={`lead-${lead.id}`} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`bg-white rounded-lg border border-gray-200 p-3 mb-2.5 hover:shadow-lg transition-all cursor-move group ${
              snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-400 rotate-2' : 'shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt={lead.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-100"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shadow-md"
                  style={{ display: profilePicture ? 'none' : 'flex' }}
                >
                  {lead.name?.charAt(0) || '?'}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate mb-1">
                  {lead.name}
                </h4>

                {lead.title && (
                  <p className="text-xs text-gray-600 truncate flex items-center gap-1.5 mb-0.5">
                    <Briefcase className="w-3 h-3 text-gray-400" />
                    {lead.title}
                  </p>
                )}

                {lead.company && (
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mb-0.5">
                    <Building className="w-3 h-3 text-gray-400" />
                    {lead.company}
                  </p>
                )}
              </div>

              {/* View Details */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLead(lead);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-50 rounded flex-shrink-0"
                title="Ver detalhes"
              >
                <Eye className="w-4 h-4 text-blue-600" />
              </button>
            </div>

            {/* Campaign & Draft Badge */}
            {!isOrganic && lead.campaign_name && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-50 border border-purple-200 rounded max-w-full">
                  <FileText className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />
                  <span className="text-purple-700 font-medium text-[10px] leading-tight truncate">
                    {lead.campaign_name}
                  </span>
                </div>
                {isDraft && lead.status === 'leads' && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded flex-shrink-0">
                    <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                    <span className="text-amber-700 font-semibold text-[10px] leading-tight">Rascunho</span>
                  </div>
                )}
              </div>
            )}

            {/* Profile Badges & Stats */}
            {(lead.is_premium || lead.is_creator || lead.is_influencer || lead.connections_count > 0 || lead.follower_count > 0) && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                {/* Badges */}
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {lead.is_premium && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded" title="LinkedIn Premium">
                      <Crown className="w-2.5 h-2.5 text-amber-600" />
                      <span className="text-amber-700 font-semibold text-[9px] leading-tight">Premium</span>
                    </div>
                  )}
                  {lead.is_creator && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 border border-blue-300 rounded" title="Creator Mode">
                      <Star className="w-2.5 h-2.5 text-blue-600" />
                      <span className="text-blue-700 font-semibold text-[9px] leading-tight">Creator</span>
                    </div>
                  )}
                  {lead.is_influencer && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-50 border border-purple-300 rounded" title="LinkedIn Influencer">
                      <Star className="w-2.5 h-2.5 text-purple-600 fill-purple-600" />
                      <span className="text-purple-700 font-semibold text-[9px] leading-tight">Influencer</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-2 text-[10px] text-gray-600">
                  {lead.connections_count > 0 && (
                    <div className="flex items-center gap-0.5" title={`${lead.connections_count} conexões`}>
                      <Users className="w-3 h-3 text-gray-500" />
                      <span className="font-medium">{lead.connections_count.toLocaleString()}</span>
                    </div>
                  )}
                  {lead.follower_count > 0 && (
                    <div className="flex items-center gap-0.5" title={`${lead.follower_count} seguidores`}>
                      <UserCheck className="w-3 h-3 text-gray-500" />
                      <span className="font-medium">{lead.follower_count.toLocaleString()}</span>
                    </div>
                  )}
                  {lead.public_identifier && (
                    <a
                      href={`https://www.linkedin.com/in/${lead.public_identifier}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-blue-600 hover:text-blue-700 hover:underline ml-auto"
                      title="Ver perfil no LinkedIn"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="font-medium">Perfil</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Contact Info */}
            {(lead.email || lead.phone) && (
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                {lead.email && (
                  <p className="text-xs text-gray-600 truncate flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-blue-500" />
                    {lead.email}
                  </p>
                )}

                {lead.phone && (
                  <p className="text-xs text-gray-600 truncate flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-emerald-500" />
                    {lead.phone}
                  </p>
                )}
              </div>
            )}

            {/* Tags - if any */}
            {lead.tags && lead.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {lead.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${tag.colorClass || 'bg-gray-100 text-gray-700'}`}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Footer - Date */}
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
              {new Date(lead.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  // Kanban Column
  const KanbanColumn = ({ stage, stageKey }) => {
    const Icon = stage.icon;
    const stageLeads = getLeadsByStage(stageKey);
    const count = stageLeads.length;

    return (
      <div className="flex-1 min-w-[320px] flex flex-col">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 text-${stage.color}-600`} />
            <h3 className="font-semibold text-sm text-gray-700">
              {stage.label}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold bg-${stage.color}-100 text-${stage.color}-700`}>
              {count}
            </span>
          </div>
          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Droppable Area with Internal Scroll */}
        <Droppable droppableId={stageKey}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 rounded-lg p-2 transition-colors overflow-y-auto scrollbar-thin ${
                snapshot.isDraggingOver ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50'
              }`}
              style={{
                maxHeight: 'calc(100vh - 280px)',
                minHeight: '400px'
              }}
            >
              {stageLeads.length > 0 ? (
                stageLeads.map((lead, index) => (
                  <LeadCard key={lead.id} lead={lead} index={index} />
                ))
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                  {snapshot.isDraggingOver ? 'Solte aqui' : 'Nenhum lead'}
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    );
  };

  // Table Header Component with Sorting
  const TableHeader = ({ field, label }) => {
    const isActive = sortField === field;
    return (
      <th
        className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {isActive && (
            sortDirection === 'asc' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )
          )}
        </div>
      </th>
    );
  };

  // List View Component
  const ListView = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <TableHeader field="name" label="Lead" />
              <TableHeader field="company" label="Empresa" />
              <TableHeader field="email" label="Contato" />
              <TableHeader field="campaign_name" label="Campanha" />
              <TableHeader field="status" label="Estágio" />
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tags
              </th>
              <TableHeader field="created_at" label="Data" />
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedLeads.map((lead) => {
              const stage = pipelineStages[lead.status] || pipelineStages.leads;
              const isOrganic = lead.campaign_name?.toLowerCase().includes('organic');
              const isDraft = lead.campaign_status === 'draft';

              return (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {lead.profile_picture ? (
                        <img
                          src={lead.profile_picture}
                          alt={lead.name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          {lead.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="min-w-0 max-w-[250px]">
                        <div className="font-semibold text-sm text-gray-900 truncate">{lead.name}</div>
                        {lead.title && (
                          <div className="text-xs text-gray-500 truncate" title={lead.title}>
                            {lead.title}
                          </div>
                        )}

                        {/* Profile Badges & Stats */}
                        {(lead.is_premium || lead.is_creator || lead.is_influencer || lead.connections_count > 0 || lead.follower_count > 0) && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {/* Badges */}
                            {lead.is_premium && (
                              <div className="flex items-center gap-0.5 px-1 py-0.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded" title="LinkedIn Premium">
                                <Crown className="w-2 h-2 text-amber-600" />
                                <span className="text-amber-700 font-semibold text-[8px] leading-tight">Premium</span>
                              </div>
                            )}
                            {lead.is_creator && (
                              <div className="flex items-center gap-0.5 px-1 py-0.5 bg-blue-50 border border-blue-300 rounded" title="Creator Mode">
                                <Star className="w-2 h-2 text-blue-600" />
                                <span className="text-blue-700 font-semibold text-[8px] leading-tight">Creator</span>
                              </div>
                            )}
                            {lead.is_influencer && (
                              <div className="flex items-center gap-0.5 px-1 py-0.5 bg-purple-50 border border-purple-300 rounded" title="LinkedIn Influencer">
                                <Star className="w-2 h-2 text-purple-600 fill-purple-600" />
                                <span className="text-purple-700 font-semibold text-[8px] leading-tight">Influencer</span>
                              </div>
                            )}

                            {/* Stats */}
                            {lead.connections_count > 0 && (
                              <div className="flex items-center gap-0.5 text-[9px] text-gray-600" title={`${lead.connections_count} conexões`}>
                                <Users className="w-2.5 h-2.5 text-gray-500" />
                                <span className="font-medium">{lead.connections_count > 999 ? `${(lead.connections_count / 1000).toFixed(1)}k` : lead.connections_count}</span>
                              </div>
                            )}
                            {lead.follower_count > 0 && (
                              <div className="flex items-center gap-0.5 text-[9px] text-gray-600" title={`${lead.follower_count} seguidores`}>
                                <UserCheck className="w-2.5 h-2.5 text-gray-500" />
                                <span className="font-medium">{lead.follower_count > 999 ? `${(lead.follower_count / 1000).toFixed(1)}k` : lead.follower_count}</span>
                              </div>
                            )}
                            {lead.public_identifier && (
                              <a
                                href={`https://www.linkedin.com/in/${lead.public_identifier}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-blue-600 hover:text-blue-700 text-[9px]"
                                title="Ver perfil no LinkedIn"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {lead.company && (
                      <div className="text-sm text-gray-700 truncate max-w-[180px]" title={lead.company}>
                        {lead.company}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="space-y-0.5 max-w-[200px]">
                      {lead.email && (
                        <div className="text-xs text-gray-600 flex items-center gap-1.5 truncate" title={lead.email}>
                          <Mail className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="text-xs text-gray-600 flex items-center gap-1.5 truncate" title={lead.phone}>
                          <Phone className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {!isOrganic && lead.campaign_name && (
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 border border-purple-200 rounded text-xs max-w-[150px]" title={lead.campaign_name}>
                          <FileText className="w-3 h-3 text-purple-600 flex-shrink-0" />
                          <span className="text-purple-700 font-medium truncate">
                            {lead.campaign_name}
                          </span>
                        </div>
                        {isDraft && lead.status === 'leads' && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs flex-shrink-0" title="Esta campanha está em modo rascunho">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span className="text-amber-700 font-semibold">Rascunho</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-${stage.color}-100 text-${stage.color}-700`}>
                      {stage.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {lead.tags && lead.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${tag.colorClass || 'bg-gray-100 text-gray-700'}`}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {lead.tags && lead.tags.length > 2 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          +{lead.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedLead(lead)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Editar">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Calendar View Component (placeholder)
  const CalendarView = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center text-gray-500">
          <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">Visualização de Calendário</p>
          <p className="text-xs mt-1">Em desenvolvimento...</p>
        </div>
      </div>
    );
  };

  // Lead Details Modal Component
  const LeadDetailsModal = ({ lead, onClose }) => {
    if (!lead) return null;

    const stage = pipelineStages[lead.status] || pipelineStages.leads;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              {lead.profile_picture ? (
                <img src={lead.profile_picture} alt={lead.name} className="w-16 h-16 rounded-full border-2 border-white object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-2xl font-bold border-2 border-white">
                  {lead.name?.charAt(0) || '?'}
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{lead.name}</h2>
                {lead.title && <p className="text-blue-100 mt-1">{lead.title}</p>}
                {lead.company && (
                  <div className="flex items-center gap-1.5 mt-1 text-blue-100">
                    <Building className="w-4 h-4" />
                    <span>{lead.company}</span>
                  </div>
                )}
                {lead.location && (
                  <div className="flex items-center gap-1.5 mt-1 text-blue-100">
                    <MapPin className="w-4 h-4" />
                    <span>{lead.location}</span>
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Main Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Status & Badges */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Status & Classificação</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-${stage.color}-100 text-${stage.color}-700`}>
                      {stage.label}
                    </span>
                    {lead.is_premium && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full">
                        <Crown className="w-4 h-4 text-amber-600" />
                        <span className="text-amber-700 font-semibold text-sm">LinkedIn Premium</span>
                      </div>
                    )}
                    {lead.is_creator && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-300 rounded-full">
                        <Star className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-700 font-semibold text-sm">Creator Mode</span>
                      </div>
                    )}
                    {lead.is_influencer && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-300 rounded-full">
                        <Star className="w-4 h-4 text-purple-600 fill-purple-600" />
                        <span className="text-purple-700 font-semibold text-sm">LinkedIn Influencer</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Network Stats */}
                {(lead.connections_count > 0 || lead.follower_count > 0) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Rede & Alcance</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {lead.connections_count > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2 text-gray-600 mb-1">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-medium">Conexões</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{lead.connections_count.toLocaleString()}</p>
                        </div>
                      )}
                      {lead.follower_count > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2 text-gray-600 mb-1">
                            <UserCheck className="w-4 h-4" />
                            <span className="text-xs font-medium">Seguidores</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{lead.follower_count.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    {lead.network_distance && (
                      <div className="mt-3 text-sm text-gray-600">
                        <span className="font-medium">Distância na rede:</span> {lead.network_distance.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                )}

                {/* About Section */}
                {lead.about && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 flex items-center gap-2">
                      <FileTextIcon className="w-4 h-4" />
                      Sobre
                    </h3>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{lead.about}</p>
                  </div>
                )}

                {/* Experience */}
                {lead.experience && Array.isArray(lead.experience) && lead.experience.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Experiência Profissional
                    </h3>
                    <div className="space-y-3">
                      {lead.experience.map((exp, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="font-semibold text-gray-900">{exp.title || exp.position}</p>
                          {exp.company && <p className="text-sm text-gray-600">{exp.company}</p>}
                          {(exp.start_date || exp.end_date) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {exp.start_date} - {exp.end_date || 'Presente'}
                            </p>
                          )}
                          {exp.description && <p className="text-sm text-gray-700 mt-2">{exp.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {lead.education && Array.isArray(lead.education) && lead.education.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Educação
                    </h3>
                    <div className="space-y-3">
                      {lead.education.map((edu, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="font-semibold text-gray-900">{edu.school || edu.institution}</p>
                          {edu.degree && <p className="text-sm text-gray-600">{edu.degree}</p>}
                          {edu.field_of_study && <p className="text-sm text-gray-600">{edu.field_of_study}</p>}
                          {(edu.start_date || edu.end_date) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {edu.start_date} - {edu.end_date}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {lead.skills && Array.isArray(lead.skills) && lead.skills.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Habilidades</h3>
                    <div className="flex flex-wrap gap-2">
                      {lead.skills.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {typeof skill === 'string' ? skill : skill.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {lead.certifications && Array.isArray(lead.certifications) && lead.certifications.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Certificações
                    </h3>
                    <div className="space-y-2">
                      {lead.certifications.map((cert, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="font-semibold text-gray-900 text-sm">{cert.name || cert.title}</p>
                          {cert.issuer && <p className="text-xs text-gray-600">{cert.issuer}</p>}
                          {cert.date && <p className="text-xs text-gray-500">{cert.date}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Languages */}
                {lead.languages && Array.isArray(lead.languages) && lead.languages.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 flex items-center gap-2">
                      <Languages className="w-4 h-4" />
                      Idiomas
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {lead.languages.map((lang, idx) => (
                        <span key={idx} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {typeof lang === 'string' ? lang : `${lang.name}${lang.proficiency ? ` (${lang.proficiency})` : ''}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Contact & Meta */}
              <div className="space-y-6">
                {/* Contact Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Contato</h3>
                  <div className="space-y-3">
                    {lead.email && (
                      <div className="flex items-start gap-2">
                        <Mail className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <a href={`mailto:${lead.email}`} className="text-sm text-blue-600 hover:underline break-all">
                            {lead.email}
                          </a>
                          {lead.email_source && (
                            <p className="text-xs text-gray-500">Fonte: {lead.email_source}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-start gap-2">
                        <Phone className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <a href={`tel:${lead.phone}`} className="text-sm text-emerald-600 hover:underline">
                            {lead.phone}
                          </a>
                          {lead.phone_source && (
                            <p className="text-xs text-gray-500">Fonte: {lead.phone_source}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {lead.public_identifier && (
                      <div className="flex items-start gap-2">
                        <Linkedin className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                        <a
                          href={`https://www.linkedin.com/in/${lead.public_identifier}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-700 hover:underline break-all"
                        >
                          linkedin.com/in/{lead.public_identifier}
                        </a>
                      </div>
                    )}
                    {lead.websites && Array.isArray(lead.websites) && lead.websites.length > 0 && (
                      <div className="space-y-2">
                        {lead.websites.map((website, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Globe className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                            <a
                              href={website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-purple-600 hover:underline break-all"
                            >
                              {website}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Campaign Info */}
                {lead.campaign_name && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Campanha</h3>
                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                      <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <span className="text-sm text-purple-700 font-medium">{lead.campaign_name}</span>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Informações</h3>
                  <div className="space-y-2 text-sm">
                    {lead.created_at && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Adicionado em {new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                    {lead.full_profile_fetched_at && (
                      <div className="text-xs text-gray-500">
                        Enriquecido em {new Date(lead.full_profile_fetched_at).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                    {lead.score && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600">Score de Qualificação</span>
                          <span className="text-xs font-bold text-blue-600">{lead.score}/100</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${lead.score}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie seus leads e oportunidades</p>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 shadow-sm text-sm transition-colors">
            <Download className="w-4 h-4" />
            <span>Exportar</span>
          </button>
        </div>

        {/* Filters & View Toggle */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, empresa, email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Filters Button */}
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Visualização Kanban"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Visualização em Lista"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Visualização em Calendário"
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'kanban' && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="h-full px-6 py-4">
              <div className="flex gap-4 h-full">
                {Object.entries(pipelineStages).map(([stageKey, stage]) => (
                  <KanbanColumn key={stageKey} stage={stage} stageKey={stageKey} />
                ))}
              </div>
            </div>
          </DragDropContext>
        )}

        {viewMode === 'list' && (
          <div className="h-full overflow-auto px-6 py-4">
            <ListView />
          </div>
        )}

        {viewMode === 'calendar' && (
          <div className="h-full overflow-auto px-6 py-4">
            <CalendarView />
          </div>
        )}
      </div>

      {/* Lead Details Modal */}
      {selectedLead && (
        <LeadDetailsModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </div>
  );
};

export default LeadsPage;
