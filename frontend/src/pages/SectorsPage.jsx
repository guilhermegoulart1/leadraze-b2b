import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Users as UsersIcon, Shield, AlertCircle, Loader, X
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const SectorsPage = () => {
  const { user } = useAuth();
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [selectedSector, setSelectedSector] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366f1'
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadSectors();
  }, []);

  const loadSectors = async () => {
    try {
      setLoading(true);
      const response = await api.getSectors();
      setSectors(response.data || []);
      setError('');
    } catch (err) {
      console.error('Error loading sectors:', err);
      setError('Erro ao carregar setores');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (sector = null) => {
    if (sector) {
      setSelectedSector(sector);
      setFormData({
        name: sector.name,
        description: sector.description || '',
        color: sector.color || '#6366f1'
      });
    } else {
      setSelectedSector(null);
      setFormData({
        name: '',
        description: '',
        color: '#6366f1'
      });
    }
    setFormErrors({});
    setShowSectorModal(true);
  };

  const handleCloseModal = () => {
    setShowSectorModal(false);
    setSelectedSector(null);
    setFormData({
      name: '',
      description: '',
      color: '#6366f1'
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveSector = async () => {
    if (!validateForm()) return;

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        color: formData.color
      };

      if (selectedSector) {
        await api.updateSector(selectedSector.id, payload);
      } else {
        await api.createSector(payload);
      }

      await loadSectors();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving sector:', error);
      setFormErrors({
        general: error.response?.data?.message || 'Erro ao salvar setor'
      });
    }
  };

  const handleDeleteSector = async (sectorId, sectorName) => {
    if (sectorName === 'Geral') {
      alert('Não é possível deletar o setor Geral');
      return;
    }

    if (!confirm('Tem certeza que deseja deletar este setor?')) {
      return;
    }

    try {
      await api.deleteSector(sectorId);
      await loadSectors();
    } catch (error) {
      console.error('Error deleting sector:', error);
      setError(error.response?.data?.message || 'Erro ao deletar setor');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Setores</h1>
            <p className="text-sm text-gray-500 mt-1">
              Organize sua equipe em setores para melhor gestão de acessos
            </p>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Novo Setor</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Sectors Table */}
      <div className="flex-1 overflow-auto">
        {sectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <UsersIcon className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">Nenhum setor encontrado</p>
            <p className="text-sm">Crie um novo setor para começar</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Descrição
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  Cor
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  Usuários
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  Supervisores
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sectors.map((sector) => (
                <tr key={sector.id} className="hover:bg-gray-50 transition-colors">
                  {/* Nome */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sector.color || '#6366f1' }}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {sector.name}
                      </span>
                    </div>
                  </td>

                  {/* Descrição */}
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {sector.description || '-'}
                    </span>
                  </td>

                  {/* Cor */}
                  <td className="px-6 py-4 text-center">
                    <span
                      className="inline-block px-2 py-1 text-xs font-medium text-white rounded"
                      style={{ backgroundColor: sector.color || '#6366f1' }}
                    >
                      {sector.color || '#6366f1'}
                    </span>
                  </td>

                  {/* Usuários */}
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                      <UsersIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">
                        {sector.user_count || 0}
                      </span>
                    </div>
                  </td>

                  {/* Supervisores */}
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                      <Shield className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">
                        {sector.supervisor_count || 0}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${
                        sector.is_active !== false
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {sector.is_active !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>

                  {/* Ações */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenModal(sector)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {sector.name !== 'Geral' && (
                        <button
                          onClick={() => handleDeleteSector(sector.id, sector.name)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sector Form Modal */}
      {showSectorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedSector ? 'Editar Setor' : 'Novo Setor'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{formErrors.general}</p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Vendas, Marketing, Suporte"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Descrição opcional do setor"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cor
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSector}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                {selectedSector ? 'Salvar' : 'Criar Setor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectorsPage;
