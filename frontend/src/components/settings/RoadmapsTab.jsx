// frontend/src/components/settings/RoadmapsTab.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  Map,
  Globe,
  User,
  Loader,
  Clock,
  ListTodo,
  ChevronRight,
  Copy
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import RoadmapModal from '../RoadmapModal';

const RoadmapsTab = () => {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoadmap, setEditingRoadmap] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadRoadmaps();
  }, []);

  const loadRoadmaps = async () => {
    try {
      setLoading(true);
      const response = await api.getRoadmaps();
      if (response.success) {
        setRoadmaps(response.data);
      }
    } catch (error) {
      console.error('Error loading roadmaps:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (roadmap) => {
    try {
      // Load full roadmap with tasks
      const response = await api.getRoadmap(roadmap.id);
      if (response.success) {
        setEditingRoadmap(response.data);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error loading roadmap:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('roadmaps.confirmDelete', 'Tem certeza que deseja excluir este roadmap?'))) return;

    try {
      const response = await api.deleteRoadmap(id);
      if (response.success) {
        await loadRoadmaps();
      }
    } catch (error) {
      console.error('Error deleting roadmap:', error);
    }
  };

  const handleSave = async (data) => {
    try {
      let response;
      if (editingRoadmap) {
        response = await api.updateRoadmap(editingRoadmap.id, data);
      } else {
        response = await api.createRoadmap(data);
      }

      if (response.success) {
        await loadRoadmaps();
        setShowModal(false);
        setEditingRoadmap(null);
      }
    } catch (error) {
      console.error('Error saving roadmap:', error);
      throw error;
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingRoadmap(null);
  };

  const myRoadmaps = roadmaps.filter(r => r.created_by === user?.id);
  const globalRoadmaps = roadmaps.filter(r => r.is_global && r.created_by !== user?.id);

  const formatDuration = (hours) => {
    if (!hours) return '-';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}d`;
    return `${days}d ${remainingHours}h`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('roadmaps.title', 'Roadmaps')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('roadmaps.description', 'Crie sequências de tarefas reutilizáveis para padronizar processos')}
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t('roadmaps.newRoadmap', 'Novo Roadmap')}
            </button>
          </div>

          {/* Empty State */}
          {roadmaps.length === 0 && (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <Map className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('roadmaps.noRoadmaps', 'Nenhum roadmap configurado')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {t('roadmaps.createFirst', 'Crie seu primeiro roadmap para automatizar processos')}
              </p>
            </div>
          )}

          {/* My Roadmaps */}
          {myRoadmaps.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('roadmaps.myRoadmaps', 'Meus Roadmaps')}
              </h3>
              <div className="space-y-3">
                {myRoadmaps.map(roadmap => (
                  <RoadmapCard
                    key={roadmap.id}
                    roadmap={roadmap}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    canEdit={true}
                    formatDuration={formatDuration}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Global Roadmaps */}
          {globalRoadmaps.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('roadmaps.globalRoadmaps', 'Roadmaps da Equipe')}
              </h3>
              <div className="space-y-3">
                {globalRoadmaps.map(roadmap => (
                  <RoadmapCard
                    key={roadmap.id}
                    roadmap={roadmap}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    canEdit={isAdmin}
                    showCreator={true}
                    formatDuration={formatDuration}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <RoadmapModal
          roadmap={editingRoadmap}
          onSave={handleSave}
          onClose={handleClose}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

const RoadmapCard = ({ roadmap, onEdit, onDelete, canEdit, showCreator, formatDuration, t }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">{roadmap.name}</h4>
          {roadmap.is_global && (
            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
              Global
            </span>
          )}
          {roadmap.shortcut && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full font-mono">
              /{roadmap.shortcut}
            </span>
          )}
        </div>
        {roadmap.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {roadmap.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <ListTodo className="w-3.5 h-3.5" />
            {roadmap.task_count || 0} {t('roadmaps.tasks', 'tarefas')}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(roadmap.total_duration_hours)}
          </span>
        </div>
        {showCreator && roadmap.created_by_name && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            {t('roadmaps.createdBy', 'Criado por')}: {roadmap.created_by_name}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => onEdit(roadmap)}
            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
            title={t('roadmaps.edit', 'Editar')}
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(roadmap.id)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title={t('roadmaps.delete', 'Excluir')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  </div>
);

export default RoadmapsTab;
