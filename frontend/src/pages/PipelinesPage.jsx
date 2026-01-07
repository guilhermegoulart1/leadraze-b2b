// frontend/src/pages/PipelinesPage.jsx
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { flushSync } from 'react-dom';
import {
  Search,
  Filter,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
  LayoutGrid,
  Target,
  User,
  Building2,
  Building,
  Briefcase,
  MapPin,
  DollarSign,
  Calendar,
  Eye,
  Edit,
  Trash2,
  Settings,
  FolderOpen,
  FolderPlus,
  Folder,
  MoreVertical,
  Phone,
  Mail,
  Trophy,
  XCircle,
  Users,
  UserCheck,
  Linkedin,
  Crown,
  Star,
  FileText,
  AlertCircle,
  Zap,
  Package,
  Clock
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import OpportunityModal from '../components/pipelines/OpportunityModal';
import PipelineSettingsModal from '../components/pipelines/PipelineSettingsModal';
import ProjectModal from '../components/pipelines/ProjectModal';

const PipelinesPage = () => {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [pipelines, setPipelines] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState(searchParams.get('pipeline') || null);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [stages, setStages] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState('kanban');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalOpportunities, setTotalOpportunities] = useState(0);
  const [totalsByStage, setTotalsByStage] = useState({});

  // Sidebar state
  const [expandedProjects, setExpandedProjects] = useState(new Set());

  // Modals
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [showPipelineSettings, setShowPipelineSettings] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // Kanban column limit
  const KANBAN_COLUMN_LIMIT = 20;
  const columnScrollRefs = useRef({});
  const columnScrollPositions = useRef({});
  const [loadedPagesByStage, setLoadedPagesByStage] = useState({});

  // Collapse main sidebar on mount
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', 'true');
    window.dispatchEvent(new Event('storage'));
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset pagination on search
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Load pipelines and projects
  useEffect(() => {
    loadPipelinesAndProjects();
  }, []);

  // Load selected pipeline details based on view mode
  useEffect(() => {
    if (selectedPipelineId) {
      if (viewMode === 'kanban') {
        loadOpportunitiesKanban();
      } else {
        loadOpportunitiesList();
      }
    }
  }, [selectedPipelineId, viewMode, debouncedSearch]);

  // Reload list view when pagination/sort changes
  useEffect(() => {
    if (selectedPipelineId && viewMode === 'list') {
      loadOpportunitiesList();
    }
  }, [currentPage, itemsPerPage, sortField, sortDirection]);

  const loadPipelinesAndProjects = async () => {
    try {
      const [pipelinesRes, projectsRes] = await Promise.all([
        api.getPipelines(),
        api.getCrmProjects()
      ]);

      let pipelinesData = [];
      if (pipelinesRes.success) {
        pipelinesData = pipelinesRes.data?.pipelines || [];
        setPipelines(pipelinesData);

        // Auto-select first pipeline if none selected
        if (!selectedPipelineId && pipelinesData.length > 0) {
          const firstPipeline = pipelinesData[0];
          setSelectedPipelineId(firstPipeline.id);
          setSearchParams({ pipeline: firstPipeline.id });
        }
      }

      if (projectsRes.success) {
        const projectsData = projectsRes.data?.projects || [];
        setProjects(projectsData);
        setExpandedProjects(new Set(projectsData.map(p => p.id)));
      }
    } catch (error) {
      console.error('Erro ao carregar pipelines:', error);
    }
  };

  const loadOpportunitiesKanban = async (showLoading = true) => {
    if (!selectedPipelineId) return;

    try {
      // Show loading on initial load or when no data
      if (showLoading && opportunities.length === 0) {
        setLoading(true);
      }

      // Load pipeline details first
      const pipelineRes = await api.getPipeline(selectedPipelineId);
      if (pipelineRes.success) {
        setSelectedPipeline(pipelineRes.data.pipeline);
      }

      // Load kanban data
      const params = {};
      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch;
      }

      const response = await api.getOpportunitiesKanban(selectedPipelineId, params);

      if (response.success) {
        const stagesData = response.data.stages || [];
        setStages(stagesData);

        // Flatten opportunities
        const allOpps = stagesData.flatMap(stage => stage.opportunities || []);
        setOpportunities(allOpps);

        // Store totals by stage and initialize loaded pages
        const totals = {};
        const loadedPages = {};
        stagesData.forEach(stage => {
          totals[stage.id] = stage.count || 0;
          loadedPages[stage.id] = 1; // First page loaded
        });
        setTotalsByStage(totals);
        setLoadedPagesByStage(loadedPages);

        const total = Object.values(totals).reduce((sum, t) => sum + t, 0);
        setTotalOpportunities(total);
      }
    } catch (error) {
      console.error('Erro ao carregar kanban:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load more opportunities for a specific stage (infinite scroll)
  const loadMoreOpportunitiesForStage = async (stageId) => {
    if (!selectedPipelineId) return;

    try {
      const currentPage = loadedPagesByStage[stageId] || 1;
      const nextPage = currentPage + 1;

      const params = { stage_id: stageId, limit: KANBAN_COLUMN_LIMIT, page: nextPage };
      if (debouncedSearch) params.search = debouncedSearch;

      // Save scroll position BEFORE fetch
      const scrollEl = columnScrollRefs.current[stageId];
      if (scrollEl) {
        columnScrollPositions.current[stageId] = scrollEl.scrollTop;
      }

      const response = await api.getOpportunities(selectedPipelineId, params);

      if (response.success && response.data.opportunities?.length > 0) {
        const savedPosition = columnScrollPositions.current[stageId];

        // Use flushSync to make updates synchronous
        flushSync(() => {
          setOpportunities(prevOpps => [...prevOpps, ...response.data.opportunities]);
          setLoadedPagesByStage(prev => ({ ...prev, [stageId]: nextPage }));
        });

        // Multiple restoration attempts with different timings
        const targetPosition = savedPosition + 80;
        const restore = () => {
          const el = columnScrollRefs.current[stageId];
          if (el && savedPosition !== undefined && savedPosition > 0) {
            el.scrollTop = targetPosition;
          }
        };

        restore();
        Promise.resolve().then(restore);
        requestAnimationFrame(restore);
        requestAnimationFrame(() => requestAnimationFrame(restore));
        setTimeout(restore, 0);
        setTimeout(restore, 16);
        setTimeout(restore, 50);
        setTimeout(restore, 100);
      }
    } catch (error) {
      console.error(`Erro ao carregar mais oportunidades do stage ${stageId}:`, error);
    }
  };

  const loadOpportunitiesList = async () => {
    if (!selectedPipelineId) return;

    try {
      setLoading(true);

      // Load pipeline details
      const pipelineRes = await api.getPipeline(selectedPipelineId);
      if (pipelineRes.success) {
        setSelectedPipeline(pipelineRes.data.pipeline);
        setStages(pipelineRes.data.pipeline.stages || []);
      }

      const params = {
        page: currentPage,
        limit: itemsPerPage,
        sort_field: sortField,
        sort_direction: sortDirection
      };
      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch;
      }

      const response = await api.getOpportunities(selectedPipelineId, params);

      if (response.success) {
        setOpportunities(response.data.opportunities || []);
        setTotalOpportunities(response.data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar oportunidades:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get opportunities by stage
  const getOpportunitiesByStage = useCallback((stageId) => {
    return opportunities
      .filter(opp => opp.stage_id === stageId)
      .sort((a, b) => {
        if (a.display_order !== undefined && b.display_order !== undefined) {
          return a.display_order - b.display_order;
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [opportunities]);

  const handleSelectPipeline = (pipeline) => {
    setSelectedPipelineId(pipeline.id);
    setSearchParams({ pipeline: pipeline.id });
  };

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const oppId = draggableId.replace('opp-', '');
    const newStageId = destination.droppableId;
    const sourceStageId = source.droppableId;

    // Optimistic update
    setOpportunities(prevOpps => {
      const newOpps = [...prevOpps];
      const oppIndex = newOpps.findIndex(o => String(o.id) === String(oppId));
      if (oppIndex !== -1) {
        newOpps[oppIndex] = { ...newOpps[oppIndex], stage_id: newStageId };
      }
      return newOpps;
    });

    // Update backend
    if (sourceStageId !== newStageId) {
      try {
        await api.moveOpportunity(oppId, newStageId);
      } catch (error) {
        console.error('Erro ao mover oportunidade:', error);
        loadOpportunitiesKanban(false);
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

  const handleCreateOpportunity = () => {
    setEditingOpportunity(null);
    setShowOpportunityModal(true);
  };

  const handleOpportunitySaved = () => {
    setShowOpportunityModal(false);
    setEditingOpportunity(null);
    if (viewMode === 'kanban') {
      loadOpportunitiesKanban(false);
    } else {
      loadOpportunitiesList();
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  // Stage badge classes
  const getStageBadgeClasses = (stage) => {
    if (stage.is_win_stage) {
      return 'px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400';
    }
    if (stage.is_loss_stage) {
      return 'px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400';
    }
    return 'px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400';
  };

  // =====================================================
  // OPPORTUNITY CARD - EXACTLY LIKE LEADCARD
  // =====================================================
  const OpportunityCard = memo(({ opportunity, index }) => {
    const profilePicture = opportunity.contact_picture || null;
    // Priorizar source do custom_fields (que vem do lead original) se for lead_migration
    const source = opportunity.source === 'lead_migration'
      ? (opportunity.custom_fields?.original_source || opportunity.source)
      : opportunity.source;

    return (
      <Draggable draggableId={`opp-${opportunity.id}`} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            data-opp-id={opportunity.id}
            className={`bg-white dark:bg-gray-800 rounded-lg border p-3 cursor-move group overflow-hidden ${
              snapshot.isDragging
                ? 'shadow-xl dark:shadow-gray-900/50 ring-2 ring-blue-400 border-blue-300'
                : 'shadow-sm border-gray-200 dark:border-gray-700 hover:shadow-md'
            }`}
            style={provided.draggableProps.style}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt={opportunity.contact_name}
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
                  {opportunity.contact_name?.charAt(0) || '?'}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
                  {opportunity.contact_name}
                </h4>

                {/* Job Title */}
                {opportunity.contact_title && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5 flex items-center gap-1.5 min-w-0">
                    <Briefcase className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{opportunity.contact_title}</span>
                  </p>
                )}

                {/* Company */}
                {opportunity.contact_company && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1.5 min-w-0">
                    <Building className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{opportunity.contact_company}</span>
                  </p>
                )}

                {/* Location */}
                {opportunity.contact_location && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{opportunity.contact_location}</span>
                  </p>
                )}
              </div>

              {/* View Details */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingOpportunity(opportunity);
                  setShowOpportunityModal(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded flex-shrink-0"
                title="Ver detalhes"
              >
                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </button>
            </div>

            {/* Tags */}
            {opportunity.tags && opportunity.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1 overflow-hidden">
                {opportunity.tags.map((tag) => {
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

            {/* Email */}
            {opportunity.contact_email && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{opportunity.contact_email}</span>
                </p>
              </div>
            )}

            {/* Value */}
            {opportunity.value > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Trophy className="w-3 h-3" />
                  <span className="text-[10px] font-medium">
                    {formatCurrency(opportunity.value)}
                  </span>
                </div>
              </div>
            )}

            {/* Footer - Source & Responsible */}
            {(source || opportunity.owner_name) && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                {/* Source */}
                {source && (() => {
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
                    lead_migration: {
                      icon: Users,
                      label: 'Lead',
                      className: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                    },
                    manual: {
                      icon: Edit,
                      label: 'Manual',
                      className: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                    },
                    other: {
                      icon: Package,
                      label: 'Outro',
                      className: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                    }
                  };

                  const config = sourceConfig[source] || sourceConfig.other;
                  const SourceIcon = config.icon;

                  return (
                    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium ${config.className}`}>
                      <SourceIcon className="w-2.5 h-2.5" />
                      <span>{config.label}</span>
                    </div>
                  );
                })()}

                {/* Responsible */}
                {opportunity.owner_name && (
                  <div className="flex items-center gap-1.5" title={`Responsável: ${opportunity.owner_name}`}>
                    {opportunity.owner_avatar ? (
                      <img
                        src={opportunity.owner_avatar}
                        alt={opportunity.owner_name}
                        loading="lazy"
                        className="w-5 h-5 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                          {opportunity.owner_name?.charAt(0)}
                        </span>
                      </div>
                    )}
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate max-w-[60px]">
                      {(() => {
                        const names = (opportunity.owner_name || '').trim().split(' ').filter(n => n.length > 0);
                        if (names.length === 1) return names[0];
                        if (names.length > 1) return `${names[0]} ${names[1][0]}.`;
                        return '';
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
    return prevProps.opportunity.id === nextProps.opportunity.id &&
           prevProps.opportunity.stage_id === nextProps.opportunity.stage_id &&
           prevProps.opportunity.updated_at === nextProps.opportunity.updated_at &&
           prevProps.index === nextProps.index;
  });

  // =====================================================
  // KANBAN COLUMN with infinite scroll (exactly like LeadsPage)
  // =====================================================
  const KanbanColumn = ({ stage, stageId }) => {
    const [loadingMore, setLoadingMore] = useState(false);
    const loadMoreRef = useRef(null);
    const loadingRef = useRef(false); // Prevent duplicate loads

    // Get opportunities already loaded for this stage
    const stageOpportunities = getOpportunitiesByStage(stageId);

    // Get real total from server
    const realTotal = totalsByStage[stageId] || 0;

    // Check if there are more opportunities to load
    const hasMore = stageOpportunities.length < realTotal;

    // Register scroll container ref in parent
    const setScrollRef = useCallback((el) => {
      if (el) {
        columnScrollRefs.current[stageId] = el;
      }
    }, [stageId]);

    // Infinite scroll with Intersection Observer
    useEffect(() => {
      const observer = new IntersectionObserver(
        async (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && hasMore && !loadingRef.current) {
            loadingRef.current = true;
            setLoadingMore(true);
            await loadMoreOpportunitiesForStage(stageId);
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
    }, [hasMore, stageId, stageOpportunities.length]);

    return (
      <div className="flex-1 min-w-[270px] max-w-[290px] flex flex-col">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color || '#6366f1' }}
            />
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
              {stage.name}
            </h3>
            <span className={getStageBadgeClasses(stage)}>
              {realTotal}
            </span>
          </div>
          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded transition-colors">
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Scroll wrapper */}
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
          <Droppable droppableId={stageId}>
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
                {stageOpportunities.length > 0 ? (
                  <div className="space-y-2">
                    {stageOpportunities.map((opp, index) => (
                      <OpportunityCard key={opp.id} opportunity={opp} index={index} />
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
                    {snapshot.isDraggingOver ? 'Solte aqui' : 'Sem oportunidades'}
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

  // =====================================================
  // TABLE HEADER
  // =====================================================
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

  // =====================================================
  // LIST VIEW
  // =====================================================
  const ListView = () => {
    const totalPages = Math.ceil(totalOpportunities / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalOpportunities);

    const getStageForOpp = (stageId) => stages.find(s => s.id === stageId);

    return (
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <TableHeader field="title" label="Oportunidade" />
                <TableHeader field="contact_name" label="Contato" />
                <TableHeader field="stage_id" label="Etapa" />
                <TableHeader field="value" label="Valor" />
                <TableHeader field="expected_close_date" label="Previsão" />
                <TableHeader field="owner_name" label="Responsável" />
                <TableHeader field="created_at" label="Criado" />
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {opportunities.map((opp) => {
                const stage = getStageForOpp(opp.stage_id);

                return (
                  <tr key={opp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                        {opp.title}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {opp.contact_picture ? (
                          <img src={opp.contact_picture} alt={opp.contact_name} className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-semibold">
                            {opp.contact_name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{opp.contact_name}</div>
                          {opp.contact_company && <div className="text-[10px] text-gray-500 truncate">{opp.contact_company}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {stage && <span className={getStageBadgeClasses(stage)}>{stage.name}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(opp.value)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-500">
                      {opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {opp.owner_name ? (
                        <div className="flex items-center gap-1.5">
                          {opp.owner_avatar ? (
                            <img src={opp.owner_avatar} alt={opp.owner_name} className="w-5 h-5 rounded-full" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400">{opp.owner_name?.charAt(0)}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-gray-700 dark:text-gray-300 truncate max-w-[80px]">{opp.owner_name}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-500">
                      {new Date(opp.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setEditingOpportunity(opp); setShowOpportunityModal(true); }}
                        className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">Itens por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[10px] text-gray-600 dark:text-gray-400">
                Mostrando {startIndex + 1}-{endIndex} de {totalOpportunities}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">Primeira</button>
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-3.5 h-3.5" /></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">Última</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Organize pipelines by project
  const pipelinesByProject = pipelines.reduce((acc, pipeline) => {
    const key = pipeline.project_id || 'no_project';
    if (!acc[key]) acc[key] = [];
    acc[key].push(pipeline);
    return acc;
  }, {});

  // =====================================================
  // LOADING STATE - EXACTLY LIKE LEADSPAGE
  // =====================================================
  if (loading && opportunities.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar - Projects & Pipelines */}
      <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">Pipelines</h3>
          <div
            onClick={() => { if (pipelines.length > 0) handleSelectPipeline(pipelines[0]); }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-all ${!selectedPipelineId ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            <Target className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Todas</span>
            <span className="text-[10px] text-gray-400">{pipelines.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-1.5">
          {projects.map(project => {
            const projectPipelines = pipelinesByProject[project.id] || [];
            const isExpanded = expandedProjects.has(project.id);

            return (
              <div key={project.id} className="mb-1">
                <div onClick={() => toggleProject(project.id)} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <FolderOpen className="w-3.5 h-3.5" style={{ color: project.color || '#6366f1' }} />
                  <span className="flex-1 truncate">{project.name}</span>
                  <span className="text-[10px] text-gray-400">{projectPipelines.length}</span>
                </div>

                {isExpanded && projectPipelines.length > 0 && (
                  <div className="ml-4 mt-0.5">
                    {projectPipelines.map(pipeline => (
                      <div
                        key={pipeline.id}
                        onClick={() => handleSelectPipeline(pipeline)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-all ${selectedPipelineId === pipeline.id ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pipeline.color || '#6366f1' }} />
                        <span className="flex-1 truncate">{pipeline.name}</span>
                        <span className="text-[10px] text-gray-400">{pipeline.opportunities_count || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {(pipelinesByProject['no_project'] || []).length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase">Sem Projeto</div>
              {pipelinesByProject['no_project'].map(pipeline => (
                <div
                  key={pipeline.id}
                  onClick={() => handleSelectPipeline(pipeline)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-all ${selectedPipelineId === pipeline.id ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pipeline.color || '#6366f1' }} />
                  <span className="flex-1 truncate">{pipeline.name}</span>
                  <span className="text-[10px] text-gray-400">{pipeline.opportunities_count || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasPermission('pipelines:create') && (
          <div className="p-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { setEditingPipeline(null); setShowPipelineSettings(true); }}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Pipeline
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {selectedPipeline && (
                <>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedPipeline.color || '#6366f1' }} />
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{selectedPipeline.name}</h1>
                </>
              )}
            </div>

            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar oportunidades..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-gray-700 dark:text-gray-300 transition-colors">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filtros</span>
            </button>

            <div className="flex items-center bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-0.5">
              <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded transition-colors ${viewMode === 'kanban' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`} title="Kanban"><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`} title="Lista"><ListIcon className="w-4 h-4" /></button>
            </div>

            {selectedPipeline && (
              <button onClick={handleCreateOpportunity} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                <span className="font-medium">Nova Oportunidade</span>
              </button>
            )}

            {selectedPipeline && hasPermission('pipelines:edit') && (
              <button onClick={() => { setEditingPipeline(selectedPipeline); setShowPipelineSettings(true); }} className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Configurações da Pipeline">
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {selectedPipeline ? (
            <>
              {viewMode === 'kanban' && (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <div className="h-full px-6 py-4 overflow-x-auto">
                    <div className="flex gap-4 h-full min-w-max">
                      {stages.map(stage => (
                        <KanbanColumn key={stage.id} stage={stage} stageId={stage.id} />
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
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center h-full">
              <Target className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Selecione uma Pipeline</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Escolha uma pipeline no menu lateral ou crie uma nova</p>
              {hasPermission('pipelines:create') && (
                <button onClick={() => { setEditingPipeline(null); setShowPipelineSettings(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  Criar Pipeline
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showOpportunityModal && selectedPipeline && (
        <OpportunityModal
          opportunity={editingOpportunity}
          pipeline={selectedPipeline}
          onClose={() => { setShowOpportunityModal(false); setEditingOpportunity(null); }}
          onSave={handleOpportunitySaved}
        />
      )}

      {showPipelineSettings && (
        <PipelineSettingsModal
          pipeline={editingPipeline}
          projects={projects}
          onClose={() => { setShowPipelineSettings(false); setEditingPipeline(null); }}
          onSave={() => {
            setShowPipelineSettings(false);
            setEditingPipeline(null);
            loadPipelinesAndProjects();
            if (selectedPipelineId) {
              if (viewMode === 'kanban') loadOpportunitiesKanban(false);
              else loadOpportunitiesList();
            }
          }}
        />
      )}

      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          onClose={() => { setShowProjectModal(false); setEditingProject(null); }}
          onSave={() => { setShowProjectModal(false); setEditingProject(null); loadPipelinesAndProjects(); }}
        />
      )}
    </div>
  );
};

export default PipelinesPage;
