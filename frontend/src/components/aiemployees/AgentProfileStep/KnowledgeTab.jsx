// frontend/src/components/aiemployees/AgentProfileStep/KnowledgeTab.jsx
// Base de Conhecimento - Design profissional com sidebar navigation

import React, { useState, useRef, useMemo } from 'react';
import {
  Building, Package, HelpCircle, Shield, FileText, Settings2,
  Search, Plus, X, Trash2, Edit2, Check, Upload, Loader,
  Globe, DollarSign, Users, Sparkles, AlertCircle
} from 'lucide-react';

// Navigation categories
const CATEGORIES = [
  { id: 'company', label: 'Empresa', icon: Building },
  { id: 'product', label: 'Produto', icon: Package },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'objections', label: 'Objecoes', icon: Shield },
  { id: 'documents', label: 'Documentos', icon: FileText },
  { id: 'settings', label: 'Configuracoes', icon: Settings2 }
];

// Sidebar Navigation Item
const NavItem = ({ category, isActive, count, onClick }) => {
  const Icon = category.icon;
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
        ${isActive
          ? 'bg-purple-600 text-white'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }
      `}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-sm font-medium">{category.label}</span>
      {count > 0 && (
        <span className={`
          px-1.5 py-0.5 text-xs rounded-full font-medium
          ${isActive
            ? 'bg-white/20 text-white'
            : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
          }
        `}>
          {count}
        </span>
      )}
    </button>
  );
};

// Empty State
const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
      <Icon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
    </div>
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">{description}</p>
    {action}
  </div>
);

// Item Card for FAQ/Objections
const ItemCard = ({ item, type, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const question = type === 'faq' ? item.question : item.objection;
  const answer = type === 'faq' ? item.answer : item.response;

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-all shadow-sm">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          type === 'faq'
            ? 'bg-blue-100 dark:bg-blue-900/30'
            : 'bg-red-100 dark:bg-red-900/30'
        }`}>
          {type === 'faq'
            ? <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            : <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
            {question || <span className="text-gray-400 italic">Sem pergunta</span>}
          </p>
          {!isExpanded && answer && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
              {answer}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {isExpanded && answer && (
        <div className="px-4 pb-4 pt-0">
          <div className="pl-11">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{answer}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Add/Edit Form for FAQ/Objections
const ItemForm = ({ type, item, onSave, onCancel }) => {
  const [question, setQuestion] = useState(item?.question || item?.objection || '');
  const [answer, setAnswer] = useState(item?.answer || item?.response || '');

  const handleSave = () => {
    if (!question.trim()) return;
    if (type === 'faq') {
      onSave({ question: question.trim(), answer: answer.trim() });
    } else {
      onSave({ objection: question.trim(), response: answer.trim() });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {type === 'faq' ? 'Pergunta' : 'Objecao'}
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={type === 'faq' ? 'Ex: Quanto custa o servico?' : 'Ex: E muito caro para mim'}
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {type === 'faq' ? 'Resposta' : 'Como responder'}
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={type === 'faq' ? 'Resposta para esta pergunta...' : 'Argumento para contornar esta objecao...'}
            rows={3}
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!question.trim()}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {item ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Simple text list (for benefits/differentials)
const TextList = ({ items, onChange, placeholder, emptyText }) => {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (!newItem.trim()) return;
    onChange([...items, newItem.trim()]);
    setNewItem('');
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-2 italic">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2 group p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Check className="w-4 h-4 text-green-600 dark:text-green-500 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{item}</span>
              <button
                onClick={() => removeItem(index)}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <button
          onClick={addItem}
          disabled={!newItem.trim()}
          className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Company Section
const CompanySection = ({ profile, onNestedChange }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5">
          Website
        </label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="url"
            value={profile.company?.website || ''}
            onChange={(e) => onNestedChange('company', 'website', e.target.value)}
            placeholder="https://suaempresa.com"
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5">
          Setor
        </label>
        <input
          type="text"
          value={profile.company?.sector || ''}
          onChange={(e) => onNestedChange('company', 'sector', e.target.value)}
          placeholder="Ex: SaaS B2B, E-commerce..."
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5">
        Descricao da Empresa
      </label>
      <textarea
        value={profile.company?.description || ''}
        onChange={(e) => onNestedChange('company', 'description', e.target.value)}
        placeholder="O que sua empresa faz, proposta de valor, diferenciais..."
        rows={3}
        className="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
      />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5">
          Ticket Medio
        </label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={profile.company?.avgTicket || ''}
            onChange={(e) => onNestedChange('company', 'avgTicket', e.target.value)}
            placeholder="R$ 500 - R$ 5.000"
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5">
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          ICP (Cliente Ideal)
        </label>
        <input
          type="text"
          value={profile.company?.icp || ''}
          onChange={(e) => onNestedChange('company', 'icp', e.target.value)}
          placeholder="Ex: Startups de tecnologia, 10-50 funcionarios"
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>
    </div>
  </div>
);

// Product Section
const ProductSection = ({ profile, onNestedChange }) => (
  <div className="space-y-5">
    <div>
      <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5">
        Nome do Produto/Servico
      </label>
      <input
        type="text"
        value={profile.product?.name || ''}
        onChange={(e) => onNestedChange('product', 'name', e.target.value)}
        placeholder="Ex: Plataforma de Automacao de Vendas"
        className="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1.5">
        Descricao
      </label>
      <textarea
        value={profile.product?.description || ''}
        onChange={(e) => onNestedChange('product', 'description', e.target.value)}
        placeholder="O que seu produto faz, como funciona, para quem e..."
        rows={3}
        className="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
      />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
          <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-green-600 dark:text-green-500" />
          Beneficios
        </label>
        <TextList
          items={profile.product?.benefits || []}
          onChange={(items) => onNestedChange('product', 'benefits', items)}
          placeholder="Adicionar beneficio..."
          emptyText="Nenhum beneficio adicionado"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
          <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-blue-600 dark:text-blue-500" />
          Diferenciais
        </label>
        <TextList
          items={profile.product?.differentials || []}
          onChange={(items) => onNestedChange('product', 'differentials', items)}
          placeholder="Adicionar diferencial..."
          emptyText="Nenhum diferencial adicionado"
        />
      </div>
    </div>
  </div>
);

// FAQ Section
const FAQSection = ({ items, onChange, searchQuery }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      item.question?.toLowerCase().includes(q) ||
      item.answer?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const handleSave = (data) => {
    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = data;
      onChange(updated);
      setEditingIndex(null);
    } else {
      onChange([...items, data]);
      setShowForm(false);
    }
  };

  const handleDelete = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {!showForm && editingIndex === null && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          <Plus className="w-4 h-4" />
          Adicionar pergunta frequente
        </button>
      )}

      {showForm && (
        <ItemForm
          type="faq"
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingIndex !== null && (
        <ItemForm
          type="faq"
          item={items[editingIndex]}
          onSave={handleSave}
          onCancel={() => setEditingIndex(null)}
        />
      )}

      {filteredItems.length === 0 && !showForm && editingIndex === null ? (
        <EmptyState
          icon={HelpCircle}
          title="Nenhuma pergunta adicionada"
          description="Adicione perguntas frequentes para ajudar o agente a responder duvidas comuns."
          action={
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm font-medium bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-1.5" />
              Adicionar FAQ
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item, index) => {
            const originalIndex = items.indexOf(item);
            if (editingIndex === originalIndex) return null;
            return (
              <ItemCard
                key={originalIndex}
                item={item}
                type="faq"
                onEdit={() => handleEdit(originalIndex)}
                onDelete={() => handleDelete(originalIndex)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// Objections Section
const ObjectionsSection = ({ items, onChange, searchQuery }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      item.objection?.toLowerCase().includes(q) ||
      item.response?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const handleSave = (data) => {
    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = data;
      onChange(updated);
      setEditingIndex(null);
    } else {
      onChange([...items, data]);
      setShowForm(false);
    }
  };

  const handleDelete = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {!showForm && editingIndex === null && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          <Plus className="w-4 h-4" />
          Adicionar objecao
        </button>
      )}

      {showForm && (
        <ItemForm
          type="objection"
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingIndex !== null && (
        <ItemForm
          type="objection"
          item={items[editingIndex]}
          onSave={handleSave}
          onCancel={() => setEditingIndex(null)}
        />
      )}

      {filteredItems.length === 0 && !showForm && editingIndex === null ? (
        <EmptyState
          icon={Shield}
          title="Nenhuma objecao adicionada"
          description="Adicione objecoes comuns e como o agente deve responder a cada uma."
          action={
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm font-medium bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-1.5" />
              Adicionar Objecao
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item, index) => {
            const originalIndex = items.indexOf(item);
            if (editingIndex === originalIndex) return null;
            return (
              <ItemCard
                key={originalIndex}
                item={item}
                type="objection"
                onEdit={() => handleEdit(originalIndex)}
                onDelete={() => handleDelete(originalIndex)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// Documents Section
const DocumentsSection = ({ documents, onChange }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (files) => {
    setIsUploading(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      const newDocs = Array.from(files).map(file => ({
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        chunks: Math.floor(Math.random() * 15) + 5,
        uploadedAt: new Date().toISOString()
      }));
      onChange([...(documents || []), ...newDocs]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id) => {
    onChange(documents.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) handleUpload(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      <div
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${isUploading
            ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
          }
        `}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader className="w-8 h-8 text-gray-400 animate-spin mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Processando documentos...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="w-8 h-8 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Clique para enviar documentos
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              PDF, DOC, DOCX, TXT, MD (max 10MB)
            </p>
          </div>
        )}
      </div>

      {documents?.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 group shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {doc.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {doc.chunks} chunks processados
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(!documents || documents.length === 0) && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Os documentos serao processados em chunks para busca semantica (RAG).
        </p>
      )}
    </div>
  );
};

// Settings Section
const SettingsSection = ({ value, onChange }) => {
  const threshold = value || 0.7;

  const getLevel = (val) => {
    if (val <= 0.6) return { label: 'Baixa', color: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30', desc: 'Retorna mais resultados, inclusive menos relevantes.' };
    if (val <= 0.75) return { label: 'Equilibrada', color: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30', desc: 'Bom balanco entre quantidade e relevancia.' };
    if (val <= 0.85) return { label: 'Alta', color: 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30', desc: 'Apenas resultados muito relevantes.' };
    return { label: 'Muito Alta', color: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30', desc: 'Apenas correspondencias quase exatas.' };
  };

  const level = getLevel(threshold);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
          Sensibilidade da Busca
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Define quao similar um conhecimento precisa ser para ser incluido na resposta do agente.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${level.color}`}>
            {level.label}
          </span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(threshold * 100)}%
          </span>
        </div>

        <input
          type="range"
          min="50"
          max="95"
          step="5"
          value={threshold * 100}
          onChange={(e) => onChange(parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          style={{
            accentColor: 'currentColor'
          }}
        />

        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Mais resultados</span>
          <span>Mais preciso</span>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {level.desc}
        </p>
      </div>
    </div>
  );
};

// Main Component
const KnowledgeTab = ({ profile, onChange, onNestedChange }) => {
  const [activeCategory, setActiveCategory] = useState('company');
  const [searchQuery, setSearchQuery] = useState('');

  const counts = useMemo(() => ({
    company: (profile.company?.website || profile.company?.description) ? 1 : 0,
    product: (profile.product?.name || profile.product?.description) ? 1 : 0,
    faq: profile.faq?.length || 0,
    objections: profile.objections?.length || 0,
    documents: profile.documents?.length || 0,
    settings: 0
  }), [profile]);

  const totalItems = counts.faq + counts.objections + (profile.product?.benefits?.length || 0) + (profile.product?.differentials?.length || 0);

  return (
    <div className="flex gap-6 min-h-[400px]">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0">
        <div className="space-y-1">
          {CATEGORIES.map(category => (
            <NavItem
              key={category.id}
              category={category}
              isActive={activeCategory === category.id}
              count={counts[category.id]}
              onClick={() => setActiveCategory(category.id)}
            />
          ))}
        </div>

        {/* Stats */}
        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between mb-1">
              <span>Total de itens</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{totalItems}</span>
            </div>
            <div className="flex justify-between">
              <span>Documentos</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{counts.documents}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        {/* Search (for FAQ and Objections) */}
        {(activeCategory === 'faq' || activeCategory === 'objections') && (
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar em ${activeCategory === 'faq' ? 'perguntas' : 'objecoes'}...`}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          {activeCategory === 'company' && (
            <CompanySection profile={profile} onNestedChange={onNestedChange} />
          )}
          {activeCategory === 'product' && (
            <ProductSection profile={profile} onNestedChange={onNestedChange} />
          )}
          {activeCategory === 'faq' && (
            <FAQSection
              items={profile.faq || []}
              onChange={(items) => onChange('faq', items)}
              searchQuery={searchQuery}
            />
          )}
          {activeCategory === 'objections' && (
            <ObjectionsSection
              items={profile.objections || []}
              onChange={(items) => onChange('objections', items)}
              searchQuery={searchQuery}
            />
          )}
          {activeCategory === 'documents' && (
            <DocumentsSection
              documents={profile.documents || []}
              onChange={(docs) => onChange('documents', docs)}
            />
          )}
          {activeCategory === 'settings' && (
            <SettingsSection
              value={profile.similarityThreshold}
              onChange={(val) => onChange('similarityThreshold', val)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeTab;
