// frontend/src/components/aiemployees/AgentProfileStep/KnowledgeTab.jsx
// Tab de Base de Conhecimento - RAG (carrega sob demanda)

import React from 'react';
import { Building, Package, Globe, DollarSign, Users, HelpCircle, Shield } from 'lucide-react';
import BenefitsList from './components/BenefitsList';
import FAQList from './components/FAQList';
import ObjectionsList from './components/ObjectionsList';

const KnowledgeTab = ({ profile, onChange, onNestedChange }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Coluna Esquerda */}
      <div className="space-y-6">
        {/* Sobre a Empresa */}
        <section className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Building className="w-4 h-4 text-purple-500" />
            Sobre a Empresa
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Website
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={profile.company?.website || ''}
                  onChange={(e) => onNestedChange('company', 'website', e.target.value)}
                  placeholder="https://suaempresa.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Descricao da Empresa
              </label>
              <textarea
                value={profile.company?.description || ''}
                onChange={(e) => onNestedChange('company', 'description', e.target.value)}
                placeholder="O que sua empresa faz, proposta de valor..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Setor
                </label>
                <input
                  type="text"
                  value={profile.company?.sector || ''}
                  onChange={(e) => onNestedChange('company', 'sector', e.target.value)}
                  placeholder="Ex: SaaS B2B, E-commerce..."
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Ticket Medio
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={profile.company?.avgTicket || ''}
                    onChange={(e) => onNestedChange('company', 'avgTicket', e.target.value)}
                    placeholder="R$ 500-5000"
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <Users className="w-3 h-3 inline mr-1" />
                ICP (Cliente Ideal)
              </label>
              <textarea
                value={profile.company?.icp || ''}
                onChange={(e) => onNestedChange('company', 'icp', e.target.value)}
                placeholder="Startups de tecnologia, 10-50 funcionarios, buscando escalar vendas..."
                rows={2}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white resize-none"
              />
            </div>
          </div>
        </section>

        {/* Produto/Servico */}
        <section className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />
            Produto/Servico
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Nome do Produto
              </label>
              <input
                type="text"
                value={profile.product?.name || ''}
                onChange={(e) => onNestedChange('product', 'name', e.target.value)}
                placeholder="Ex: Plataforma de Automacao de Vendas"
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Descricao
              </label>
              <textarea
                value={profile.product?.description || ''}
                onChange={(e) => onNestedChange('product', 'description', e.target.value)}
                placeholder="O que seu produto faz, como funciona..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Beneficios
              </label>
              <BenefitsList
                items={profile.product?.benefits || []}
                onChange={(items) => onNestedChange('product', 'benefits', items)}
                placeholder="Ex: Economiza 20h/semana"
                color="green"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Diferenciais vs Concorrencia
              </label>
              <BenefitsList
                items={profile.product?.differentials || []}
                onChange={(items) => onNestedChange('product', 'differentials', items)}
                placeholder="Ex: IA conversacional real"
                color="blue"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Coluna Direita */}
      <div className="space-y-6">
        {/* FAQ */}
        <section className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-500" />
            Perguntas Frequentes (FAQ)
          </h3>
          <FAQList
            items={profile.faq || []}
            onChange={(items) => onChange('faq', items)}
          />
        </section>

        {/* Objecoes */}
        <section className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            Objecoes Comuns
          </h3>
          <ObjectionsList
            items={profile.objections || []}
            onChange={(items) => onChange('objections', items)}
          />
        </section>
      </div>
    </div>
  );
};

export default KnowledgeTab;
