import React, { useState } from 'react';
import { User, Lock, Bell, CreditCard, Database, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SettingsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'security', label: 'Segurança', icon: Lock },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'billing', label: 'Cobrança', icon: CreditCard },
    { id: 'integrations', label: 'Integrações', icon: Database },
    { id: 'privacy', label: 'Privacidade', icon: Shield },
  ];

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
        <p className="text-gray-500 mt-1">Gerencie suas preferências e configurações</p>
      </div>

      <div className="flex gap-6">
        
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${activeTab === tab.id 
                      ? 'bg-purple-50 text-purple-600' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Informações do Perfil</h3>
              
              <div className="space-y-6">
                
                {/* Avatar */}
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {user?.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold text-sm">
                      Alterar Foto
                    </button>
                    <p className="text-xs text-gray-500 mt-2">JPG, PNG ou GIF • Máx 2MB</p>
                  </div>
                </div>

                {/* Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      defaultValue={user?.name}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      placeholder="+55 (11) 99999-9999"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cargo
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Gerente de Vendas"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Empresa
                  </label>
                  <input
                    type="text"
                    placeholder="Nome da sua empresa"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">
                    Cancelar
                  </button>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold">
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Segurança</h3>
              
              <div className="space-y-6">
                
                {/* Change Password */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Alterar Senha</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Senha Atual
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nova Senha
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* 2FA */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">Autenticação de Dois Fatores</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        Adicione uma camada extra de segurança à sua conta
                      </p>
                    </div>
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold">
                      Ativar 2FA
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold">
                    Atualizar Senha
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Notificações</h3>
              
              <div className="space-y-4">
                {[
                  { title: 'Novos leads', description: 'Receber notificação quando novos leads forem adicionados' },
                  { title: 'Convites aceitos', description: 'Ser notificado quando um convite for aceito' },
                  { title: 'Leads qualificados', description: 'Alertas quando um lead for qualificado' },
                  { title: 'Mensagens recebidas', description: 'Notificações de novas mensagens nas conversas' },
                  { title: 'Campanhas concluídas', description: 'Avisos quando uma campanha atingir 100%' },
                  { title: 'Relatórios semanais', description: 'Resumo semanal por email' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other tabs placeholder */}
          {['billing', 'integrations', 'privacy'].includes(activeTab) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <p className="text-gray-500">Conteúdo em desenvolvimento...</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default SettingsPage;