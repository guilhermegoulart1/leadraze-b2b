// frontend/src/pages/NextPage.jsx
// GetRaze Next - Feedback & Roadmap

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import MDEditor from '@uiw/react-md-editor';
import {
  Lightbulb,
  ChevronUp,
  MessageSquare,
  Plus,
  X,
  Send,
  Clock,
  CheckCircle2,
  PlayCircle,
  ListTodo,
  Loader2,
  ExternalLink,
  Edit3,
  Trash2,
  Package,
  Tag,
  FileText
} from 'lucide-react';

const STATUS_CONFIG = {
  suggestion: {
    label: 'Suggestions',
    shortLabel: 'Suggestions',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    activeColor: 'bg-purple-600 text-white',
    icon: Lightbulb,
    description: 'Ideas submitted by users'
  },
  backlog: {
    label: 'Backlog',
    shortLabel: 'Backlog',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    activeColor: 'bg-blue-600 text-white',
    icon: ListTodo,
    description: 'Planned for development'
  },
  in_progress: {
    label: 'In Progress',
    shortLabel: 'In Progress',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    activeColor: 'bg-amber-500 text-white',
    icon: PlayCircle,
    description: 'Currently being developed'
  },
  done: {
    label: 'Released',
    shortLabel: 'Released',
    color: 'bg-green-100 text-green-700 border-green-200',
    activeColor: 'bg-green-600 text-white',
    icon: CheckCircle2,
    description: 'Available for use'
  }
};

const TABS = ['suggestion', 'backlog', 'in_progress', 'done'];

