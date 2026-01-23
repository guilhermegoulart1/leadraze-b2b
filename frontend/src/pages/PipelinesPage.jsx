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
  Clock,
  Loader,
  FolderPlus,
  X,
  Tag,
  Map
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import OpportunityModal from '../components/pipelines/OpportunityModal';
import PipelineSettingsModal from '../components/pipelines/PipelineSettingsModal';
import ProjectModal from '../components/pipelines/ProjectModal';
import WinOpportunityModal from '../components/pipelines/WinOpportunityModal';
import LoseOpportunityModal from '../components/pipelines/LoseOpportunityModal';
import LeadDetailModal from '../components/LeadDetailModal';
import PipelineFiltersPanel from '../components/pipelines/PipelineFiltersPanel';
import UnifiedContactModal from '../components/UnifiedContactModal';
import StageRoadmapsModal from '../components/pipelines/StageRoadmapsModal';

// Mapa de cores legadas (para compatibilidade com dados antigos)
const LEGACY_COLOR_MAP = {
  slate: '#64748b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  orange: '#f97316',
  emerald: '#10b981',
  red: '#ef4444',
  pink: '#ec4899',
  cyan: '#0891b2'
};

// Resolver cor (suporta hex e nomes legados)
const resolveColor = (color) => {
  if (!color) return '#6366f1';
  if (color.startsWith('#')) return color;
  return LEGACY_COLOR_MAP[color] || '#6366f1';
};

