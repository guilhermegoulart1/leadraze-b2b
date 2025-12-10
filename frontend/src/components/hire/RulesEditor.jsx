import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Plus, AlertTriangle, Ban, Check, Lightbulb, Target,
  Zap, Heart, Shield, Save, ChevronDown, ChevronUp, Info, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

// Rule prefixes with their visual style and icon
const RULE_PREFIXES = [
  {
    id: 'never',
    icon: Ban,
    color: 'red',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-100 dark:bg-red-900/40',
    badgeText: 'text-red-700 dark:text-red-300',
    order: 1
  },
  {
    id: 'avoid',
    icon: AlertTriangle,
    color: 'orange',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-100 dark:bg-orange-900/40',
    badgeText: 'text-orange-700 dark:text-orange-300',
    order: 2
  },
  {
    id: 'always',
    icon: Check,
    color: 'green',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-600 dark:text-green-400',
    badgeBg: 'bg-green-100 dark:bg-green-900/40',
    badgeText: 'text-green-700 dark:text-green-300',
    order: 3
  },
  {
    id: 'prefer',
    icon: Heart,
    color: 'pink',
    bgColor: 'bg-pink-500/10',
    textColor: 'text-pink-600 dark:text-pink-400',
    badgeBg: 'bg-pink-100 dark:bg-pink-900/40',
    badgeText: 'text-pink-700 dark:text-pink-300',
    order: 4
  },
  {
    id: 'prioritize',
    icon: Target,
    color: 'blue',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
    badgeText: 'text-blue-700 dark:text-blue-300',
    order: 5
  },
  {
    id: 'when',
    icon: Zap,
    color: 'yellow',
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    badgeBg: 'bg-yellow-100 dark:bg-yellow-900/40',
    badgeText: 'text-yellow-700 dark:text-yellow-300',
    order: 6
  },
  {
    id: 'remember',
    icon: Lightbulb,
    color: 'purple',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-100 dark:bg-purple-900/40',
    badgeText: 'text-purple-700 dark:text-purple-300',
    order: 7
  },
  {
    id: 'protect',
    icon: Shield,
    color: 'indigo',
    bgColor: 'bg-indigo-500/10',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    order: 8
  }
];

// Inline editable text component
const EditableText = ({ value, onChange, className }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim()) {
      onChange(editValue.trim());
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 text-sm border border-purple-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 -mx-2 rounded transition-colors ${className}`}
      title="Clique para editar"
    >
      {value}
    </span>
  );
};

// Sort icon component
const SortIcon = ({ sortKey, currentSort, currentDirection }) => {
  if (currentSort !== sortKey) {
    return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
  }
  return currentDirection === 'asc'
    ? <ArrowUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
    : <ArrowDown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
};

// Main RulesEditor component
const RulesEditor = ({
  isOpen,
  onClose,
  rules = [],
  onSave,
  agentName = 'Vendedor',
  isLoading = false
}) => {
  const { t } = useTranslation('hire');
  const [localRules, setLocalRules] = useState(rules);
  const [selectedPrefix, setSelectedPrefix] = useState(null);
  const [ruleText, setRuleText] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [sortBy, setSortBy] = useState(null); // 'type' or 'instruction'
  const [sortDirection, setSortDirection] = useState('asc');

  // Add new rule
  const handleAddRule = () => {
    if (!selectedPrefix || !ruleText.trim()) return;

    const newRule = {
      id: Date.now().toString(),
      prefix: selectedPrefix,
      text: ruleText.trim()
    };

    setLocalRules([...localRules, newRule]);
    setRuleText('');
  };

  // Remove rule
  const handleRemoveRule = (ruleId) => {
    setLocalRules(localRules.filter(r => r.id !== ruleId));
  };

  // Update rule text
  const handleUpdateRuleText = (ruleId, newText) => {
    setLocalRules(localRules.map(r =>
      r.id === ruleId ? { ...r, text: newText } : r
    ));
  };

  // Save all rules
  const handleSave = () => {
    onSave(localRules);
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

  // Get sorted rules
  const getSortedRules = () => {
    if (!sortBy) return localRules;

    return [...localRules].sort((a, b) => {
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
  };

  if (!isOpen) return null;

  const hasRules = localRules.length > 0;
  const sortedRules = getSortedRules();

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('rules.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('rules.subtitle', { name: agentName })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Add Rule Section */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {/* Prefix Buttons */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {RULE_PREFIXES.map((prefix) => {
                const Icon = prefix.icon;
                const isSelected = selectedPrefix === prefix.id;
                return (
                  <button
                    key={prefix.id}
                    onClick={() => setSelectedPrefix(isSelected ? null : prefix.id)}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all
                      ${isSelected
                        ? `${prefix.badgeBg} ${prefix.badgeText} ring-1 ring-current`
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                      }
                    `}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t(`rules.prefixes.${prefix.id}`)}
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
                  placeholder={t(`rules.placeholders.${selectedPrefix}`)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                  autoFocus
                />
                <button
                  onClick={handleAddRule}
                  disabled={!ruleText.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {t('rules.add')}
                </button>
              </div>
            )}
          </div>

          {/* Rules List - Table Style */}
          <div className="p-4">
            {hasRules ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th
                        className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none"
                        onClick={() => handleSort('type')}
                      >
                        <span className="flex items-center gap-1.5">
                          {t('rules.table.type')}
                          <SortIcon sortKey="type" currentSort={sortBy} currentDirection={sortDirection} />
                        </span>
                      </th>
                      <th
                        className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none"
                        onClick={() => handleSort('instruction')}
                      >
                        <span className="flex items-center gap-1.5">
                          {t('rules.table.instruction')}
                          <SortIcon sortKey="instruction" currentSort={sortBy} currentDirection={sortDirection} />
                        </span>
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">

                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedRules.map((rule) => {
                      const prefix = RULE_PREFIXES.find(p => p.id === rule.prefix);
                      if (!prefix) return null;
                      const Icon = prefix.icon;
                      return (
                        <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${prefix.badgeBg} ${prefix.badgeText}`}>
                              <Icon className="w-3 h-3" />
                              {t(`rules.prefixes.${prefix.id}`)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                            <EditableText
                              value={rule.text}
                              onChange={(newText) => handleUpdateRuleText(rule.id, newText)}
                            />
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
            ) : (
              <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <Shield className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('rules.empty.title')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {t('rules.empty.description')}
                </p>
              </div>
            )}
          </div>

          {/* Examples - Collapsible */}
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                {t('rules.examples.title')}
              </span>
              {showExamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showExamples && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1.5 p-2 bg-gray-50 dark:bg-gray-800/30 rounded">
                  <Ban className="w-3 h-3 text-red-500 flex-shrink-0" />
                  <span className="truncate">{t('rules.examples.never')}</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 bg-gray-50 dark:bg-gray-800/30 rounded">
                  <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                  <span className="truncate">{t('rules.examples.always')}</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 bg-gray-50 dark:bg-gray-800/30 rounded">
                  <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                  <span className="truncate">{t('rules.examples.avoid')}</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 bg-gray-50 dark:bg-gray-800/30 rounded">
                  <Heart className="w-3 h-3 text-pink-500 flex-shrink-0" />
                  <span className="truncate">{t('rules.examples.prefer')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {t('rules.cancel')}
          </button>

          <div className="flex items-center gap-3">
            {hasRules && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('rules.activeRules', { count: localRules.length })}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('rules.saving')}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t('rules.save')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RulesEditor;
