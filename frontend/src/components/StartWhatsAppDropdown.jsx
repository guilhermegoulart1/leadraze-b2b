import React, { useState, useEffect, useRef } from 'react';
import { X, MessageCircle, Loader, ChevronDown, User, Building2, Phone } from 'lucide-react';
import api from '../services/api';

const StartWhatsAppModal = ({
  phone,
  contactId,
  opportunityId,
  onClose,
  onConversationStarted
}) => {
  const [whatsappAccounts, setWhatsappAccounts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedSector, setSelectedSector] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const dropdownRef = useRef(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load WhatsApp accounts, sectors, and users in parallel
      const [accountsRes, sectorsRes, usersRes] = await Promise.all([
        api.getWhatsAppAccounts(),
        api.getSectors(),
        api.getConversationAssignableUsers()
      ]);

      if (accountsRes.success) {
        setWhatsappAccounts(accountsRes.data || []);
        // Auto-select first account
        if (accountsRes.data?.length > 0) {
          setSelectedAccount(accountsRes.data[0].id);
        }
      }

      if (sectorsRes.success) {
        setSectors(sectorsRes.data?.sectors || sectorsRes.data || []);
      }

      if (usersRes.success) {
        setUsers(usersRes.data?.users || usersRes.data || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!selectedAccount) {
      setError('Selecione uma conta WhatsApp');
      return;
    }

    try {
      setStarting(true);
      setError(null);

      const result = await api.startWhatsAppConversation({
        phone_number: phone,
        whatsapp_account_id: selectedAccount,
        sector_id: selectedSector || undefined,
        user_id: selectedUser || undefined,
        contact_id: contactId || undefined,
        opportunity_id: opportunityId || undefined
      });

      if (result.success) {
        onConversationStarted(result.data.conversation_id, result.data.existing);
      } else {
        setError(result.message || 'Erro ao iniciar conversa');
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError(err.message || 'Erro ao iniciar conversa');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={dropdownRef}
        className="relative bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 w-96 max-w-[90vw] overflow-hidden"
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Iniciar Conversa WhatsApp
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Phone display */}
        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <Phone className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{phone}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader className="w-6 h-6 text-green-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* WhatsApp Account Select */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Conta WhatsApp *
              </label>
              {whatsappAccounts.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  Nenhuma conta WhatsApp conectada
                </p>
              ) : (
                <select
                  value={selectedAccount || ''}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {whatsappAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.display_name || acc.email || 'WhatsApp'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Sector Select */}
            {sectors.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  <Building2 className="w-3.5 h-3.5 inline mr-1" />
                  Setor (opcional)
                </label>
                <select
                  value={selectedSector || ''}
                  onChange={(e) => setSelectedSector(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Nenhum setor</option>
                  {sectors.map(sector => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* User Select */}
            {users.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  <User className="w-3.5 h-3.5 inline mr-1" />
                  Atribuir a (opcional)
                </label>
                <select
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Eu mesmo</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          Cancelar
        </button>
        <button
          onClick={handleStart}
          disabled={starting || loading || whatsappAccounts.length === 0}
          className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {starting ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Iniciando...
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4" />
              Iniciar Conversa
            </>
          )}
        </button>
      </div>
      </div>
    </div>
  );
};

export default StartWhatsAppModal;
