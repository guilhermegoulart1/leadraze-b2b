import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Plus, Trash2, Building2 } from 'lucide-react';
import api from '../services/api';

const LinkedInAccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.getLinkedInAccounts();

      if (response.success) {
        setAccounts(response.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando contas LinkedIn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contas LinkedIn</h2>
          <p className="text-gray-500 mt-1">Gerencie suas contas conectadas</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg hover:opacity-90 font-semibold">
          <Plus className="w-5 h-5" />
          <span>Conectar Nova Conta</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Total de Contas</p>
          <p className="text-3xl font-bold text-gray-900">{accounts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Contas Ativas</p>
          <p className="text-3xl font-bold text-green-600">
            {accounts.filter(a => a.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Limite Diário Total</p>
          <p className="text-3xl font-bold text-purple-600">
            {accounts.reduce((sum, a) => sum + (a.daily_limit || 0), 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Enviados Hoje</p>
          <p className="text-3xl font-bold text-blue-600">
            {accounts.reduce((sum, a) => sum + (a.today_sent || 0), 0)}
          </p>
        </div>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {accounts.map((account) => {
          const usagePercent = account.daily_limit > 0 
            ? ((account.today_sent / account.daily_limit) * 100).toFixed(0)
            : 0;

          const organizations = typeof account.organizations === 'string' 
            ? JSON.parse(account.organizations) 
            : account.organizations || [];

          return (
            <div key={account.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {account.profile_picture ? (
                    <img 
                      src={account.profile_picture} 
                      alt={account.profile_name}
                      className="w-16 h-16 rounded-full"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {account.profile_name?.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-900">{account.profile_name}</h3>
                    <p className="text-sm text-gray-500">@{account.public_identifier || account.linkedin_username}</p>
                  </div>
                </div>
                {account.status === 'active' ? (
                  <span className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    <CheckCircle className="w-4 h-4" />
                    <span>Ativa</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                    <AlertCircle className="w-4 h-4" />
                    <span>Inativa</span>
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Limite Diário</p>
                  <p className="text-lg font-bold text-gray-900">{account.daily_limit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Enviados Hoje</p>
                  <p className="text-lg font-bold text-purple-600">{account.today_sent}</p>
                </div>
              </div>

              {/* Usage Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-500">Uso diário</span>
                  <span className="font-semibold text-gray-900">{usagePercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      usagePercent >= 90 ? 'bg-red-600' :
                      usagePercent >= 70 ? 'bg-yellow-600' :
                      'bg-green-600'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>

              {/* Organizations */}
              {organizations.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Organizações Conectadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {organizations.slice(0, 3).map((org, idx) => (
                      <span key={idx} className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                        <Building2 className="w-3 h-3" />
                        <span>{org.name}</span>
                      </span>
                    ))}
                    {organizations.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                        +{organizations.length - 3} mais
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="text-xs text-gray-500 space-y-1 mb-4">
                <p>Conectada: {new Date(account.connected_at).toLocaleDateString('pt-BR')}</p>
                <p>ID Unipile: {account.unipile_account_id}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button className="text-sm text-purple-600 hover:text-purple-700 font-semibold">
                  Ver Detalhes
                </button>
                <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Nenhuma conta LinkedIn conectada</p>
          <button className="text-purple-600 hover:text-purple-700 font-semibold">
            Conectar primeira conta
          </button>
        </div>
      )}

    </div>
  );
};

export default LinkedInAccountsPage;