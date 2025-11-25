import React, { useState, useEffect } from 'react';
import { Plus, List, Upload, Trash2, Users, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import ContactListModal from '../components/ContactListModal';
import ImportCSVModal from '../components/ImportCSVModal';
import ContactListItemsModal from '../components/ContactListItemsModal';

const ContactListsPage = () => {
  const { t } = useTranslation(['contacts', 'common']);
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
      console.error(t('messages.loadError'), error);
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
      console.error(t('messages.createError'), error);
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
      console.error(t('import.errors'), error);
      throw error;
    }
  };

  const handleViewItems = (list) => {
    setSelectedList(list);
    setShowItemsModal(true);
  };

  const handleDeleteList = async (listId) => {
    if (!confirm(t('lists.confirmDelete'))) {
      return;
    }

    try {
      const response = await api.deleteContactList(listId);
      if (response.success) {
        await loadLists();
      }
    } catch (error) {
      console.error(t('messages.deleteError'), error);
      alert(error.message || t('messages.deleteError'));
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('lists.title')}</h1>
            <p className="text-gray-600 mt-1">
              {t('lists.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {t('importContacts')}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('lists.newList')}
            </button>
          </div>
        </div>
      </div>

      {/* Lists Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('lists.loadingLists')}</p>
          </div>
        </div>
      ) : lists.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <List className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('lists.noListsCreated')}
          </h3>
          <p className="text-gray-600 mb-6">
            {t('lists.createFirstList')}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" />
              {t('importContacts')}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              {t('lists.createList')}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('lists.listName')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('lists.numberOfContacts')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('lists.creationDate')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('lists.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lists.map((list) => {
                const itemCount = parseInt(list.item_count) || 0;

                return (
                  <tr key={list.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="font-medium text-gray-900">{list.name}</div>
                        {list.description && (
                          <div className="text-sm text-gray-500 line-clamp-1">{list.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{itemCount}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {new Date(list.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewItems(list)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title={t('lists.viewContacts')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteList(list.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('lists.deleteList')}
                        >
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
