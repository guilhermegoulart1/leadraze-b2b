import React, { useState, useEffect } from 'react';
import { Plus, List, Upload, Download, Edit2, Trash2, Users, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';
import api from '../services/api';
import ContactListModal from '../components/ContactListModal';
import ImportCSVModal from '../components/ImportCSVModal';
import ContactListItemsModal from '../components/ContactListItemsModal';

const ContactListsPage = () => {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [selectedList, setSelectedList] = useState(null);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      setLoading(true);
      const response = await api.getContactLists();
      if (response.success) {
        setLists(response.data.lists || []);
      }
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async (formData) => {
    try {
      const response = await api.createContactList(formData);
      if (response.success) {
        await loadLists();
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Erro ao criar lista:', error);
      throw error;
    }
  };

  const handleImportCSV = async ({ listName, fileName, contacts }) => {
    try {
      // First create the list
      const listResponse = await api.createContactList({
        name: listName,
        list_type: 'import'
      });

      if (listResponse.success) {
        const listId = listResponse.data.list.id;

        // Then import contacts to the list
        const importResponse = await api.importContactsToList(listId, {
          contacts,
          fileName
        });

        if (importResponse.success) {
          await loadLists();
          setShowImportModal(false);
        }
      }
    } catch (error) {
      console.error('Erro ao importar CSV:', error);
      throw error;
    }
  };

  const handleViewItems = (list) => {
    setSelectedList(list);
    setShowItemsModal(true);
  };

  const handleDeleteList = async (listId) => {
    if (!confirm('Tem certeza que deseja excluir esta lista?')) {
      return;
    }

    try {
      const response = await api.deleteContactList(listId);
      if (response.success) {
        await loadLists();
      }
    } catch (error) {
      console.error('Erro ao deletar lista:', error);
      alert(error.message || 'Erro ao deletar lista');
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      manual: 'Manual',
      import: 'Importada',
      linkedin: 'LinkedIn',
      google_maps: 'Google Maps',
      crm: 'CRM'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type) => {
    const colors = {
      manual: 'bg-gray-100 text-gray-700',
      import: 'bg-blue-100 text-blue-700',
      linkedin: 'bg-purple-100 text-purple-700',
      google_maps: 'bg-green-100 text-green-700',
      crm: 'bg-orange-100 text-orange-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const totalContacts = lists.reduce((sum, list) => sum + (parseInt(list.item_count) || 0), 0);
  const totalActivated = lists.reduce((sum, list) => sum + (parseInt(list.activated_count) || 0), 0);
  const totalPending = lists.reduce((sum, list) => sum + (parseInt(list.pending_count) || 0), 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Listas de Contatos</h1>
            <p className="text-gray-600 mt-1">
              Gerencie suas listas de contatos para campanhas de ativação
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importar CSV
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Lista
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Listas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{lists.length}</p>
            </div>
            <List className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Contatos</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{totalContacts}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ativados</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{totalActivated}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{totalPending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Lists */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando listas...</p>
          </div>
        </div>
      ) : lists.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <List className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhuma lista criada
          </h3>
          <p className="text-gray-600 mb-6">
            Crie sua primeira lista de contatos ou importe um arquivo CSV para começar
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" />
              Importar CSV
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Criar Lista
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => {
            const itemCount = parseInt(list.item_count) || 0;
            const activatedCount = parseInt(list.activated_count) || 0;
            const pendingCount = parseInt(list.pending_count) || 0;
            const failedCount = parseInt(list.failed_count) || 0;
            const progress = itemCount > 0 ? Math.round((activatedCount / itemCount) * 100) : 0;

            return (
              <div
                key={list.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{list.name}</h3>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getTypeColor(list.list_type)}`}>
                      {getTypeLabel(list.list_type)}
                    </span>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    list.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {list.is_active ? 'Ativa' : 'Inativa'}
                  </div>
                </div>

                {list.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {list.description}
                  </p>
                )}

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total de contatos</span>
                    <span className="font-semibold text-gray-900">{itemCount}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        <span>Ativados</span>
                      </div>
                      <span className="font-medium">{activatedCount}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-yellow-600">
                        <Clock className="w-3 h-3" />
                        <span>Pendentes</span>
                      </div>
                      <span className="font-medium">{pendingCount}</span>
                    </div>

                    {failedCount > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="w-3 h-3" />
                          <span>Falhas</span>
                        </div>
                        <span className="font-medium">{failedCount}</span>
                      </div>
                    )}
                  </div>

                  {itemCount > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Progresso</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {list.campaigns_count !== undefined && list.campaigns_count > 0 && (
                  <div className="text-sm text-gray-600 mb-4 pb-4 border-b border-gray-200">
                    <span className="font-medium">{list.campaigns_count}</span> campanha(s) vinculada(s)
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewItems(list)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>
                  <button
                    onClick={() => handleDeleteList(list.id)}
                    className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ContactListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateList}
      />

      <ImportCSVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportCSV}
      />

      <ContactListItemsModal
        isOpen={showItemsModal}
        onClose={() => {
          setShowItemsModal(false);
          setSelectedList(null);
        }}
        list={selectedList}
      />
    </div>
  );
};

export default ContactListsPage;