export default function NextPage() {
  const { t, i18n } = useTranslation('next');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Helper to get status label
  const getStatusLabel = (status) => t(`status.${status}.label`);
  const getStatusShortLabel = (status) => t(`status.${status}.shortLabel`);

  // State
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('suggestion');
  const [sortBy, setSortBy] = useState('votes');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  // Form state
  const [formData, setFormData] = useState({ title: '', description: '', status: 'suggestion' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Comments state
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', status: '' });
  const [editLoading, setEditLoading] = useState(false);

  // View mode: 'roadmap' or 'changelog'
  const [viewMode, setViewMode] = useState('roadmap');

  // Releases state (changelog)
  const [releases, setReleases] = useState([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [releaseForm, setReleaseForm] = useState({ version: '', title: '', content: '' });
  const [releaseFormLoading, setReleaseFormLoading] = useState(false);
  const [releaseFormError, setReleaseFormError] = useState('');
  const [isEditingRelease, setIsEditingRelease] = useState(false);
  const [editorMode, setEditorMode] = useState('edit'); // 'edit' or 'preview'

  // Load feedback
  useEffect(() => {
    if (viewMode === 'roadmap') {
      loadFeedback();
    }
  }, [activeTab, sortBy, viewMode]);

  // Load releases when switching to changelog
  useEffect(() => {
    if (viewMode === 'changelog') {
      loadReleases();
    }
  }, [viewMode]);

  const loadReleases = async () => {
    try {
      setReleasesLoading(true);
      const response = await api.getReleases();
      setReleases(response.data || []);
    } catch (err) {
      console.error('Error loading releases:', err);
    } finally {
      setReleasesLoading(false);
    }
  };

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const response = await api.getFeedback({ status: activeTab, sort: sortBy });
      setFeedbackList(response.data || []);
      setError('');
    } catch (err) {
      console.error('Error loading feedback:', err);
      setError(t('list.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  // Handle vote
  const handleVote = async (feedbackId, e) => {
    e?.stopPropagation();
    try {
      const response = await api.toggleFeedbackVote(feedbackId);
      setFeedbackList(prev =>
        prev.map(f => {
          if (f.id === feedbackId) {
            return {
              ...f,
              user_voted: response.data.voted,
              vote_count: response.data.voted ? f.vote_count + 1 : f.vote_count - 1
            };
          }
          return f;
        })
      );
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback(prev => ({
          ...prev,
          user_voted: response.data.voted,
          vote_count: response.data.voted ? prev.vote_count + 1 : prev.vote_count - 1
        }));
      }
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  // Create feedback
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError(t('form.titleRequired'));
      return;
    }

    try {
      setFormLoading(true);
      setFormError('');
      const payload = {
        title: formData.title,
        description: formData.description,
        ...(isAdmin && formData.status !== 'suggestion' && { status: formData.status })
      };
      await api.createFeedback(payload);
      setShowCreateModal(false);
      setFormData({ title: '', description: '', status: 'suggestion' });
      // Switch to the tab of the created item
      if (isAdmin && formData.status !== 'suggestion') {
        setActiveTab(formData.status);
      }
      loadFeedback();
    } catch (err) {
      setFormError(err.message || t('form.errorCreating'));
    } finally {
      setFormLoading(false);
    }
  };

  // Open detail
  const openDetail = async (feedback) => {
    setSelectedFeedback(feedback);
    loadComments(feedback.id);
  };

  // Load comments
  const loadComments = async (feedbackId) => {
    try {
      setCommentsLoading(true);
      const response = await api.getFeedbackComments(feedbackId);
      setComments(response.data || []);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Add comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setCommentLoading(true);
      const response = await api.addFeedbackComment(selectedFeedback.id, newComment);
      setComments(prev => [...prev, response.data]);
      setNewComment('');
      setFeedbackList(prev =>
        prev.map(f =>
          f.id === selectedFeedback.id
            ? { ...f, comment_count: f.comment_count + 1 }
            : f
        )
      );
      setSelectedFeedback(prev => ({
        ...prev,
        comment_count: prev.comment_count + 1
      }));
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setCommentLoading(false);
    }
  };

  // Update status (admin only)
  const handleStatusChange = async (feedbackId, newStatus) => {
    try {
      await api.updateFeedback(feedbackId, { status: newStatus });
      loadFeedback();
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Start editing feedback
  const startEditing = () => {
    setEditData({
      title: selectedFeedback.title,
      description: selectedFeedback.description || '',
      status: selectedFeedback.status
    });
    setIsEditing(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editData.title.trim()) return;

    try {
      setEditLoading(true);
      await api.updateFeedback(selectedFeedback.id, {
        title: editData.title,
        description: editData.description,
        status: editData.status
      });
      setSelectedFeedback(prev => ({
        ...prev,
        title: editData.title,
        description: editData.description,
        status: editData.status
      }));
      setIsEditing(false);
      loadFeedback();
    } catch (err) {
      console.error('Error saving edit:', err);
    } finally {
      setEditLoading(false);
    }
  };

  // Delete feedback
  const handleDeleteFeedback = async () => {
    if (!confirm(t('detail.confirmDelete'))) return;

    try {
      await api.deleteFeedback(selectedFeedback.id);
      setSelectedFeedback(null);
      loadFeedback();
    } catch (err) {
      console.error('Error deleting feedback:', err);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId) => {
    if (!confirm(t('comments.confirmDelete'))) return;

    try {
      await api.deleteFeedbackComment(selectedFeedback.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setSelectedFeedback(prev => ({
        ...prev,
        comment_count: Math.max(0, prev.comment_count - 1)
      }));
      setFeedbackList(prev =>
        prev.map(f =>
          f.id === selectedFeedback.id
            ? { ...f, comment_count: Math.max(0, f.comment_count - 1) }
            : f
        )
      );
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  // Create release
  const handleCreateRelease = async (e) => {
    e.preventDefault();
    if (!releaseForm.version.trim() || !releaseForm.content.trim()) {
      setReleaseFormError(t('release.versionRequired'));
      return;
    }

    try {
      setReleaseFormLoading(true);
      setReleaseFormError('');
      await api.createRelease({
        version: releaseForm.version,
        title: releaseForm.title,
        content: releaseForm.content
      });
      setShowReleaseModal(false);
      setReleaseForm({ version: '', title: '', content: '' });
      loadReleases();
    } catch (err) {
      setReleaseFormError(err.message || t('release.errorCreating'));
    } finally {
      setReleaseFormLoading(false);
    }
  };

  // Start editing release
  const startEditingRelease = (release) => {
    setSelectedRelease(release);
    setReleaseForm({
      version: release.version,
      title: release.title || '',
      content: release.content
    });
    setIsEditingRelease(true);
    setEditorMode('edit');
    setShowReleaseModal(true);
  };

  // Save release edit
  const handleSaveRelease = async (e) => {
    e.preventDefault();
    if (!releaseForm.version.trim() || !releaseForm.content.trim()) {
      setReleaseFormError(t('release.versionRequired'));
      return;
    }

    try {
      setReleaseFormLoading(true);
      setReleaseFormError('');
      await api.updateRelease(selectedRelease.id, {
        version: releaseForm.version,
        title: releaseForm.title,
        content: releaseForm.content
      });
      setShowReleaseModal(false);
      setReleaseForm({ version: '', title: '', content: '' });
      setSelectedRelease(null);
      setIsEditingRelease(false);
      loadReleases();
    } catch (err) {
      setReleaseFormError(err.message || t('release.errorUpdating'));
    } finally {
      setReleaseFormLoading(false);
    }
  };

  // Delete release
  const handleDeleteRelease = async (releaseId) => {
    if (!confirm(t('release.confirmDelete'))) return;

    try {
      await api.deleteRelease(releaseId);
      loadReleases();
    } catch (err) {
      console.error('Error deleting release:', err);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('date.today');
    if (diffDays === 1) return t('date.yesterday');
    if (diffDays < 7) return t('date.daysAgo', { count: diffDays });
    if (diffDays < 30) return t('date.weeksAgo', { count: Math.floor(diffDays / 7) });
    return date.toLocaleDateString(i18n.language);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900">{t('header.title')}</span>
            </div>

            {/* Actions */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('actions.newSuggestion')}</span>
              <span className="sm:hidden">{t('actions.suggest')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            {viewMode === 'roadmap' ? t('hero.roadmapTitle') : t('hero.changelogTitle')}
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto mb-6">
            {viewMode === 'roadmap'
              ? t('hero.roadmapDescription')
              : t('hero.changelogDescription')}
          </p>
          {/* View Toggle */}
          <div className="inline-flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('roadmap')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'roadmap'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              {t('viewMode.roadmap')}
            </button>
            <button
              onClick={() => setViewMode('changelog')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'changelog'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t('viewMode.changelog')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {/* Roadmap View */}
        {viewMode === 'roadmap' && (
          <>
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {TABS.map(tab => {
                const config = STATUS_CONFIG[tab];
                const Icon = config.icon;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                      ${isActive
                        ? config.activeColor + ' shadow-md'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{getStatusShortLabel(tab)}</span>
                  </button>
                );
              })}
            </div>

            {/* Sort & Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                {loading ? t('list.loading') : `${feedbackList.length} ${feedbackList.length === 1 ? t('list.item') : t('list.items')}`}
              </p>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="votes">{t('sort.votes')}</option>
                <option value="newest">{t('sort.newest')}</option>
                <option value="oldest">{t('sort.oldest')}</option>
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 border border-red-100">
                {error}
              </div>
            )}

            {/* Content List */}
            <div>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : feedbackList.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lightbulb className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    {t('empty.noSuggestions')}
                  </h3>
                  <p className="text-slate-500 mb-4">
                    {activeTab === 'suggestion'
                      ? t('empty.beFirst')
                      : t('empty.noItemsInTab', { tab: getStatusLabel(activeTab) })}
                  </p>
                  {activeTab === 'suggestion' && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      {t('empty.createSuggestion')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbackList.map(feedback => (
                    <div
                      key={feedback.id}
                      onClick={() => openDetail(feedback)}
                      className={`
                        bg-white rounded-xl border transition-all cursor-pointer
                        ${selectedFeedback?.id === feedback.id
                          ? 'border-purple-300 ring-2 ring-purple-100'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        }
                      `}
                    >
                      <div className="p-4 flex gap-4">
                        {/* Vote Button - Upvote Style */}
                        <button
                          onClick={(e) => handleVote(feedback.id, e)}
                          className={`
                            flex flex-col items-center justify-center min-w-[60px] py-3 px-3 rounded-xl border-2 transition-all shrink-0
                            ${feedback.user_voted
                              ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-purple-400 hover:bg-purple-50'
                            }
                          `}
                          title={feedback.user_voted ? t('vote.removeVote') : t('vote.voteForIdea')}
                        >
                          <ChevronUp className={`w-5 h-5 ${feedback.user_voted ? 'text-white' : 'text-slate-400'}`} />
                          <span className="font-bold text-lg leading-none">{feedback.vote_count}</span>
                          <span className="text-[10px] uppercase tracking-wide mt-0.5 opacity-80">
                            {feedback.user_voted ? t('vote.voted') : t('vote.vote')}
                          </span>
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">
                            {feedback.title}
                          </h3>
                          {feedback.description && (
                            <p className="text-slate-500 text-sm line-clamp-2 mb-2">
                              {feedback.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(feedback.created_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5" />
                              {feedback.comment_count || 0}
                            </span>
                            {isAdmin && (
                              <select
                                onClick={(e) => e.stopPropagation()}
                                value={feedback.status}
                                onChange={(e) => handleStatusChange(feedback.id, e.target.value)}
                                className={`ml-auto text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${STATUS_CONFIG[feedback.status].color}`}
                              >
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                  <option key={key} value={key}>{getStatusLabel(key)}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Changelog View */}
        {viewMode === 'changelog' && (
          <>
            {/* Admin: New Release Button */}
            {isAdmin && (
              <div className="flex justify-end mb-6">
                <button
                  onClick={() => {
                    setIsEditingRelease(false);
                    setSelectedRelease(null);
                    setReleaseForm({ version: '', title: '', content: '' });
                    setEditorMode('edit');
                    setShowReleaseModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  {t('actions.newRelease')}
                </button>
              </div>
            )}

            {/* Releases Timeline */}
            {releasesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : releases.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  {t('empty.noReleases')}
                </h3>
                <p className="text-slate-500">
                  {t('empty.releasesWillAppear')}
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />

                {/* Releases */}
                <div className="space-y-6">
                  {releases.map((release, index) => (
                    <div key={release.id} className="relative pl-16">
                      {/* Timeline dot */}
                      <div className="absolute left-4 top-6 w-5 h-5 bg-purple-600 rounded-full border-4 border-white shadow-sm" />

                      {/* Release Card */}
                      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-full text-sm font-semibold shadow-sm">
                                <Tag className="w-3.5 h-3.5" />
                                {release.version}
                              </span>
                              <span className="text-sm text-slate-400">
                                {new Date(release.published_at).toLocaleDateString(i18n.language, {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startEditingRelease(release)}
                                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 className="w-4 h-4 text-slate-500" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRelease(release.id)}
                                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            )}
                          </div>
                          {release.title && (
                            <h3 className="font-bold text-slate-900 text-xl mt-3">
                              {release.title}
                            </h3>
                          )}
                        </div>

                        {/* Content - Markdown Rendered */}
                        <div className="p-5" data-color-mode="light">
                          <MDEditor.Markdown
                            source={release.content}
                            className="!bg-transparent !text-slate-700"
                            style={{ backgroundColor: 'transparent' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal - Forum Style */}
      {selectedFeedback && (
        <div
          className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedFeedback(null);
              setIsEditing(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl my-8">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100 p-5 z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {isEditing ? (
                    <>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setEditData({ ...editData, status: key })}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                              editData.status === key
                                ? config.activeColor
                                : config.color + ' hover:opacity-80'
                            }`}
                          >
                            {getStatusLabel(key)}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={editData.title}
                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                        className="text-xl font-bold text-slate-900 w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CONFIG[selectedFeedback.status].color}`}>
                          {getStatusLabel(selectedFeedback.status)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(selectedFeedback.created_at)}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {selectedFeedback.title}
                      </h2>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && !isEditing && (
                    <>
                      <button
                        onClick={startEditing}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-5 h-5 text-slate-500" />
                      </button>
                      <button
                        onClick={handleDeleteFeedback}
                        className="p-2 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5 text-red-500" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setSelectedFeedback(null);
                      setIsEditing(false);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Vote Button or Edit Actions */}
              <div className="mt-4 flex items-center gap-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      disabled={editLoading}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
                    >
                      {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t('detail.saveChanges')}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                    >
                      {t('detail.cancel')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => handleVote(selectedFeedback.id, e)}
                    className={`
                      flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 transition-all font-semibold
                      ${selectedFeedback.user_voted
                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-purple-400 hover:bg-purple-50'
                      }
                    `}
                  >
                    <ChevronUp className={`w-5 h-5 ${selectedFeedback.user_voted ? '' : 'text-slate-400'}`} />
                    <span className="text-lg">{selectedFeedback.vote_count}</span>
                    <span className="text-sm opacity-80">
                      {selectedFeedback.user_voted ? t('detail.votedLabel') : t('detail.voteForThisIdea')}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                {t('detail.description')}
              </h3>
              {isEditing ? (
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder={t('detail.addDescription')}
                />
              ) : selectedFeedback.description ? (
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selectedFeedback.description}
                </p>
              ) : (
                <p className="text-slate-400 italic">{t('detail.noDescription')}</p>
              )}
            </div>

            {/* Comments Section */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {t('comments.title')} ({comments.length})
              </h3>

              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">{t('comments.noComments')}</p>
                  <p className="text-slate-400 text-sm">{t('comments.beFirst')}</p>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {comments.map(comment => (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-xl ${
                        comment.is_admin_reply
                          ? 'bg-purple-50 border border-purple-100'
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-semibold text-sm ${
                          comment.is_admin_reply ? 'text-purple-700' : 'text-slate-700'
                        }`}>
                          {comment.author}
                          {comment.is_admin_reply && (
                            <span className="ml-2 text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                              {t('comments.team')}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {formatDate(comment.created_at)}
                          </span>
                          {(isAdmin || comment.is_own) && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 hover:bg-red-100 rounded transition-colors"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-600 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="mt-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={t('comments.placeholder')}
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    disabled={commentLoading || !newComment.trim()}
                    className="px-5 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
                  >
                    {commentLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('comments.send')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                {isAdmin ? t('form.newItem') : t('form.newSuggestion')}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ title: '', description: '', status: 'suggestion' });
                  setFormError('');
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-100">
                  {formError}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('form.titleLabel')}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('form.titlePlaceholder')}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  maxLength={255}
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('form.descriptionLabel')} <span className="text-slate-400 font-normal">{t('form.descriptionOptional')}</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('form.descriptionPlaceholder')}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              {isAdmin && (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('form.statusLabel')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      const isSelected = formData.status === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFormData({ ...formData, status: key })}
                          className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border
                            ${isSelected
                              ? config.activeColor + ' border-transparent'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }
                          `}
                        >
                          <Icon className="w-4 h-4" />
                          {getStatusShortLabel(key)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ title: '', description: '', status: 'suggestion' });
                    setFormError('');
                  }}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                >
                  {t('form.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-medium shadow-sm"
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isAdmin ? t('form.createItem') : t('form.submitSuggestion')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Modal */}
      {showReleaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-slate-900">
                {isEditingRelease ? t('release.editRelease') : t('release.newRelease')}
              </h2>
              <button
                onClick={() => {
                  setShowReleaseModal(false);
                  setReleaseForm({ version: '', title: '', content: '' });
                  setReleaseFormError('');
                  setSelectedRelease(null);
                  setIsEditingRelease(false);
                  setEditorMode('edit');
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={isEditingRelease ? handleSaveRelease : handleCreateRelease} className="p-5">
              {releaseFormError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-100">
                  {releaseFormError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('release.versionLabel')}
                  </label>
                  <input
                    type="text"
                    value={releaseForm.version}
                    onChange={(e) => setReleaseForm({ ...releaseForm, version: e.target.value })}
                    placeholder={t('release.versionPlaceholder')}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('release.titleLabel')} <span className="text-slate-400 font-normal">{t('release.titleOptional')}</span>
                  </label>
                  <input
                    type="text"
                    value={releaseForm.title}
                    onChange={(e) => setReleaseForm({ ...releaseForm, title: e.target.value })}
                    placeholder={t('release.titlePlaceholder')}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('release.notesLabel')}
                </label>

                {/* Badge Shortcuts */}
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-t-xl border border-b-0 border-slate-200">
                  <span className="text-xs text-slate-500 font-medium mr-2 self-center">{t('badges.title')}</span>
                  <button
                    type="button"
                    onClick={() => setReleaseForm({ ...releaseForm, content: (releaseForm.content || '') + (releaseForm.content ? '\n\n' : '') + `## ✨ ${t('sections.newFeatures')}\n\n- ` })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition-colors"
                  >
                    ✨ {t('badges.new')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReleaseForm({ ...releaseForm, content: (releaseForm.content || '') + (releaseForm.content ? '\n\n' : '') + `## 🔧 ${t('sections.improvements')}\n\n- ` })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition-colors"
                  >
                    🔧 {t('badges.improved')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReleaseForm({ ...releaseForm, content: (releaseForm.content || '') + (releaseForm.content ? '\n\n' : '') + `## 🐛 ${t('sections.bugFixes')}\n\n- ` })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-200 transition-colors"
                  >
                    🐛 {t('badges.fixed')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReleaseForm({ ...releaseForm, content: (releaseForm.content || '') + (releaseForm.content ? '\n\n' : '') + `## 🗑 ${t('sections.removed')}\n\n- ` })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors"
                  >
                    🗑 {t('badges.removed')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReleaseForm({ ...releaseForm, content: (releaseForm.content || '') + (releaseForm.content ? '\n\n' : '') + `## 🔒 ${t('sections.security')}\n\n- ` })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 transition-colors"
                  >
                    🔒 {t('badges.security')}
                  </button>
                </div>

                {/* Markdown Editor */}
                <div data-color-mode="light" className="border border-t-0 border-slate-200 rounded-b-xl overflow-hidden">
                  <MDEditor
                    value={releaseForm.content}
                    onChange={(val) => setReleaseForm({ ...releaseForm, content: val || '' })}
                    height={400}
                    preview="live"
                    hideToolbar={false}
                    enableScroll={true}
                  />
                </div>

                {/* Legend */}
                <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                    {t('badges.guideTitle')}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-semibold">✨ {t('badges.new')}</span>
                      <span className="text-slate-600">{t('badges.newDesc')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-semibold">🔧 {t('badges.improved')}</span>
                      <span className="text-slate-600">{t('badges.improvedDesc')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded font-semibold">🐛 {t('badges.fixed')}</span>
                      <span className="text-slate-600">{t('badges.fixedDesc')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">🗑 {t('badges.removed')}</span>
                      <span className="text-slate-600">{t('badges.removedDesc')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-semibold">🔒 {t('badges.security')}</span>
                      <span className="text-slate-600">{t('badges.securityDesc')}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200">
                    {t('badges.tip')}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReleaseModal(false);
                    setReleaseForm({ version: '', title: '', content: '' });
                    setReleaseFormError('');
                    setSelectedRelease(null);
                    setIsEditingRelease(false);
                    setEditorMode('edit');
                  }}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                >
                  {t('release.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={releaseFormLoading}
                  className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-medium shadow-sm"
                >
                  {releaseFormLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditingRelease ? t('release.saveChanges') : t('release.publishRelease')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
