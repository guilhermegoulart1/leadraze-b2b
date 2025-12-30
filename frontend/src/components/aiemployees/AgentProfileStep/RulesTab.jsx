// frontend/src/components/aiemployees/AgentProfileStep/RulesTab.jsx
// Tab de Regras de Comportamento - inspirado no RulesEditor de /agents

import React, { useState } from 'react';
import {
  Plus, Trash2, Ban, AlertTriangle, Check, Lightbulb, Target,
  Zap, Heart, Shield, ChevronDown, ChevronUp, Info, Search,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

// Rule prefixes with their visual style and icon
const RULE_PREFIXES = [
  {
    id: 'never',
    icon: Ban,
    label: 'Nunca',
    placeholder: 'Ex: mencionar concorrentes',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-100 dark:bg-red-900/40',
    badgeText: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-200 dark:border-red-800',
    order: 1
  },
  {
    id: 'avoid',
    icon: AlertTriangle,
    label: 'Evitar',
    placeholder: 'Ex: respostas muito longas',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    textColor: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-100 dark:bg-orange-900/40',
    badgeText: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-200 dark:border-orange-800',
    order: 2
  },
  {
    id: 'always',
    icon: Check,
    label: 'Sempre',
    placeholder: 'Ex: confirmar interesse antes de agendar',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-600 dark:text-green-400',
    badgeBg: 'bg-green-100 dark:bg-green-900/40',
    badgeText: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-200 dark:border-green-800',
    order: 3
  },
  {
    id: 'prefer',
    icon: Heart,
    label: 'Preferir',
    placeholder: 'Ex: linguagem informal e amigavel',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    textColor: 'text-pink-600 dark:text-pink-400',
    badgeBg: 'bg-pink-100 dark:bg-pink-900/40',
    badgeText: 'text-pink-700 dark:text-pink-300',
    borderColor: 'border-pink-200 dark:border-pink-800',
    order: 4
  },
  {
    id: 'prioritize',
    icon: Target,
    label: 'Priorizar',
    placeholder: 'Ex: qualificacao antes de demonstracao',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
    badgeText: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-800',
    order: 5
  },
  {
    id: 'when',
    icon: Zap,
    label: 'Quando',
    placeholder: 'Ex: lead mencionar preco, explicar valor primeiro',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
    order: 6
  },
  {
    id: 'remember',
    icon: Lightbulb,
    label: 'Lembrar',
    placeholder: 'Ex: sempre usar nome do lead',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    textColor: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-100 dark:bg-purple-900/40',
    badgeText: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-800',
    order: 7
  },
  {
    id: 'protect',
    icon: Shield,
    label: 'Proteger',
    placeholder: 'Ex: informacoes confidenciais do cliente',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    order: 8
  }
];

// Sort icon component
const SortIcon = ({ sortKey, currentSort, currentDirection }) => {
  if (currentSort !== sortKey) {
    return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
  }
  return currentDirection === 'asc'
    ? <ArrowUp className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
    : <ArrowDown className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />;
};

const RulesTab = ({ profile, onChange }) => {
  const rules = profile.priority_rules || [];
  const [selectedPrefix, setSelectedPrefix] = useState(null);
  const [ruleText, setRuleText] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Add new rule
  const handleAddRule = () => {
    if (!selectedPrefix || !ruleText.trim()) return;

    const newRule = {
      id: Date.now().toString(),
      prefix: selectedPrefix,
      text: ruleText.trim()
    };

    onChange('priority_rules', [...rules, newRule]);
    setRuleText('');
  };

  // Remove rule
  const handleRemoveRule = (ruleId) => {
    onChange('priority_rules', rules.filter(r => r.id !== ruleId));
  };

  // Start editing
  const startEditing = (rule) => {
    setEditingRuleId(rule.id);
    setEditingText(rule.text);
  };

  // Save edit
  const saveEdit = (ruleId) => {
    if (!editingText.trim()) {
      setEditingRuleId(null);
      return;
    }
    onChange('priority_rules', rules.map(r =>
      r.id === ruleId ? { ...r, text: editingText.trim() } : r
    ));
    setEditingRuleId(null);
    setEditingText('');
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddRule();
    }
  };

  // Handle sort
  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  };

  // Get sorted and filtered rules
  const getDisplayRules = () => {
    let filtered = rules;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = rules.filter(rule => {
        const prefix = RULE_PREFIXES.find(p => p.id === rule.prefix);
        return (
          rule.text.toLowerCase().includes(query) ||
          prefix?.label.toLowerCase().includes(query)
        );
      });
    }

    // Apply sorting
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let compareA, compareB;

        if (sortBy === 'type') {
          const prefixA = RULE_PREFIXES.find(p => p.id === a.prefix);
          const prefixB = RULE_PREFIXES.find(p => p.id === b.prefix);
          compareA = prefixA?.order || 999;
          compareB = prefixB?.order || 999;
        } else if (sortBy === 'instruction') {
          compareA = a.text.toLowerCase();
          compareB = b.text.toLowerCase();
        }

        if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
        if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  const hasRules = rules.length > 0;
  const displayRules = getDisplayRules();

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              Regras de Comportamento
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Defina diretrizes que o agente deve seguir durante as conversas.
              Use prefixos para categorizar e priorizar as regras.
            </p>
          </div>
        </div>
      </div>

      {/* Add Rule Section */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Adicionar nova regra
        </h4>

        {/* Prefix Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {RULE_PREFIXES.map((prefix) => {
            const Icon = prefix.icon;
            const isSelected = selectedPrefix === prefix.id;
            return (
              <button
                key={prefix.id}
                onClick={() => setSelectedPrefix(isSelected ? null : prefix.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${isSelected
                    ? `${prefix.badgeBg} ${prefix.badgeText} ring-2 ring-current ring-opacity-50`
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {prefix.label}
              </button>
            );
          })}
        </div>

        {/* Rule Input */}
        {selectedPrefix && (
          <div className="flex gap-2">
            <input
              type="text"
              value={ruleText}
              onChange={(e) => setRuleText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={RULE_PREFIXES.find(p => p.id === selectedPrefix)?.placeholder}
              className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              autoFocus
            />
            <button
              onClick={handleAddRule}
              disabled={!ruleText.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        )}
      </div>

      {/* Search and Rules List */}
      {hasRules && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar regras..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* Rules Table */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none w-32"
                    onClick={() => handleSort('type')}
                  >
                    <span className="flex items-center gap-1.5">
                      Tipo
                      <SortIcon sortKey="type" currentSort={sortBy} currentDirection={sortDirection} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                    onClick={() => handleSort('instruction')}
                  >
                    <span className="flex items-center gap-1.5">
                      Instrucao
                      <SortIcon sortKey="instruction" currentSort={sortBy} currentDirection={sortDirection} />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {displayRules.map((rule) => {
                  const prefix = RULE_PREFIXES.find(p => p.id === rule.prefix);
                  if (!prefix) return null;
                  const Icon = prefix.icon;
                  const isEditing = editingRuleId === rule.id;

                  return (
                    <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${prefix.badgeBg} ${prefix.badgeText}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {prefix.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => saveEdit(rule.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(rule.id);
                              if (e.key === 'Escape') setEditingRuleId(null);
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(rule)}
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 -mx-2 rounded transition-colors"
                            title="Clique para editar"
                          >
                            {rule.text}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemoveRule(rule.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>{displayRules.length} de {rules.length} regras</span>
            {searchQuery && displayRules.length === 0 && (
              <span>Nenhuma regra encontrada para "{searchQuery}"</span>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasRules && (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Nenhuma regra configurada
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Selecione um tipo acima e adicione sua primeira regra
          </p>
        </div>
      )}

      {/* Examples - Collapsible */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Ver exemplos de regras
          </span>
          {showExamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showExamples && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg">
                <Ban className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-300">Nunca mencionar concorrentes</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-300">Sempre confirmar interesse antes de agendar</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-300">Evitar respostas muito longas</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg">
                <Heart className="w-4 h-4 text-pink-500 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-300">Preferir linguagem informal</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg">
                <Target className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-300">Priorizar qualificacao antes de demo</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-gray-800 rounded-lg">
                <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-300">Quando mencionar preco, explicar valor</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RulesTab;
