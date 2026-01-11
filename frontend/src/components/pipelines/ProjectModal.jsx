// frontend/src/components/pipelines/ProjectModal.jsx
import { useState, useEffect, useRef } from 'react';
import { X, Folder } from 'lucide-react';
import api from '../../services/api';

const ProjectModal = ({ project, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (project) {
      setName(project.name || '');
    }
  }, [project]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Digite o nome do projeto');
      inputRef.current?.focus();
      return;
    }

    try {
      setSaving(true);

      const formData = { name: name.trim() };

      let response;
      if (project?.id) {
        response = await api.updateCrmProject(project.id, formData);
      } else {
        response = await api.createCrmProject(formData);
      }

      if (response.success) {
        onSave();
      } else {
        setError(response.message || 'Erro ao salvar projeto');
      }
    } catch (err) {
      setError(err.message || 'Erro ao salvar projeto');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && name.trim()) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const isNew = !project?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="relative px-8 pt-8 pb-2">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Folder className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
            {isNew ? 'Criar novo projeto' : 'Renomear projeto'}
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-sm">
            {isNew
              ? 'Projetos ajudam a organizar suas pipelines'
              : 'Altere o nome do seu projeto'
            }
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome do projeto
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Vendas Q1 2025, Marketing, Suporte..."
              className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-500 dark:text-white text-base transition-all placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="flex-1 px-6 py-3.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Criando...
              </span>
            ) : (
              isNew ? 'Criar projeto' : 'Salvar alterações'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectModal;
