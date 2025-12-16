import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
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
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  Crown,
  Star,
  Users,
  UserCheck,
  ExternalLink,
  X,
  Linkedin,
  Zap,
  Package,
  Globe,
  GraduationCap,
  Award,
  Languages,
  FileText as FileTextIcon,
  Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LeadDetailModal from '../components/LeadDetailModal';
import LeadFormModal from '../components/LeadFormModal';
import ContactDetailsModal from '../components/ContactDetailsModal';
import WinDealModal from '../components/WinDealModal';
import DiscardLeadModal from '../components/DiscardLeadModal';

const LeadsPage = () => {
  const { t } = useTranslation('leads');
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); // Debounced search for API
  const [viewMode, setViewMode] = useState('kanban'); // kanban, list, calendar
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedLead, setSelectedLead] = useState(null); // For details modal
  const [showLeadFormModal, setShowLeadFormModal] = useState(false); // For create/edit modal
  const [selectedContactId, setSelectedContactId] = useState(null); // For contact details modal
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalLeads, setTotalLeads] = useState(0); // Total from server
  const [totalsByStatus, setTotalsByStatus] = useState({}); // Real totals per status
  const [loadedPagesByStatus, setLoadedPagesByStatus] = useState({}); // Track loaded pages per status
  const [showWinDealModal, setShowWinDealModal] = useState(false);
  const [pendingWinDealLead, setPendingWinDealLead] = useState(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingDiscardLead, setPendingDiscardLead] = useState(null);

  // Kanban column limit for performance
  const KANBAN_COLUMN_LIMIT = 20;

  // Store scroll positions and refs for each column at parent level
  const columnScrollRefs = useRef({});
  const columnScrollPositions = useRef({});

  // Pipeline stages matching backend
  const pipelineStages = {
    leads: {
      label: t('stages.leads'),
      color: 'slate',
      icon: UserPlus
    },
    invite_sent: {
      label: t('stages.invite_sent'),
      color: 'blue',
      icon: Send
    },
    qualifying: {
      label: t('stages.qualifying'),
      color: 'amber',
      icon: Target
    },
    accepted: {
      label: t('stages.accepted'),
      color: 'purple',
      icon: Clock
    },
    qualified: {
      label: t('stages.qualified'),
      color: 'emerald',
      icon: CheckCircle2
    },
    discarded: {
      label: t('stages.discarded'),
      color: 'red',
      icon: XCircle
    }
  };

  // Helper functions for dynamic Tailwind classes
  const getStageIconClasses = (color) => {
    const colorMap = {
      slate: 'w-5 h-5 text-slate-600 dark:text-slate-400',
      blue: 'w-5 h-5 text-blue-600 dark:text-blue-400',
      amber: 'w-5 h-5 text-amber-600 dark:text-amber-400',
      purple: 'w-5 h-5 text-purple-600 dark:text-purple-400',
      emerald: 'w-5 h-5 text-emerald-600 dark:text-emerald-400',
      red: 'w-5 h-5 text-red-600 dark:text-red-400'
    };
    return colorMap[color] || colorMap.slate;
  };

  const getStageBadgeClasses = (color) => {
    const colorMap = {
      slate: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-900/20 text-slate-700 dark:text-slate-400',
      blue: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
      amber: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
      purple: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
      emerald: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
      red: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    };
    return colorMap[color] || colorMap.slate;
  };

  const getStageInlineBadgeClasses = (color) => {
    const colorMap = {
      slate: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-900/20 text-slate-700 dark:text-slate-400',
      blue: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
      amber: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
      purple: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
      emerald: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
      red: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    };
    return colorMap[color] || colorMap.slate;
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Load leads with server-side pagination (for list view)
  useEffect(() => {
    if (viewMode === 'list') {
      loadLeads();
    }
  }, [viewMode, currentPage, itemsPerPage, debouncedSearch, sortField, sortDirection]);

  // Load all leads for kanban (but will limit display per column)
  useEffect(() => {
    if (viewMode === 'kanban') {
      loadLeadsKanban();
    }
  }, [viewMode, debouncedSearch]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        sort_field: sortField,
        sort_direction: sortDirection
      };
      if (debouncedSearch) params.search = debouncedSearch;

      const response = await api.getLeads(params);

      if (response.success) {
        setLeads(response.data.leads || []);
        setTotalLeads(response.data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeadsKanban = async (showLoading = true) => {
    try {
      // Only show loading on initial load, not on search updates
      if (showLoading && leads.length === 0) {
        setLoading(true);
      }
      // For kanban, fetch leads from each status to ensure all columns have data
      const statuses = ['leads', 'invite_sent', 'qualifying', 'accepted', 'qualified', 'discarded'];
      const baseParams = {};
      if (debouncedSearch) baseParams.search = debouncedSearch;

      // Fetch first page of leads from all statuses in parallel
      const promises = statuses.map(status =>
        api.getLeads({ ...baseParams, status, limit: KANBAN_COLUMN_LIMIT, page: 1 })
      );

      const responses = await Promise.all(promises);

      // Combine all leads from all statuses
      const allLeads = responses.flatMap(response =>
        response.success ? (response.data.leads || []) : []
      );

      // Store real totals per status
      const totals = {};
      const loadedPages = {};
      statuses.forEach((status, index) => {
        const response = responses[index];
        totals[status] = response.success ? (response.data.pagination?.total || 0) : 0;
        loadedPages[status] = 1; // First page loaded
      });

      // Calculate total from all statuses
      const total = Object.values(totals).reduce((sum, t) => sum + t, 0);

      setLeads(allLeads);
      setTotalLeads(total);
      setTotalsByStatus(totals);
      setLoadedPagesByStatus(loadedPages);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load more leads for a specific status (infinite scroll)
  const loadMoreLeadsForStatus = async (status) => {
    try {
      const currentPage = loadedPagesByStatus[status] || 1;
      const nextPage = currentPage + 1;

      const params = { status, limit: KANBAN_COLUMN_LIMIT, page: nextPage };
      if (debouncedSearch) params.search = debouncedSearch;

      // Save scroll position BEFORE fetch
      const scrollEl = columnScrollRefs.current[status];
      if (scrollEl) {
        columnScrollPositions.current[status] = scrollEl.scrollTop;
      }

      const response = await api.getLeads(params);

      if (response.success && response.data.leads?.length > 0) {
        const savedPosition = columnScrollPositions.current[status];

        // Use flushSync to make updates synchronous
        flushSync(() => {
          setLeads(prevLeads => [...prevLeads, ...response.data.leads]);
          setLoadedPagesByStatus(prev => ({ ...prev, [status]: nextPage }));
        });

        // Multiple restoration attempts with different timings
        // Add offset to show some of the newly loaded cards
        const targetPosition = savedPosition + 80; // Show ~1 new card
        const restore = () => {
          const el = columnScrollRefs.current[status];
          if (el && savedPosition !== undefined && savedPosition > 0) {
            el.scrollTop = targetPosition;
          }
        };

        // Immediate
        restore();
        // After microtask
        Promise.resolve().then(restore);
        // After RAF
        requestAnimationFrame(restore);
        // After double RAF
        requestAnimationFrame(() => requestAnimationFrame(restore));
        // After short timeout
        setTimeout(restore, 0);
        setTimeout(restore, 16);
        setTimeout(restore, 50);
        setTimeout(restore, 100);
      }
    } catch (error) {
      console.error(`Erro ao carregar mais leads do status ${status}:`, error);
    }
  };

  // Memoized leads by stage for Kanban (with limit per column)
  const getLeadsByStage = useCallback((stage) => {
    return leads
      .filter(lead => lead.status === stage)
      .sort((a, b) => {
        // Sort by display_order if exists, otherwise by created_at desc
        if (a.display_order !== undefined && b.display_order !== undefined) {
          return a.display_order - b.display_order;
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [leads]);

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // Dropped outside the list
    if (!destination) return;

    // No movement at all
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return;

    const leadId = draggableId.replace('lead-', ''); // UUID string, not parseInt
    const newStatus = destination.droppableId;
    const sourceStatus = source.droppableId;

    // Get sorted leads for source column
    const sourceColumnLeads = getLeadsByStage(sourceStatus);
    const movedLead = sourceColumnLeads[source.index];
    if (!movedLead) return;

    // If moving to 'qualified' (won), show Win Deal modal
    if (newStatus === 'qualified' && sourceStatus !== 'qualified') {
      setPendingWinDealLead(movedLead);
      setShowWinDealModal(true);
      return;
    }

    // If moving to 'discarded', show Discard modal
    if (newStatus === 'discarded' && sourceStatus !== 'discarded') {
      setPendingDiscardLead(movedLead);
      setShowDiscardModal(true);
      return;
    }

    // Optimistic update with proper reordering
    setLeads(prevLeads => {
      const newLeads = [...prevLeads];

      // If same column, reorder within column
      if (sourceStatus === newStatus) {
        const columnLeads = newLeads
          .filter(l => l.status === sourceStatus)
          .sort((a, b) => {
            if (a.display_order !== undefined && b.display_order !== undefined) {
              return a.display_order - b.display_order;
            }
            return new Date(b.created_at) - new Date(a.created_at);
          });

        // Remove from old position and insert at new position
        const [removed] = columnLeads.splice(source.index, 1);
        columnLeads.splice(destination.index, 0, removed);

        // Update display_order for all items in column
        columnLeads.forEach((lead, idx) => {
          const globalIdx = newLeads.findIndex(l => l.id === lead.id);
          if (globalIdx !== -1) {
            newLeads[globalIdx] = { ...newLeads[globalIdx], display_order: idx };
          }
        });
      } else {
        // Moving between columns
        const leadGlobalIdx = newLeads.findIndex(l => String(l.id) === String(leadId));
        if (leadGlobalIdx !== -1) {
          newLeads[leadGlobalIdx] = {
            ...newLeads[leadGlobalIdx],
            status: newStatus,
            display_order: destination.index
          };
        }

        // Update display_order for destination column
        const destColumnLeads = newLeads
          .filter(l => l.status === newStatus && String(l.id) !== String(leadId))
          .sort((a, b) => {
            if (a.display_order !== undefined && b.display_order !== undefined) {
              return a.display_order - b.display_order;
            }
            return new Date(b.created_at) - new Date(a.created_at);
          });

        // Insert at position and reorder
        destColumnLeads.splice(destination.index, 0, newLeads[leadGlobalIdx]);
        destColumnLeads.forEach((lead, idx) => {
          const globalIdx = newLeads.findIndex(l => l.id === lead.id);
          if (globalIdx !== -1) {
            newLeads[globalIdx] = { ...newLeads[globalIdx], display_order: idx };
          }
        });
      }

      return newLeads;
    });

    // Update on backend only if status changed
    if (sourceStatus !== newStatus) {
      try {
        await api.updateLeadStatus(leadId, newStatus);
        console.log(`✅ Lead ${leadId} movido para ${newStatus}`);
      } catch (error) {
        console.error('Erro ao atualizar lead:', error);
        // Revert on error
        loadLeads();
      }
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

  const handleSaveLead = async (formData) => {
    try {
      const response = await api.createManualLead(formData);
      if (response.success) {
        loadLeads(); // Reload leads list
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      throw error;
    }
  };

  // For list view, leads are already sorted by the server
  // No need for client-side sorting

  // Lead Card Component - memoized with custom comparison for better performance
  const LeadCard = React.memo(({ lead, index }) => {
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
            data-lead-id={lead.id}
            className={`bg-white dark:bg-gray-800 rounded-lg border p-3 cursor-move group overflow-hidden ${
              snapshot.isDragging
                ? 'shadow-xl dark:shadow-gray-900/50 ring-2 ring-blue-400 border-blue-300'
                : 'shadow-sm border-gray-200 dark:border-gray-700 hover:shadow-md'
            }`}
            style={{
              ...provided.draggableProps.style,
            }}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt={lead.name}
                    loading="lazy"
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
              <div className="flex-1 min-w-0 overflow-hidden">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
                  {lead.name}
                </h4>

                {lead.title && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5 flex items-center gap-1.5 min-w-0">
                    <Briefcase className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{lead.title}</span>
                  </p>
                )}

                {lead.company && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1.5 min-w-0">
                    <Building className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{lead.company}</span>
                  </p>
                )}

                {(lead.city || lead.state) && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">
                      {lead.city && lead.state
                        ? `${lead.city} - ${lead.state}`
                        : lead.city || lead.state}
                    </span>
                  </p>
                )}
              </div>

              {/* View Details */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLead(lead);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-50 dark:bg-blue-900/20 rounded flex-shrink-0"
                title={t('tooltips.viewDetails')}
              >
                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </button>
            </div>

            {/* Campaign & Draft Badge */}
            {!isOrganic && lead.campaign_name && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 overflow-hidden">
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 rounded min-w-0 max-w-full">
                  <FileText className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <span className="text-purple-700 font-medium text-[10px] leading-tight truncate">
                    {lead.campaign_name}
                  </span>
                </div>
                {isDraft && lead.status === 'leads' && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded flex-shrink-0">
                    <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-amber-700 font-semibold text-[10px] leading-tight">{t('badges.draft')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {lead.tags && lead.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1 overflow-hidden">
                {lead.tags.map((tag) => {
                  const colorClasses = {
                    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
                    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                    pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
                    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
                    gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                  };
                  const colorClass = colorClasses[tag.color] || colorClasses.purple;

                  return (
                    <span
                      key={tag.id}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${colorClass}`}
                      title={tag.name}
                    >
                      {tag.name}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Profile Badges & Stats */}
            {(lead.is_premium || lead.is_creator || lead.is_influencer || lead.connections_count > 0 || lead.follower_count > 0) && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                {/* Badges */}
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {lead.is_creator && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 rounded" title={t('badges.creatorMode')}>
                      <Star className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-blue-700 font-semibold text-[9px] leading-tight">{t('badges.creator')}</span>
                    </div>
                  )}
                  {lead.is_influencer && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-300 rounded" title={t('badges.linkedInInfluencer')}>
                      <Star className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 fill-purple-600" />
                      <span className="text-purple-700 font-semibold text-[9px] leading-tight">{t('badges.influencer')}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                  {lead.connections_count > 0 && (
                    <div className="flex items-center gap-0.5" title={`${lead.connections_count} ${t('stats.connections')}`}>
                      <Users className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                      <span className="font-medium">{lead.connections_count.toLocaleString()}</span>
                    </div>
                  )}
                  {lead.follower_count > 0 && (
                    <div className="flex items-center gap-0.5" title={`${lead.follower_count} ${t('stats.followers')}`}>
                      <UserCheck className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                      <span className="font-medium">{lead.follower_count.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact Info */}
            {lead.email && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-blue-500" />
                  {lead.email}
                </p>
              </div>
            )}

            {/* Deal Value - Show for qualified (won) leads */}
            {lead.status === 'qualified' && lead.deal_value > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Trophy className="w-3 h-3" />
                  <span className="text-[10px] font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.deal_value)}
                  </span>
                </div>
              </div>
            )}

            {/* Footer - Source & Responsible */}
            {(lead.source || lead.responsible_name) && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                {/* Source */}
                {lead.source && (() => {
                  const sourceConfig = {
                    linkedin: {
                      icon: Linkedin,
                      label: 'LinkedIn',
                      className: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                    },
                    google_maps: {
                      icon: MapPin,
                      label: 'Google Maps',
                      className: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                    },
                    list: {
                      icon: ListIcon,
                      label: 'Lista',
                      className: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                    },
                    paid_traffic: {
                      icon: Zap,
                      label: 'Tráfego Pago',
                      className: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                    },
                    other: {
                      icon: Package,
                      label: 'Outro',
                      className: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                    }
                  };

                  const config = sourceConfig[lead.source] || sourceConfig.other;
                  const SourceIcon = config.icon;

                  return (
                    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium ${config.className}`}>
                      <SourceIcon className="w-2.5 h-2.5" />
                      <span>{config.label}</span>
                      {lead.source === 'linkedin' && lead.is_premium && (
                        <Crown className="w-2.5 h-2.5 text-amber-500" title={t('badges.linkedInPremium')} />
                      )}
                    </div>
                  );
                })()}

                {/* Responsible */}
                {lead.responsible_name && (
                  <div className="flex items-center gap-1.5" title={`Responsável: ${lead.responsible_name}`}>
                  {lead.responsible_avatar ? (
                    <img
                      src={
                        lead.responsible_avatar.startsWith('http')
                          ? `${lead.responsible_avatar}?v=${lead.responsible_updated_at || Date.now()}`
                          : lead.responsible_avatar
                      }
                      alt={lead.responsible_name}
                      loading="lazy"
                      className="w-5 h-5 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                        {(() => {
                          const names = (lead.responsible_name || '').trim().split(' ').filter(n => n.length > 0);
                          if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
                          return (names[0][0] + names[1][0]).toUpperCase();
                        })()}
                      </span>
                    </div>
                  )}
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate max-w-[60px]">
                    {(() => {
                      const names = (lead.responsible_name || '').trim().split(' ').filter(n => n.length > 0);
                      if (names.length === 1) return names[0];
                      return `${names[0]} ${names[1][0]}.`;
                    })()}
                  </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Draggable>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison - only re-render if lead data actually changed
    return prevProps.lead.id === nextProps.lead.id &&
           prevProps.lead.status === nextProps.lead.status &&
           prevProps.lead.updated_at === nextProps.lead.updated_at &&
           prevProps.index === nextProps.index;
  });

  // Kanban Column with infinite scroll pagination
  const KanbanColumn = ({ stage, stageKey }) => {
    const Icon = stage.icon;
    const [loadingMore, setLoadingMore] = useState(false);
    const loadMoreRef = useRef(null);
    const loadingRef = useRef(false); // Prevent duplicate loads

    // Get leads already loaded for this stage
    const stageLeads = getLeadsByStage(stageKey);

    // Get real total from server
    const realTotal = totalsByStatus[stageKey] || 0;

    // Check if there are more leads to load
    const hasMore = stageLeads.length < realTotal;

    // Register scroll container ref in parent
    const setScrollRef = useCallback((el) => {
      if (el) {
        columnScrollRefs.current[stageKey] = el;
      }
    }, [stageKey]);

    // Infinite scroll with Intersection Observer
    useEffect(() => {
      const observer = new IntersectionObserver(
        async (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && hasMore && !loadingRef.current) {
            loadingRef.current = true;
            setLoadingMore(true);
            await loadMoreLeadsForStatus(stageKey);
            setLoadingMore(false);
            loadingRef.current = false;
          }
        },
        { threshold: 0.1, rootMargin: '100px' }
      );

      const currentRef = loadMoreRef.current;
      if (currentRef && hasMore) {
        observer.observe(currentRef);
      }

      return () => {
        if (currentRef) {
          observer.unobserve(currentRef);
        }
      };
    }, [hasMore, stageKey, stageLeads.length]);

    return (
      <div className="flex-1 min-w-[270px] max-w-[290px] flex flex-col">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Icon className={getStageIconClasses(stage.color)} />
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
              {stage.label}
            </h3>
            <span className={getStageBadgeClasses(stage.color)}>
              {realTotal}
            </span>
          </div>
          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded transition-colors">
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Scroll wrapper - controls scroll independently of Droppable */}
        <div
          ref={setScrollRef}
          className="flex-1 rounded-lg overflow-y-auto scrollbar-thin bg-gray-50 dark:bg-gray-900"
          style={{
            maxHeight: 'calc(100vh - 200px)',
            minHeight: '400px',
            contain: 'strict',
            overflowAnchor: 'none'
          }}
        >
          <Droppable droppableId={stageKey}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-full p-2 ${
                  snapshot.isDraggingOver
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-300 ring-inset'
                    : ''
                }`}
              >
                {stageLeads.length > 0 ? (
                  <div className="space-y-2">
                    {stageLeads.map((lead, index) => (
                      <LeadCard key={lead.id} lead={lead} index={index} />
                    ))}
                    {/* Infinite scroll sentinel - triggers load when visible */}
                    {hasMore && (
                      <div
                        ref={loadMoreRef}
                        className="w-full py-3 flex items-center justify-center"
                      >
                        {loadingMore ? (
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>Carregando...</span>
                          </div>
                        ) : (
                          <div className="w-full h-1" />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`flex items-center justify-center h-32 text-sm border-2 border-dashed rounded-lg ${
                    snapshot.isDraggingOver
                      ? 'border-blue-400 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-600 text-gray-400'
                  }`}>
                    {snapshot.isDraggingOver ? t('messages.dropHere') : t('messages.noLeads')}
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    );
  };

  // Table Header Component with Sorting
  const TableHeader = ({ field, label }) => {
    const isActive = sortField === field;
    return (
      <th
        className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 transition-colors select-none"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-0.5">
          <span>{label}</span>
          {isActive && (
            sortDirection === 'asc' ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )
          )}
        </div>
      </th>
    );
  };

  // List View Component - uses server-side pagination
  const ListView = () => {
    // Pagination comes from server
    const totalPages = Math.ceil(totalLeads / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalLeads);
    // Leads are already paginated from server
    const paginatedLeads = leads;

    return (
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <TableHeader field="name" label={t('table.lead')} />
                <TableHeader field="email" label={t('table.contact')} />
                <TableHeader field="status" label={t('table.stage')} />
                <TableHeader field="responsible_name" label="Responsável" />
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.tags')}
                </th>
                <TableHeader field="created_at" label={t('table.date')} />
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedLeads.map((lead) => {
              const stage = pipelineStages[lead.status] || pipelineStages.leads;
              const isOrganic = lead.campaign_name?.toLowerCase().includes('organic');
              const isDraft = lead.campaign_status === 'draft';

              return (
                <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {lead.profile_picture ? (
                        <img
                          src={lead.profile_picture}
                          alt={lead.name}
                          loading="lazy"
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                          {lead.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="min-w-0 max-w-[250px]">
                        <div className="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate">{lead.name}</div>
                        {lead.company && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={lead.company}>
                            {lead.company}
                          </div>
                        )}
                        {lead.title && (
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate" title={lead.title}>
                            {lead.title}
                          </div>
                        )}
                        {(lead.city || lead.state) && (
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-1" title={`${lead.city || ''} ${lead.state || ''}`}>
                            <MapPin className="w-2.5 h-2.5 inline flex-shrink-0" />
                            <span>{lead.city && lead.state ? `${lead.city} - ${lead.state}` : lead.city || lead.state}</span>
                          </div>
                        )}

                        {/* Profile Badges & Stats */}
                        {(lead.is_premium || lead.is_creator || lead.is_influencer || lead.connections_count > 0 || lead.follower_count > 0) && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {/* Badges */}
                            {lead.is_creator && (
                              <div className="flex items-center gap-0.5 px-1 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 rounded" title={t('badges.creatorMode')}>
                                <Star className="w-2 h-2 text-blue-600 dark:text-blue-400" />
                                <span className="text-blue-700 font-semibold text-[8px] leading-tight">{t('badges.creator')}</span>
                              </div>
                            )}
                            {lead.is_influencer && (
                              <div className="flex items-center gap-0.5 px-1 py-0.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-300 rounded" title={t('badges.linkedInInfluencer')}>
                                <Star className="w-2 h-2 text-purple-600 dark:text-purple-400 fill-purple-600" />
                                <span className="text-purple-700 font-semibold text-[8px] leading-tight">{t('badges.influencer')}</span>
                              </div>
                            )}

                            {/* Stats */}
                            {lead.connections_count > 0 && (
                              <div className="flex items-center gap-0.5 text-[9px] text-gray-600 dark:text-gray-400" title={`${lead.connections_count} ${t('stats.connections')}`}>
                                <Users className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />
                                <span className="font-medium">{lead.connections_count > 999 ? `${(lead.connections_count / 1000).toFixed(1)}k` : lead.connections_count}</span>
                              </div>
                            )}
                            {lead.follower_count > 0 && (
                              <div className="flex items-center gap-0.5 text-[9px] text-gray-600 dark:text-gray-400" title={`${lead.follower_count} ${t('stats.followers')}`}>
                                <UserCheck className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />
                                <span className="font-medium">{lead.follower_count > 999 ? `${(lead.follower_count / 1000).toFixed(1)}k` : lead.follower_count}</span>
                              </div>
                            )}
                            {lead.public_identifier && (
                              <a
                                href={`https://www.linkedin.com/in/${lead.public_identifier}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 text-[9px]"
                                title={t('tooltips.viewLinkedIn')}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Linkedin className="w-2.5 h-2.5" />
                                {lead.is_premium && (
                                  <Crown className="w-2 h-2 text-amber-500" title={t('badges.linkedInPremium')} />
                                )}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-0.5 max-w-[180px]">
                      {lead.email && (
                        <div className="text-[10px] text-gray-600 dark:text-gray-400 flex items-center gap-1 truncate" title={lead.email}>
                          <Mail className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="text-[10px] text-gray-600 dark:text-gray-400 flex items-center gap-1 truncate" title={lead.phone}>
                          <Phone className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={getStageInlineBadgeClasses(stage.color)}>
                      {stage.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {lead.responsible_name ? (
                      <div className="flex items-center gap-1.5">
                        {lead.responsible_avatar ? (
                          <img
                            src={
                              lead.responsible_avatar.startsWith('http')
                                ? `${lead.responsible_avatar}?v=${lead.responsible_updated_at || Date.now()}`
                                : lead.responsible_avatar
                            }
                            alt={lead.responsible_name}
                            loading="lazy"
                            className="w-5 h-5 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400">
                              {(() => {
                                const names = (lead.responsible_name || '').trim().split(' ').filter(n => n.length > 0);
                                if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
                                return (names[0][0] + names[1][0]).toUpperCase();
                              })()}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] text-gray-700 dark:text-gray-300 truncate max-w-[90px]">
                          {(() => {
                            const names = (lead.responsible_name || '').trim().split(' ').filter(n => n.length > 0);
                            if (names.length === 1) return names[0];
                            return `${names[0]} ${names[1][0]}.`;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">Não atribuído</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-0.5">
                      {lead.tags && lead.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${tag.colorClass || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {lead.tags && lead.tags.length > 2 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          +{lead.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-500 dark:text-gray-400">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => setSelectedLead(lead)}
                        className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/20 rounded transition-colors"
                        title={t('tooltips.viewDetails')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded transition-colors" title={t('tooltips.edit')}>
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded transition-colors" title={t('tooltips.delete')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            {/* Left side - Items per page */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">Itens por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[10px] text-gray-600 dark:text-gray-400">
                Mostrando {startIndex + 1}-{endIndex} de {totalLeads}
              </span>
            </div>

            {/* Right side - Page navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Primeira
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const maxVisible = 5;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

                  if (endPage - startPage < maxVisible - 1) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                          currentPage === i
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }

                  return pages;
                })()}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Última
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Calendar View Component (placeholder)
  const CalendarView = () => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">{t('calendar.view')}</p>
          <p className="text-xs mt-1">{t('calendar.inDevelopment')}</p>
        </div>
      </div>
    );
  };

  // Only show full-page loading spinner on initial load (no leads yet)
  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        {/* Search and Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filters Button */}
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-gray-700 dark:text-gray-300 transition-colors">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">{t('filtersButton')}</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              title={t('viewModes.kanban')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              title={t('viewModes.list')}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* New Lead Button */}
          <button
            onClick={() => setShowLeadFormModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">{t('newLead')}</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'kanban' && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="h-full px-6 py-4 overflow-x-auto">
              <div className="flex gap-4 h-full min-w-max">
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
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onNavigateToConversation={(leadId, channel) => {
            setSelectedLead(null);
            navigate(`/conversations?lead=${leadId}&channel=${channel}`);
          }}
          onLeadUpdated={(updatedLead) => {
            // Optimistic update - just update the specific lead in the list
            setLeads(prevLeads =>
              prevLeads.map(l => l.id === updatedLead.id ? updatedLead : l)
            );
            // Update selectedLead with the new data
            setSelectedLead(updatedLead);
          }}
          onViewContact={(contactId) => setSelectedContactId(contactId)}
        />
      )}

      {/* Lead Form Modal */}
      <LeadFormModal
        isOpen={showLeadFormModal}
        onClose={() => setShowLeadFormModal(false)}
        onSave={handleSaveLead}
      />

      {/* Contact Details Modal */}
      <ContactDetailsModal
        isOpen={!!selectedContactId}
        onClose={() => setSelectedContactId(null)}
        contactId={selectedContactId}
      />

      {/* Win Deal Modal */}
      <WinDealModal
        isOpen={showWinDealModal}
        onClose={() => {
          setShowWinDealModal(false);
          setPendingWinDealLead(null);
        }}
        lead={pendingWinDealLead}
        onSuccess={() => {
          loadLeads();
          setShowWinDealModal(false);
          setPendingWinDealLead(null);
        }}
      />

      {/* Discard Lead Modal */}
      <DiscardLeadModal
        isOpen={showDiscardModal}
        onClose={() => {
          setShowDiscardModal(false);
          setPendingDiscardLead(null);
        }}
        lead={pendingDiscardLead}
        onSuccess={() => {
          loadLeads();
          setShowDiscardModal(false);
          setPendingDiscardLead(null);
        }}
      />
    </div>
  );
};

export default LeadsPage;
