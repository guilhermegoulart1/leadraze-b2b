// frontend/src/pages/SearchPostsPage.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Filter,
  Loader,
  FileText,
  Calendar,
  Image as ImageIcon,
  Video,
  MessageCircle,
  ThumbsUp,
  Share2,
  ExternalLink,
  CheckCircle,
  Users,
  Building,
  MapPin,
  Linkedin,
  FolderPlus,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  X,
  Heart,
  Sparkles,
  PartyPopper,
  Lightbulb,
  Smile,
  UserPlus
} from 'lucide-react';
import api from '../services/api';

const SearchPostsPage = () => {
  const { t } = useTranslation(['search', 'common']);

  // State
  const [linkedinAccounts, setLinkedinAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  // Search params
  const [keywords, setKeywords] = useState('');
  const [author, setAuthor] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [contentType, setContentType] = useState('');

  // Results
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Selection
  const [selectedPosts, setSelectedPosts] = useState([]);

  // Add to campaign modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [addingToCampaign, setAddingToCampaign] = useState(false);

  // Engaged profiles modal
  const [showEngagedModal, setShowEngagedModal] = useState(false);
  const [selectedPostForEngaged, setSelectedPostForEngaged] = useState(null);
  const [engagedProfiles, setEngagedProfiles] = useState([]);
  const [engagedStats, setEngagedStats] = useState(null);
  const [loadingEngaged, setLoadingEngaged] = useState(false);
  const [selectedEngagedProfiles, setSelectedEngagedProfiles] = useState([]);
  const [engagedFilter, setEngagedFilter] = useState('all'); // all, commenters, reactors

  // Load initial data
  useEffect(() => {
    loadLinkedInAccounts();
    loadCampaigns();
  }, []);

  const loadLinkedInAccounts = async () => {
    try {
      const response = await api.getLinkedInAccounts();
      if (response.success && response.data?.length > 0) {
        setLinkedinAccounts(response.data);
        const activeAccount = response.data.find(a => a.status === 'active');
        if (activeAccount) {
          setSelectedAccountId(activeAccount.id);
        }
      }
    } catch (error) {
      console.error('Error loading LinkedIn accounts:', error);
    }
  };

  const loadCampaigns = async () => {
    try {
      const response = await api.getCampaigns();
      if (response.success) {
        // Garantir que campaigns seja sempre um array
        const campaignsData = Array.isArray(response.data)
          ? response.data
          : (response.data?.campaigns || response.data?.items || []);
        setCampaigns(campaignsData);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
      setCampaigns([]);
    }
  };

  const handleSearch = async (isLoadMore = false) => {
    if (!selectedAccountId) {
      setError('Selecione uma conta LinkedIn');
      return;
    }

    if (!keywords.trim() && !author.trim()) {
      setError('Digite palavras-chave ou autor para buscar');
      return;
    }

    setError(null);

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setHasSearched(true);
      setPosts([]);
      setSelectedPosts([]);
    }

    try {
      const response = await api.searchPosts({
        linkedin_account_id: selectedAccountId,
        keywords: keywords.trim(),
        author: author.trim() || undefined,
        date_filter: dateFilter || undefined,
        content_type: contentType || undefined,
        cursor: isLoadMore ? cursor : null,
        limit: 25
      });

      if (response.success) {
        if (isLoadMore) {
          setPosts(prev => [...prev, ...(response.data || [])]);
        } else {
          setPosts(response.data || []);
        }
        setCursor(response.pagination?.cursor || null);
        setHasMore(response.pagination?.has_more || false);
      } else {
        setError(response.message || 'Erro ao buscar posts');
      }
    } catch (err) {
      console.error('Error searching posts:', err);
      setError(err.message || 'Erro ao buscar posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const togglePostSelection = (post) => {
    setSelectedPosts(prev => {
      const exists = prev.find(p => p.id === post.id);
      if (exists) {
        return prev.filter(p => p.id !== post.id);
      }
      return [...prev, post];
    });
  };

  const selectAll = () => {
    if (selectedPosts.length === posts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts([...posts]);
    }
  };

  const handleAddToCampaign = async () => {
    if (!selectedCampaignId || selectedPosts.length === 0) return;

    setAddingToCampaign(true);
    try {
      // Extract unique authors from selected posts
      const uniqueAuthors = [];
      const seenIds = new Set();

      for (const post of selectedPosts) {
        if (post.author?.id && !seenIds.has(post.author.id)) {
          seenIds.add(post.author.id);
          uniqueAuthors.push(post.author);
        }
      }

      const response = await api.addPostAuthorsToCampaign(
        selectedCampaignId,
        uniqueAuthors,
        selectedAccountId
      );

      if (response.success) {
        alert(`${response.data?.created || 0} leads criados com sucesso!`);
        setShowAddModal(false);
        setSelectedPosts([]);
        setSelectedCampaignId('');
      } else {
        alert(response.message || 'Erro ao adicionar leads');
      }
    } catch (err) {
      console.error('Error adding to campaign:', err);
      alert(err.message || 'Erro ao adicionar leads');
    } finally {
      setAddingToCampaign(false);
    }
  };

  // ========== ENGAGED PROFILES FUNCTIONS ==========

  const loadEngagedProfiles = async (post) => {
    setSelectedPostForEngaged(post);
    setShowEngagedModal(true);
    setLoadingEngaged(true);
    setEngagedProfiles([]);
    setEngagedStats(null);
    setSelectedEngagedProfiles([]);
    setEngagedFilter('all');

    try {
      // Usar social_id (URN) se disponível para API de comentários
      const postId = post.social_id || post.id;
      const response = await api.getPostEngagedProfiles(postId, selectedAccountId);

      if (response.success) {
        setEngagedProfiles(response.data?.profiles || []);
        setEngagedStats(response.data?.stats || null);
      } else {
        console.error('Error loading engaged profiles:', response.message);
      }
    } catch (err) {
      console.error('Error loading engaged profiles:', err);
    } finally {
      setLoadingEngaged(false);
    }
  };

  const toggleEngagedProfileSelection = (profile) => {
    setSelectedEngagedProfiles(prev => {
      const exists = prev.find(p => p.id === profile.id);
      if (exists) {
        return prev.filter(p => p.id !== profile.id);
      }
      return [...prev, profile];
    });
  };

  const selectAllEngagedProfiles = () => {
    const filtered = getFilteredEngagedProfiles();
    if (selectedEngagedProfiles.length === filtered.length) {
      setSelectedEngagedProfiles([]);
    } else {
      setSelectedEngagedProfiles([...filtered]);
    }
  };

  const getFilteredEngagedProfiles = () => {
    if (engagedFilter === 'all') return engagedProfiles;
    if (engagedFilter === 'commenters') {
      return engagedProfiles.filter(p => p.engagement_type === 'comment' || p.engagement_type === 'both');
    }
    if (engagedFilter === 'reactors') {
      return engagedProfiles.filter(p => p.engagement_type === 'reaction' || p.engagement_type === 'both');
    }
    return engagedProfiles;
  };

  const handleAddEngagedToCampaign = async () => {
    if (!selectedCampaignId || selectedEngagedProfiles.length === 0) return;

    setAddingToCampaign(true);
    try {
      const authors = selectedEngagedProfiles.map(profile => ({
        id: profile.id,
        name: profile.name,
        title: profile.title,
        company: profile.company,
        profile_picture: profile.profile_picture,
        profile_url: profile.profile_url
      }));

      const response = await api.addPostAuthorsToCampaign(
        selectedCampaignId,
        authors,
        selectedAccountId
      );

      if (response.success) {
        alert(`${response.data?.created || 0} leads criados com sucesso!`);
        setShowEngagedModal(false);
        setSelectedEngagedProfiles([]);
        setSelectedCampaignId('');
      } else {
        alert(response.message || 'Erro ao adicionar leads');
      }
    } catch (err) {
      console.error('Error adding engaged profiles to campaign:', err);
      alert(err.message || 'Erro ao adicionar leads');
    } finally {
      setAddingToCampaign(false);
    }
  };

  const getReactionIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'LIKE': return <ThumbsUp className="w-3 h-3 text-blue-500" />;
      case 'LOVE': return <Heart className="w-3 h-3 text-red-500" />;
      case 'CELEBRATE': return <PartyPopper className="w-3 h-3 text-green-500" />;
      case 'SUPPORT': return <Heart className="w-3 h-3 text-purple-500" />;
      case 'INSIGHTFUL': return <Lightbulb className="w-3 h-3 text-yellow-500" />;
      case 'FUNNY': return <Smile className="w-3 h-3 text-orange-500" />;
      default: return <ThumbsUp className="w-3 h-3 text-blue-500" />;
    }
  };

  const formatDate = (post) => {
    // Usar data relativa que já vem da API ("1d", "2h", etc.)
    if (post.date_relative) return post.date_relative;

    // Fallback para created_at se disponível
    if (post.created_at) {
      const date = new Date(post.created_at);
      if (!isNaN(date.getTime())) {
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return 'Agora';
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString('pt-BR');
      }
    }

    return '';
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('posts.title', 'Busca por Posts')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('posts.subtitle', 'Encontre posts relevantes e adicione autores em campanhas')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* LinkedIn Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Linkedin className="w-4 h-4 inline mr-1" />
                {t('posts.account', 'Conta LinkedIn')}
              </label>
              <select
                value={selectedAccountId || ''}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">{t('posts.selectAccount', 'Selecionar conta')}</option>
                {linkedinAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.profile_name || account.linkedin_username}
                  </option>
                ))}
              </select>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Search className="w-4 h-4 inline mr-1" />
                {t('posts.keywords', 'Palavras-chave')}
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder={t('posts.keywordsPlaceholder', 'Ex: vendas B2B, marketing')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            {/* Author */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Users className="w-4 h-4 inline mr-1" />
                {t('posts.author', 'Autor')}
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={t('posts.authorPlaceholder', 'Nome do autor')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Calendar className="w-4 h-4 inline mr-1" />
                {t('posts.date', 'Periodo')}
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">{t('posts.anyTime', 'Qualquer momento')}</option>
                <option value="past_24h">{t('posts.past24h', 'Ultimas 24 horas')}</option>
                <option value="past_week">{t('posts.pastWeek', 'Ultima semana')}</option>
                <option value="past_month">{t('posts.pastMonth', 'Ultimo mes')}</option>
              </select>
            </div>
          </div>

          {/* Content type filter */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('posts.contentType', 'Tipo de conteudo')}:
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setContentType('')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  contentType === ''
                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t('posts.all', 'Todos')}
              </button>
              <button
                onClick={() => setContentType('images')}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  contentType === 'images'
                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                {t('posts.withImages', 'Com imagens')}
              </button>
              <button
                onClick={() => setContentType('videos')}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  contentType === 'videos'
                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Video className="w-4 h-4" />
                {t('posts.withVideos', 'Com videos')}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Search button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleSearch(false)}
              disabled={loading || (!keywords.trim() && !author.trim())}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              {t('posts.search', 'Buscar Posts')}
            </button>

            {/* Selection actions */}
            {selectedPosts.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedPosts.length} {t('posts.selected', 'selecionados')}
                </span>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  {t('posts.addToCampaign', 'Adicionar a Campanha')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('posts.results', 'Resultados')}
                {posts.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({posts.length} {t('posts.posts', 'posts')})
                  </span>
                )}
              </h2>
              {posts.length > 0 && (
                <button
                  onClick={selectAll}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {selectedPosts.length === posts.length
                    ? t('posts.deselectAll', 'Desmarcar todos')
                    : t('posts.selectAll', 'Selecionar todos')}
                </button>
              )}
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 text-purple-600 animate-spin" />
              </div>
            )}

            {/* Empty state */}
            {!loading && posts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <FileText className="w-12 h-12 text-gray-400 mb-3" />
                <p className="text-gray-600 dark:text-gray-400 text-center">
                  {t('posts.noPosts', 'Nenhum post encontrado')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  {t('posts.tryAnotherSearch', 'Tente outra busca')}
                </p>
              </div>
            )}

            {/* Posts grid */}
            {!loading && posts.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {posts.map((post) => {
                  const isSelected = selectedPosts.find(p => p.id === post.id);
                  return (
                    <div
                      key={post.id}
                      onClick={() => togglePostSelection(post)}
                      className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {/* Author */}
                      <div className="flex items-start gap-3 mb-3">
                        {post.author?.profile_picture ? (
                          <img
                            src={post.author.profile_picture}
                            alt={post.author.name}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {post.author?.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {post.author?.name || 'Unknown'}
                            </h4>
                            {isSelected && (
                              <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />
                            )}
                          </div>
                          {post.author?.title && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {post.author.title}
                            </p>
                          )}
                          {post.author?.company && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                              {post.author.company}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                          {formatDate(post)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="mb-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4 whitespace-pre-line">
                          {post.content || t('posts.noContent', 'Sem conteudo de texto')}
                        </p>
                      </div>

                      {/* Media indicators */}
                      {(post.has_image || post.has_video) && (
                        <div className="flex items-center gap-2 mb-3">
                          {post.has_image && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded">
                              <ImageIcon className="w-3 h-3" />
                              Imagem
                            </span>
                          )}
                          {post.has_video && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded">
                              <Video className="w-3 h-3" />
                              Video
                            </span>
                          )}
                        </div>
                      )}

                      {/* Engagement */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1 text-sm">
                            <ThumbsUp className="w-4 h-4" />
                            {formatNumber(post.likes)}
                          </span>
                          <span className="flex items-center gap-1 text-sm">
                            <MessageCircle className="w-4 h-4" />
                            {formatNumber(post.comments)}
                          </span>
                          <span className="flex items-center gap-1 text-sm">
                            <Share2 className="w-4 h-4" />
                            {formatNumber(post.shares)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Ver Engajados Button */}
                          {(post.likes > 0 || post.comments > 0) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                loadEngagedProfiles(post);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                            >
                              <Users className="w-3 h-3" />
                              Ver Engajados
                            </button>
                          )}
                          {post.url && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <ExternalLink className="w-4 h-4" />
                              {t('posts.viewPost', 'Ver')}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Load more */}
            {hasMore && !loading && posts.length > 0 && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => handleSearch(true)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  {t('posts.loadMore', 'Carregar mais')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add to Campaign Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                  <FolderPlus className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">
                    {t('posts.addToCampaignTitle', 'Adicionar a Campanha')}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedPosts.length} {t('posts.authorsToAdd', 'autores serao adicionados')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('posts.selectCampaign', 'Selecionar Campanha')}
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
              >
                <option value="">{t('posts.chooseCampaign', 'Escolha uma campanha')}</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>

              {/* Selected authors preview */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {t('posts.authorsPreview', 'Autores a serem adicionados')}:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {[...new Map(selectedPosts.filter(p => p.author?.id).map(p => [p.author.id, p.author])).values()].map((author, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      {author.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common:cancel', 'Cancelar')}
              </button>
              <button
                onClick={handleAddToCampaign}
                disabled={!selectedCampaignId || addingToCampaign}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addingToCampaign && <Loader className="w-4 h-4 animate-spin" />}
                {t('posts.addLeads', 'Adicionar Leads')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Engaged Profiles Modal */}
      {showEngagedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-xl flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">
                    Perfis Engajados
                  </h3>
                  <p className="text-sm text-purple-200">
                    {selectedPostForEngaged?.author?.name && `Post de ${selectedPostForEngaged.author.name}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEngagedModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Stats */}
            {engagedStats && (
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-6 text-sm text-gray-700 dark:text-gray-300">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    <strong className="text-gray-900 dark:text-gray-100">{engagedStats.total_profiles}</strong> perfis
                  </span>
                  <span className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    <strong className="text-gray-900 dark:text-gray-100">{engagedStats.total_comments}</strong> comentários
                  </span>
                  <span className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-green-500" />
                    <strong className="text-gray-900 dark:text-gray-100">{engagedStats.total_reactions}</strong> reações
                  </span>
                </div>
              </div>
            )}

            {/* Filter tabs */}
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEngagedFilter('all')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    engagedFilter === 'all'
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Todos ({engagedProfiles.length})
                </button>
                <button
                  onClick={() => setEngagedFilter('commenters')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    engagedFilter === 'commenters'
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <MessageCircle className="w-3 h-3" />
                  Comentaram ({engagedStats?.commenters || 0})
                </button>
                <button
                  onClick={() => setEngagedFilter('reactors')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    engagedFilter === 'reactors'
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <ThumbsUp className="w-3 h-3" />
                  Reagiram ({engagedStats?.reactors || 0})
                </button>
              </div>
              {engagedProfiles.length > 0 && (
                <button
                  onClick={selectAllEngagedProfiles}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {selectedEngagedProfiles.length === getFilteredEngagedProfiles().length
                    ? 'Desmarcar todos'
                    : 'Selecionar todos'}
                </button>
              )}
            </div>

            {/* Profiles list */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingEngaged ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-8 h-8 text-purple-600 animate-spin" />
                </div>
              ) : getFilteredEngagedProfiles().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mb-3 opacity-50" />
                  <p>Nenhum perfil encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getFilteredEngagedProfiles().map((profile) => {
                    const isSelected = selectedEngagedProfiles.find(p => p.id === profile.id);
                    return (
                      <div
                        key={profile.id}
                        onClick={() => toggleEngagedProfileSelection(profile)}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-500'
                            : 'bg-gray-100 dark:bg-gray-800 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {/* Avatar */}
                        {profile.profile_picture ? (
                          <img
                            src={profile.profile_picture}
                            alt={profile.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {profile.name?.charAt(0) || '?'}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {profile.name}
                            </h4>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                            )}
                          </div>
                          {profile.title && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {profile.title}
                            </p>
                          )}
                          {profile.company && (
                            <p className="text-xs text-gray-500 truncate">
                              {profile.company}
                            </p>
                          )}
                        </div>

                        {/* Engagement type badge */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {(profile.engagement_type === 'comment' || profile.engagement_type === 'both') && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                              <MessageCircle className="w-3 h-3" />
                            </span>
                          )}
                          {(profile.engagement_type === 'reaction' || profile.engagement_type === 'both') && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                              {getReactionIcon(profile.reaction_type)}
                            </span>
                          )}
                        </div>

                        {/* LinkedIn profile link */}
                        {profile.profile_url && (
                          <a
                            href={profile.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex-shrink-0"
                          >
                            <Linkedin className="w-3.5 h-3.5" />
                            Ver Perfil
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer - Add to Campaign */}
            {selectedEngagedProfiles.length > 0 && (
              <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedEngagedProfiles.length} selecionados
                  </span>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Selecionar campanha...</option>
                    {campaigns.map(campaign => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddEngagedToCampaign}
                    disabled={!selectedCampaignId || addingToCampaign}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addingToCampaign ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Adicionar à Campanha
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPostsPage;