const PipelinesPage = () => {
  const { hasPermission } = useAuth();
  const { t } = useTranslation('pipelines');
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [pipelines, setPipelines] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState(searchParams.get('pipeline') || null);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [stages, setStages] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState('kanban');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalOpportunities, setTotalOpportunities] = useState(0);
  const [totalsByStage, setTotalsByStage] = useState({});

  
  // Modals
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [showPipelineSettings, setShowPipelineSettings] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loadingLeadModal, setLoadingLeadModal] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [initialStageId, setInitialStageId] = useState(null);
  const [showStageRoadmapsModal, setShowStageRoadmapsModal] = useState(false);

  // Win/Lose modals
  const [showWinModal, setShowWinModal] = useState(false);
  const [pendingWinOpp, setPendingWinOpp] = useState(null);
  const [pendingWinStageId, setPendingWinStageId] = useState(null);
  const [showLoseModal, setShowLoseModal] = useState(false);
  const [pendingLoseOpp, setPendingLoseOpp] = useState(null);
  const [pendingLoseStageId, setPendingLoseStageId] = useState(null);

  // Delete project modal
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState(null);
  const [deleteProjectInfo, setDeleteProjectInfo] = useState(null);
  const [deletingProjectLoading, setDeletingProjectLoading] = useState(false);

  // Kanban column limit
  const KANBAN_COLUMN_LIMIT = 20;
  const columnScrollRefs = useRef({});
  const columnScrollPositions = useRef({});
  const [loadedPagesByStage, setLoadedPagesByStage] = useState({});

  // Filters state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    stages: [],
    tags: [],
    owner_id: null,
    value_min: null,
    value_max: null,
    date_from: null,
    date_to: null,
    sources: [],
    has_email: null,
    has_phone: null
  });
  const [allTags, setAllTags] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [dynamicSources, setDynamicSources] = useState([]);

  // Calculate active filters count
  const activeFiltersCount = [
    filters.stages.length > 0,
    filters.tags.length > 0,
    filters.owner_id !== null,
    filters.value_min !== null || filters.value_max !== null,
    filters.date_from !== null || filters.date_to !== null,
    filters.sources.length > 0,
    filters.has_email !== null,
    filters.has_phone !== null
  ].filter(Boolean).length;

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

  // Load dynamic lead sources
  useEffect(() => {
    const loadSources = async () => {
      try {
        const response = await api.getLeadSources({ active_only: 'true' });
        if (response.data?.sources) {
          setDynamicSources(response.data.sources);
        }
      } catch (error) {
        console.error('Error loading lead sources:', error);
      }
    };
    loadSources();
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

  // Load tags and users for filters
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [tagsRes, usersRes] = await Promise.all([
          api.getTags(),
          api.getUsers()
        ]);
        if (tagsRes.success) {
          setAllTags(tagsRes.data?.tags || []);
        }
        if (usersRes.success) {
          setAllUsers(usersRes.data?.users || []);
        }
      } catch (err) {
        console.error('Erro ao carregar dados de filtros:', err);
      }
    };
    loadFilterData();
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (selectedPipelineId) {
      if (viewMode === 'kanban') {
        loadOpportunitiesKanban();
      } else {
        loadOpportunitiesList();
      }
    }
  }, [filters]);

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

        // Check if selected pipeline from URL exists
        const urlPipelineId = searchParams.get('pipeline');
        const pipelineExists = urlPipelineId && pipelinesData.some(p => p.id === urlPipelineId);

        if (pipelineExists) {
          // Pipeline exists, keep selection
          setSelectedPipelineId(urlPipelineId);
        } else if (pipelinesData.length > 0) {
          // Pipeline doesn't exist or no selection - select first
          const firstPipeline = pipelinesData[0];
          setSelectedPipelineId(firstPipeline.id);
          setSearchParams({ pipeline: firstPipeline.id });
        } else {
          // No pipelines available - clear selection
          setSelectedPipelineId(null);
          setSelectedPipeline(null);
          setStages([]);
          setOpportunities([]);
          setSearchParams({});
        }
      }

      if (projectsRes.success) {
        const projectsData = projectsRes.data?.projects || [];
        setProjects(projectsData);
      }
    } catch (error) {
      console.error('Erro ao carregar pipelines:', error);
    } finally {
      // Initial page load complete
      setLoading(false);
    }
  };

  const loadOpportunitiesKanban = async (showLoading = true) => {
    if (!selectedPipelineId) return;

    try {
      // Show loading on initial load or when switching pipelines
      if (showLoading) {
        setLoadingContent(true);
      }

      // Load pipeline details first
      const pipelineRes = await api.getPipeline(selectedPipelineId);
      if (pipelineRes.success && pipelineRes.data.pipeline) {
        setSelectedPipeline(pipelineRes.data.pipeline);
      } else {
        // Pipeline doesn't exist - clear selection and redirect
        setSelectedPipelineId(null);
        setSelectedPipeline(null);
        setStages([]);
        setOpportunities([]);
        setSearchParams({});
        setLoadingContent(false);
        return;
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
      setLoadingContent(false);
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
      setLoadingContent(true);

      // Load pipeline details
      const pipelineRes = await api.getPipeline(selectedPipelineId);
      if (pipelineRes.success && pipelineRes.data.pipeline) {
        setSelectedPipeline(pipelineRes.data.pipeline);
        setStages(pipelineRes.data.pipeline.stages || []);
      } else {
        // Pipeline doesn't exist - clear selection and redirect
        setSelectedPipelineId(null);
        setSelectedPipeline(null);
        setStages([]);
        setOpportunities([]);
        setSearchParams({});
        setLoadingContent(false);
        return;
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
      setLoadingContent(false);
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
    if (pipeline.id === selectedPipelineId) return;

    // Show loading and clear current data immediately
    setLoadingContent(true);
    setStages([]);
    setOpportunities([]);
    setSelectedPipeline(null);

    setSelectedPipelineId(pipeline.id);
    setSearchParams({ pipeline: pipeline.id });
  };

  // Inline editing for project name
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  // Project menu state
  const [projectMenuOpen, setProjectMenuOpen] = useState(null);
  const [newPipelineProjectId, setNewPipelineProjectId] = useState(null);

  // Close project menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setProjectMenuOpen(null);
    if (projectMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [projectMenuOpen]);

  const handleProjectNameClick = (project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const handleProjectNameSave = async (projectId) => {
    if (!editingProjectName.trim()) {
      setEditingProjectId(null);
      return;
    }

    try {
      await api.updateCrmProject(projectId, { name: editingProjectName.trim() });
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, name: editingProjectName.trim() } : p
      ));
    } catch (error) {
      console.error('Erro ao renomear projeto:', error);
    }
    setEditingProjectId(null);
  };

  const handleProjectNameKeyDown = (e, projectId) => {
    if (e.key === 'Enter') {
      handleProjectNameSave(projectId);
    } else if (e.key === 'Escape') {
      setEditingProjectId(null);
    }
  };

  // Handle delete project
  const handleDeleteProject = async (project) => {
    setProjectMenuOpen(null);
    setDeletingProject(project);
    setDeletingProjectLoading(true);

    try {
      // First call without force to check if has pipelines
      const response = await api.deleteCrmProject(project.id, false);

      if (response.success && response.data?.requires_confirmation) {
        // Has pipelines - show confirmation modal
        setDeleteProjectInfo(response.data);
        setShowDeleteProjectModal(true);
      } else if (response.success) {
        // Empty project - deleted directly
        setProjects(prev => prev.filter(p => p.id !== project.id));
        setDeletingProject(null);
      }
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      setDeletingProject(null);
    } finally {
      setDeletingProjectLoading(false);
    }
  };

  const confirmDeleteProject = async () => {
    if (!deletingProject) return;

    setDeletingProjectLoading(true);
    try {
      const response = await api.deleteCrmProject(deletingProject.id, true);

      if (response.success) {
        // Remove project from list
        setProjects(prev => prev.filter(p => p.id !== deletingProject.id));

        // If selected pipeline was in this project, clear selection
        const deletedPipelineIds = pipelines
          .filter(p => p.project_id === deletingProject.id)
          .map(p => p.id);

        if (deletedPipelineIds.includes(selectedPipelineId)) {
          setSelectedPipelineId(null);
          setSelectedPipeline(null);
          setStages([]);
          setOpportunities([]);
          setSearchParams({});
        }

        // Remove pipelines from list
        setPipelines(prev => prev.filter(p => p.project_id !== deletingProject.id));
      }
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
    } finally {
      setShowDeleteProjectModal(false);
      setDeletingProject(null);
      setDeleteProjectInfo(null);
      setDeletingProjectLoading(false);
    }
  };

  // Handle sidebar drag & drop (projects reordering + pipelines between projects)
  const handleSidebarDragEnd = async (result) => {
    const { source, destination, type, draggableId } = result;

    if (!destination) return;

    // Reordering projects
    if (type === 'project') {
      if (source.index === destination.index) return;

      const newProjects = Array.from(projects);
      const [removed] = newProjects.splice(source.index, 1);
      newProjects.splice(destination.index, 0, removed);
      setProjects(newProjects);

      try {
        const orders = newProjects.map((project, index) => ({
          id: project.id,
          display_order: index
        }));
        await api.reorderCrmProjects(orders);
      } catch (error) {
        console.error('Erro ao reordenar projetos:', error);
        loadPipelinesAndProjects();
      }
      return;
    }

    // Moving pipeline between projects
    if (type === 'pipeline') {
      const pipelineId = draggableId.replace('pipeline-', '');
      const sourceProjectId = source.droppableId.replace('project-pipelines-', '');
      const destProjectId = destination.droppableId.replace('project-pipelines-', '');

      // Same project, no action needed (no reordering within project)
      if (sourceProjectId === destProjectId) return;

      // Update locally
      setPipelines(prev => prev.map(p =>
        p.id === pipelineId ? { ...p, project_id: destProjectId } : p
      ));

      // Save to backend
      try {
        await api.updatePipeline(pipelineId, { project_id: destProjectId });
      } catch (error) {
        console.error('Erro ao mover pipeline:', error);
        loadPipelinesAndProjects();
      }
    }
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const oppId = draggableId.replace('opp-', '');
    const newStageId = destination.droppableId;
    const sourceStageId = source.droppableId;

    // Find the opportunity and target stage
    const opportunity = opportunities.find(o => String(o.id) === String(oppId));
    const targetStage = stages.find(s => s.id === newStageId);

    if (!opportunity || !targetStage) return;

    // Check if moving to win or loss stage
    if (targetStage.is_win_stage && sourceStageId !== newStageId) {
      // Show win modal instead of directly moving
      setPendingWinOpp(opportunity);
      setPendingWinStageId(newStageId);
      setShowWinModal(true);
      return; // Don't do optimistic update - wait for modal
    }

    if (targetStage.is_loss_stage && sourceStageId !== newStageId) {
      // Show lose modal instead of directly moving
      setPendingLoseOpp(opportunity);
      setPendingLoseStageId(newStageId);
      setShowLoseModal(true);
      return; // Don't do optimistic update - wait for modal
    }

    // For normal stages, do optimistic update
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
        await api.moveOpportunity(oppId, { stage_id: newStageId });
      } catch (error) {
        console.error('Erro ao mover oportunidade:', error);
        loadOpportunitiesKanban(false);
      }
    }
  };

  // Handle win modal success
  const handleWinSuccess = (updatedOpp) => {
    // Capture values before clearing
    const targetStageId = pendingWinStageId;
    const originalOpp = pendingWinOpp;

    // Close modal and clear state
    setShowWinModal(false);
    setPendingWinOpp(null);
    setPendingWinStageId(null);

    // Update state locally for immediate feedback
    if (originalOpp && targetStageId) {
      setOpportunities(prevOpps => {
        const newOpps = [...prevOpps];
        const oppIndex = newOpps.findIndex(o => String(o.id) === String(originalOpp.id));
        if (oppIndex !== -1) {
          newOpps[oppIndex] = {
            ...newOpps[oppIndex],
            ...(updatedOpp || {}),
            stage_id: targetStageId,
            won_at: new Date().toISOString()
          };
        }
        return newOpps;
      });
    }

    // Also reload to ensure data is fully synced (with delay)
    setTimeout(() => loadOpportunitiesKanban(false), 300);
  };

  // Handle lose modal success
  const handleLoseSuccess = (updatedOpp) => {
    // Capture values before clearing
    const targetStageId = pendingLoseStageId;
    const originalOpp = pendingLoseOpp;

    // Close modal and clear state
    setShowLoseModal(false);
    setPendingLoseOpp(null);
    setPendingLoseStageId(null);

    // Update state locally for immediate feedback
    if (originalOpp && targetStageId) {
      setOpportunities(prevOpps => {
        const newOpps = [...prevOpps];
        const oppIndex = newOpps.findIndex(o => String(o.id) === String(originalOpp.id));
        if (oppIndex !== -1) {
          newOpps[oppIndex] = {
            ...newOpps[oppIndex],
            ...(updatedOpp || {}),
            stage_id: targetStageId,
            lost_at: new Date().toISOString()
          };
        }
        return newOpps;
      });
    }

    // Also reload to ensure data is fully synced (with delay)
    setTimeout(() => loadOpportunitiesKanban(false), 300);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCreateOpportunity = (stageId = null) => {
    setEditingOpportunity(null);
    setInitialStageId(stageId);
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

  // Handle opening lead detail modal
  const handleOpenLeadDetail = async (opportunity) => {
    if (!opportunity) return;

    try {
      setLoadingLeadModal(true);
      // Load full opportunity data (includes all contact fields + AI enrichment + source, etc.)
      const response = await api.getLead(opportunity.id);
      if (response.success) {
        const opp = response.data.opportunity || response.data;
        // Map opportunity to lead-like structure for LeadDetailModal
        setSelectedLead({
          id: opp.contact_id || opp.id,
          contact_id: opp.contact_id,
          opportunity_id: opp.id,
          name: opp.contact_name || opp.title,
          title: opp.contact_title,
          company: opp.contact_company,
          location: opp.contact_location,
          email: opp.contact_email,
          phone: opp.contact_phone,
          profile_picture: opp.contact_picture,
          profile_url: opp.contact_profile_url,
          about: opp.contact_about,
          headline: opp.contact_headline,
          website: opp.contact_website,
          company_description: opp.contact_company_description,
          company_services: opp.contact_company_services,
          pain_points: opp.contact_pain_points,
          photos: opp.contact_photos,
          business_category: opp.contact_business_category,
          rating: opp.contact_rating,
          review_count: opp.contact_review_count,
          industry: opp.contact_industry,
          city: opp.contact_city,
          state: opp.contact_state,
          country: opp.contact_country,
          connections_count: opp.contact_connections,
          emails: opp.contact_emails,
          phones: opp.contact_phones,
          social_links: opp.contact_social_links,
          team_members: opp.contact_team_members,
          // AI Analysis
          ai_profile_analysis: opp.ai_profile_analysis,
          ai_analyzed_at: opp.ai_analyzed_at,
          public_identifier: opp.contact_public_identifier || opp.contact_linkedin_id,
          status: opp.won_at ? 'qualified' : opp.lost_at ? 'discarded' : 'leads',
          source: opp.source,
          created_at: opp.created_at,
          tags: opp.tags || [],
          responsible_id: opp.owner_user_id,
          responsible_name: opp.owner_name,
          responsible_avatar: opp.owner_avatar,
          opportunity_value: opp.value,
          // Pipeline info
          pipeline_id: opp.pipeline_id,
          pipeline_name: opp.pipeline_name,
          stage_id: opp.stage_id,
          stage_name: opp.stage_name,
          // History
          history: opp.history
        });
      }
    } catch (error) {
      console.error('Erro ao carregar oportunidade:', error);
      // Fallback: Use data from kanban card
      setSelectedLead({
        id: opportunity.id,
        opportunity_id: opportunity.id,
        name: opportunity.contact_name,
        title: opportunity.contact_title,
        company: opportunity.contact_company,
        location: opportunity.contact_location,
        email: opportunity.contact_email,
        phone: opportunity.contact_phone,
        profile_picture: opportunity.contact_picture,
        public_identifier: opportunity.contact_linkedin_id,
        status: opportunity.won_at ? 'qualified' : opportunity.lost_at ? 'discarded' : 'leads',
        source: opportunity.source,
        created_at: opportunity.created_at,
        tags: opportunity.tags || [],
        responsible_id: opportunity.owner_user_id,
        responsible_name: opportunity.owner_name,
        responsible_avatar: opportunity.owner_avatar
      });
    } finally {
      setLoadingLeadModal(false);
    }
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
                  handleOpenLeadDetail(opportunity);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded flex-shrink-0"
                title={t('actions.viewDetails')}
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
                  // Check if source exists in dynamic sources first
                  const dynamicSource = dynamicSources.find(s => s.name === source);

                  if (dynamicSource) {
                    // Use dynamic source data
                    return (
                      <div
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium"
                        style={{
                          backgroundColor: `${dynamicSource.color}15`,
                          color: dynamicSource.color,
                          borderColor: `${dynamicSource.color}40`
                        }}
                      >
                        <span className="w-2.5 h-2.5 flex items-center justify-center text-[8px] font-bold">
                          {dynamicSource.icon || '?'}
                        </span>
                        <span>{dynamicSource.label}</span>
                      </div>
                    );
                  }

                  // Fallback to hardcoded config for legacy sources
                  const sourceConfig = {
                    linkedin: {
                      icon: Linkedin,
                      label: t('source.linkedin'),
                      className: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                    },
                    google_maps: {
                      icon: MapPin,
                      label: t('source.googleMaps'),
                      className: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                    },
                    list: {
                      icon: ListIcon,
                      label: t('source.list'),
                      className: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                    },
                    paid_traffic: {
                      icon: Zap,
                      label: t('source.paidTraffic'),
                      className: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                    },
                    lead_migration: {
                      icon: Users,
                      label: t('source.lead'),
                      className: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                    },
                    manual: {
                      icon: Edit,
                      label: t('source.manual'),
                      className: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                    },
                    other: {
                      icon: Package,
                      label: t('source.other'),
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
              style={{ backgroundColor: resolveColor(stage.color) }}
            />
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
              {stage.name}
            </h3>
            <span className={getStageBadgeClasses(stage)}>
              {realTotal}
            </span>
          </div>
          <button
            onClick={() => handleCreateOpportunity(stageId)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded transition-colors"
            title="Adicionar oportunidade"
          >
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
                            <span>{t('loadingContent')}</span>
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
                    {snapshot.isDraggingOver ? t('kanban.dropHere') : t('kanban.noOpportunities')}
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
  // LIST VIEW - Similar to LeadsPage
  // =====================================================
  const ListView = () => {
    const totalPages = Math.ceil(totalOpportunities / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalOpportunities);

    const getStageForOpp = (stageId) => stages.find(s => s.id === stageId);

    // Stage badge classes for list view (inline style)
    const getStageInlineBadgeClasses = (stage) => {
      if (!stage) return 'px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
      if (stage.is_win_stage) {
        return 'px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      }
      if (stage.is_loss_stage) {
        return 'px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      }
      return 'px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
    };

    return (
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <TableHeader field="contact_name" label={t('table.lead')} />
                <TableHeader field="stage_id" label={t('table.stage')} />
                <TableHeader field="owner_name" label={t('table.responsible')} />
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
              {opportunities.map((opp) => {
                const stage = getStageForOpp(opp.stage_id);

                return (
                  <tr key={opp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                    {/* Contact Info - Like LeadsPage */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {opp.contact_picture ? (
                          <img
                            src={opp.contact_picture}
                            alt={opp.contact_name}
                            loading="lazy"
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                            {opp.contact_name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="min-w-0 max-w-[250px]">
                          <div className="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate">{opp.contact_name}</div>
                          {opp.contact_company && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={opp.contact_company}>
                              {opp.contact_company}
                            </div>
                          )}
                          {opp.contact_title && (
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate" title={opp.contact_title}>
                              {opp.contact_title}
                            </div>
                          )}
                          {opp.contact_location && (
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-1" title={opp.contact_location}>
                              <MapPin className="w-2.5 h-2.5 inline flex-shrink-0" />
                              <span>{opp.contact_location}</span>
                            </div>
                          )}
                          {/* Value badge if won */}
                          {opp.value > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Trophy className="w-2.5 h-2.5 text-emerald-500" />
                              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(opp.value)}
                              </span>
                            </div>
                          )}
                          {/* LinkedIn link */}
                          {opp.contact_linkedin_id && (
                            <a
                              href={`https://www.linkedin.com/in/${opp.contact_linkedin_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 text-[9px] mt-0.5"
                              title="Ver LinkedIn"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Linkedin className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="px-3 py-2">
                      {stage && <span className={getStageInlineBadgeClasses(stage)}>{stage.name}</span>}
                    </td>

                    {/* Responsible */}
                    <td className="px-3 py-2">
                      {opp.owner_name ? (
                        <div className="flex items-center gap-1.5">
                          {opp.owner_avatar ? (
                            <img
                              src={opp.owner_avatar}
                              alt={opp.owner_name}
                              loading="lazy"
                              className="w-5 h-5 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400">
                                {(() => {
                                  const names = (opp.owner_name || '').trim().split(' ').filter(n => n.length > 0);
                                  if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
                                  return (names[0][0] + names[1][0]).toUpperCase();
                                })()}
                              </span>
                            </div>
                          )}
                          <span className="text-[10px] text-gray-700 dark:text-gray-300 truncate max-w-[90px]">
                            {(() => {
                              const names = (opp.owner_name || '').trim().split(' ').filter(n => n.length > 0);
                              if (names.length === 1) return names[0];
                              return `${names[0]} ${names[1][0]}.`;
                            })()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">{t('responsible.notAssigned')}</span>
                      )}
                    </td>

                    {/* Tags */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {opp.tags && opp.tags.slice(0, 2).map((tag) => {
                          const colorClasses = {
                            purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
                            blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                            green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                            yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                            red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                            pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
                            orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
                            gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                          };
                          const colorClass = colorClasses[tag.color] || colorClasses.purple;

                          return (
                            <span
                              key={tag.id}
                              className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${colorClass}`}
                            >
                              {tag.name}
                            </span>
                          );
                        })}
                        {opp.tags && opp.tags.length > 2 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            +{opp.tags.length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2 text-[10px] text-gray-500 dark:text-gray-400">
                      {new Date(opp.created_at).toLocaleDateString('pt-BR')}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => handleOpenLeadDetail(opp)}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title={t('actions.viewDetails')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title={t('actions.edit')}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title={t('actions.delete')}
                        >
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">{t('pagination.itemsPerPage')}</span>
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
                {t('pagination.showing')} {startIndex + 1}-{endIndex} {t('pagination.of')} {totalOpportunities}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">{t('pagination.first')}</button>
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-3.5 h-3.5" /></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">{t('pagination.last')}</button>
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
  // INITIAL LOADING STATE - Only on first page load
  // =====================================================
  if (loading && pipelines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar - Projects & Pipelines */}
      <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide">{t('title')}</h3>
            {hasPermission('pipelines:create') && (
              <button
                onClick={() => { setEditingProject(null); setShowProjectModal(true); }}
                className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title={t('newProject')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-1.5">
          <DragDropContext onDragEnd={handleSidebarDragEnd}>
            <Droppable droppableId="projects-list" type="project">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {projects.map((project, index) => {
                    const projectPipelines = pipelinesByProject[project.id] || [];

                    return (
                      <Draggable key={project.id} draggableId={`project-${project.id}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`mb-3 ${snapshot.isDragging ? 'opacity-80 bg-gray-100 dark:bg-gray-700 rounded-md' : ''}`}
                          >
                            {/* Project header - section header style with inline editing */}
                            <div
                              {...provided.dragHandleProps}
                              className="px-0 py-1 cursor-grab group/project flex items-center justify-between"
                            >
                              {editingProjectId === project.id ? (
                                <input
                                  type="text"
                                  value={editingProjectName}
                                  onChange={(e) => setEditingProjectName(e.target.value)}
                                  onBlur={() => handleProjectNameSave(project.id)}
                                  onKeyDown={(e) => handleProjectNameKeyDown(e, project.id)}
                                  className="w-full text-[10px] font-medium text-gray-900 dark:text-white uppercase bg-white dark:bg-gray-700 border border-purple-500 rounded px-1 py-0.5 focus:outline-none"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <>
                                  <span
                                    className="text-[10px] font-medium text-gray-400 uppercase cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                                    onClick={(e) => { e.stopPropagation(); handleProjectNameClick(project); }}
                                  >
                                    {project.name}
                                  </span>
                                  {hasPermission('pipelines:create') && (
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setProjectMenuOpen(projectMenuOpen === project.id ? null : project.id);
                                        }}
                                        className="opacity-0 group-hover/project:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                                        title="Opções"
                                      >
                                        <MoreVertical className="w-3 h-3" />
                                      </button>
                                      {projectMenuOpen === project.id && (
                                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setProjectMenuOpen(null);
                                              setEditingPipeline(null);
                                              setNewPipelineProjectId(project.id);
                                              setShowPipelineSettings(true);
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                          >
                                            <Target className="w-3.5 h-3.5" />
                                            {t('newPipeline')}
                                          </button>
                                          {hasPermission('pipelines:delete') && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProject(project);
                                              }}
                                              className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              {t('deleteProject')}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Pipelines under this project - droppable for pipeline drag */}
                            <Droppable droppableId={`project-pipelines-${project.id}`} type="pipeline">
                              {(droppableProvided, droppableSnapshot) => (
                                <div
                                  ref={droppableProvided.innerRef}
                                  {...droppableProvided.droppableProps}
                                  className={`mt-0.5 min-h-[20px] rounded transition-colors ${droppableSnapshot.isDraggingOver ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
                                >
                                  {projectPipelines.length === 0 && !droppableSnapshot.isDraggingOver && (
                                    <span className="text-[9px] text-gray-400 dark:text-gray-500 italic px-2">{t('empty')}</span>
                                  )}
                                  {projectPipelines.map((pipeline, pipelineIndex) => (
                                    <Draggable key={pipeline.id} draggableId={`pipeline-${pipeline.id}`} index={pipelineIndex}>
                                      {(draggableProvided, draggableSnapshot) => (
                                        <div
                                          ref={draggableProvided.innerRef}
                                          {...draggableProvided.draggableProps}
                                          {...draggableProvided.dragHandleProps}
                                          onClick={() => handleSelectPipeline(pipeline)}
                                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-all ${
                                            draggableSnapshot.isDragging
                                              ? 'shadow-lg bg-white dark:bg-gray-700 ring-2 ring-purple-400 text-gray-700 dark:text-gray-300'
                                              : selectedPipelineId === pipeline.id
                                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                                          }`}
                                        >
                                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: resolveColor(pipeline.color) }} />
                                          <span className="flex-1 truncate">{pipeline.name}</span>
                                          <span className="text-[10px] text-gray-400">{pipeline.opportunities_count || 0}</span>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {droppableProvided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
        {/* Header - so mostrar se tem projetos e pipelines */}
        {projects.length > 0 && pipelines.length > 0 && (
          <div className="flex-shrink-0 px-6 pt-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('search')}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Filters Button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                    showFilters || activeFiltersCount > 0
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('filters')}</span>
                  {activeFiltersCount > 0 && (
                    <span className="flex items-center justify-center w-5 h-5 bg-purple-600 text-white text-xs font-semibold rounded-full">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {/* Filters Panel Dropdown */}
                {showFilters && (
                  <PipelineFiltersPanel
                    filters={filters}
                    onChange={setFilters}
                    stages={stages}
                    tags={allTags}
                    users={allUsers}
                    onClose={() => setShowFilters(false)}
                  />
                )}
              </div>

              <div className="flex items-center bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-0.5">
                <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded transition-colors ${viewMode === 'kanban' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`} title="Kanban"><LayoutGrid className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`} title="Lista"><ListIcon className="w-4 h-4" /></button>
              </div>

              {selectedPipeline && (
                <button onClick={handleCreateOpportunity} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">{t('newOpportunity')}</span>
                </button>
              )}

              {selectedPipeline && hasPermission('pipelines:edit') && (
                <>
                  <button onClick={() => setShowStageRoadmapsModal(true)} className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Roadmaps Automaticos">
                    <Map className="w-5 h-5" />
                  </button>
                  <button onClick={() => { setEditingPipeline(selectedPipeline); setShowPipelineSettings(true); }} className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title={t('pipelineSettings')}>
                    <Settings className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Active Filters Pills */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {filters.stages.length > 0 && filters.stages.map(stageId => {
                  const stage = stages.find(s => s.id === stageId);
                  return stage && (
                    <span key={stageId} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: resolveColor(stage.color) }}></span>
                      {stage.name}
                      <button onClick={() => setFilters({ ...filters, stages: filters.stages.filter(id => id !== stageId) })} className="ml-1 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                {filters.tags.length > 0 && filters.tags.map(tagId => {
                  const tag = allTags.find(t => t.id === tagId);
                  return tag && (
                    <span key={tagId} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                      <Tag className="w-3 h-3" />
                      {tag.name}
                      <button onClick={() => setFilters({ ...filters, tags: filters.tags.filter(id => id !== tagId) })} className="ml-1 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                {filters.owner_id && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                    <User className="w-3 h-3" />
                    {allUsers.find(u => u.id === filters.owner_id)?.name || 'Responsável'}
                    <button onClick={() => setFilters({ ...filters, owner_id: null })} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(filters.value_min || filters.value_max) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                    <DollarSign className="w-3 h-3" />
                    {filters.value_min && `R$ ${filters.value_min}`}
                    {filters.value_min && filters.value_max && ' - '}
                    {filters.value_max && `R$ ${filters.value_max}`}
                    <button onClick={() => setFilters({ ...filters, value_min: null, value_max: null })} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(filters.date_from || filters.date_to) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                    <Calendar className="w-3 h-3" />
                    Período
                    <button onClick={() => setFilters({ ...filters, date_from: null, date_to: null })} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={() => setFilters({ stages: [], tags: [], owner_id: null, value_min: null, value_max: null, date_from: null, date_to: null, sources: [], has_email: null, has_phone: null })}
                  className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {/* Loading Overlay */}
          {loadingContent && (
            <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader className="w-8 h-8 text-purple-500 animate-spin" />
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('loadingContent')}</span>
              </div>
            </div>
          )}

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
          ) : !loadingContent && (
            <div className="flex-1 flex flex-col items-center justify-center h-full">
              {projects.length === 0 ? (
                // Sem projetos - oferecer criar projeto
                <>
                  <FolderPlus className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                  <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('noProjectsTitle')}</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">{t('noProjectsSubtitle')}</p>
                  {hasPermission('pipelines:create') && (
                    <button onClick={() => { setEditingProject(null); setShowProjectModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors">
                      <Plus className="w-4 h-4" />
                      {t('createProject')}
                    </button>
                  )}
                </>
              ) : (
                // Com projetos mas sem pipeline selecionada
                <>
                  <Target className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                  <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('selectPipeline')}</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">{t('selectPipelineSubtitle')}</p>
                  {hasPermission('pipelines:create') && (
                    <button onClick={() => { setEditingPipeline(null); setShowPipelineSettings(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors">
                      <Plus className="w-4 h-4" />
                      {t('createPipeline')}
                    </button>
                  )}
                </>
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
          initialStageId={initialStageId}
          onClose={() => { setShowOpportunityModal(false); setEditingOpportunity(null); setInitialStageId(null); }}
          onSave={handleOpportunitySaved}
        />
      )}

      {showPipelineSettings && (
        <PipelineSettingsModal
          pipeline={editingPipeline}
          projects={projects}
          defaultProjectId={newPipelineProjectId}
          onClose={() => { setShowPipelineSettings(false); setEditingPipeline(null); setNewPipelineProjectId(null); }}
          onSave={() => {
            setShowPipelineSettings(false);
            setEditingPipeline(null);
            setNewPipelineProjectId(null);
            loadPipelinesAndProjects();
            if (selectedPipelineId) {
              if (viewMode === 'kanban') loadOpportunitiesKanban(false);
              else loadOpportunitiesList();
            }
          }}
        />
      )}

      {showStageRoadmapsModal && selectedPipeline && (
        <StageRoadmapsModal
          pipeline={selectedPipeline}
          onClose={() => setShowStageRoadmapsModal(false)}
        />
      )}

      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          onClose={() => { setShowProjectModal(false); setEditingProject(null); }}
          onSave={() => { setShowProjectModal(false); setEditingProject(null); loadPipelinesAndProjects(); }}
        />
      )}

      {/* Win Modal */}
      <WinOpportunityModal
        isOpen={showWinModal}
        onClose={() => {
          setShowWinModal(false);
          setPendingWinOpp(null);
          setPendingWinStageId(null);
        }}
        opportunity={pendingWinOpp}
        targetStageId={pendingWinStageId}
        onSuccess={handleWinSuccess}
      />

      {/* Lose Modal */}
      <LoseOpportunityModal
        isOpen={showLoseModal}
        onClose={() => {
          setShowLoseModal(false);
          setPendingLoseOpp(null);
          setPendingLoseStageId(null);
        }}
        opportunity={pendingLoseOpp}
        targetStageId={pendingLoseStageId}
        onSuccess={handleLoseSuccess}
      />

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onLeadUpdated={() => {
            // Refresh opportunities after lead update
            if (viewMode === 'kanban') {
              loadOpportunitiesKanban(false);
            } else {
              loadOpportunitiesList();
            }
          }}
          onViewContact={(contactId) => {
            setSelectedContactId(contactId);
          }}
        />
      )}

      {/* Unified Contact Modal - Full contact details */}
      <UnifiedContactModal
        isOpen={!!selectedContactId}
        onClose={() => setSelectedContactId(null)}
        contactId={selectedContactId}
      />

      {/* Loading Lead Modal Overlay */}
      {loadingLeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 text-purple-500 animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('loadingDetails')}</span>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {showDeleteProjectModal && deletingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('deleteProjectModal.title')}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {deletingProject.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {t('deleteProjectModal.warning')}
              </p>

              {deleteProjectInfo && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('deleteProjectModal.pipelines')}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{deleteProjectInfo.pipelines_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('deleteProjectModal.opportunities')}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{deleteProjectInfo.opportunities_count}</span>
                  </div>
                </div>
              )}

              <p className="text-sm text-red-600 dark:text-red-400 mt-4 font-medium">
                {t('deleteProjectModal.irreversible')}
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteProjectModal(false);
                  setDeletingProject(null);
                  setDeleteProjectInfo(null);
                }}
                disabled={deletingProjectLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {t('deleteProjectModal.cancel')}
              </button>
              <button
                onClick={confirmDeleteProject}
                disabled={deletingProjectLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deletingProjectLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {t('deleteProjectModal.deleting')}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {t('deleteProjectModal.confirm')}
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

export default PipelinesPage;
