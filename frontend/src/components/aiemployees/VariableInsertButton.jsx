// frontend/src/components/aiemployees/VariableInsertButton.jsx
// Botao para inserir variaveis em campos de texto

import React, { useState, useRef, useEffect } from 'react';
import { Variable, ChevronDown, User, Building2, Briefcase, MapPin, AtSign, Phone, Sparkles } from 'lucide-react';

// Variaveis nativas por canal
const channelVariables = {
  linkedin: [
    { name: 'first_name', label: 'Primeiro Nome', icon: User, description: 'Nome do contato' },
    { name: 'name', label: 'Nome Completo', icon: User, description: 'Nome completo' },
    { name: 'company', label: 'Empresa', icon: Building2, description: 'Empresa atual' },
    { name: 'title', label: 'Cargo', icon: Briefcase, description: 'Cargo/titulo' },
    { name: 'location', label: 'Localizacao', icon: MapPin, description: 'Cidade/Pais' },
    { name: 'industry', label: 'Setor', icon: Building2, description: 'Industria/setor' }
  ],
  whatsapp: [
    { name: 'first_name', label: 'Primeiro Nome', icon: User, description: 'Nome do contato' },
    { name: 'name', label: 'Nome Completo', icon: User, description: 'Nome completo' },
    { name: 'company', label: 'Empresa', icon: Building2, description: 'Empresa' },
    { name: 'phone', label: 'Telefone', icon: Phone, description: 'Numero de telefone' }
  ],
  email: [
    { name: 'first_name', label: 'Primeiro Nome', icon: User, description: 'Nome do contato' },
    { name: 'name', label: 'Nome Completo', icon: User, description: 'Nome completo' },
    { name: 'company', label: 'Empresa', icon: Building2, description: 'Empresa' },
    { name: 'title', label: 'Cargo', icon: Briefcase, description: 'Cargo/titulo' },
    { name: 'email', label: 'Email', icon: AtSign, description: 'Endereco de email' }
  ]
};

const VariableInsertButton = ({
  onInsert,
  channel = 'linkedin',
  customVariables = [],
  className = '',
  size = 'md',
  showLabel = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const nativeVars = channelVariables[channel] || channelVariables.linkedin;

  const handleInsert = (variableName) => {
    onInsert(`{{${variableName}}}`);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base'
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors
          bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
          hover:bg-gray-200 dark:hover:bg-gray-600
          border border-gray-300 dark:border-gray-600
          ${sizeClasses[size]}
        `}
      >
        <Variable className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {showLabel && <span>Variaveis</span>}
        <ChevronDown className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 max-h-80 overflow-y-auto">
          {/* Native Variables */}
          <div className="px-3 py-1.5">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Variaveis do Contato
            </div>
          </div>
          {nativeVars.map((variable) => {
            const Icon = variable.icon;
            return (
              <button
                key={variable.name}
                type="button"
                onClick={() => handleInsert(variable.name)}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <Icon className="w-4 h-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {`{{${variable.name}}}`}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {variable.description}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Custom Variables */}
          {customVariables.length > 0 && (
            <>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
              <div className="px-3 py-1.5">
                <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Variaveis Customizadas
                </div>
              </div>
              {customVariables.map((variable, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleInsert(variable.name)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      {`{{${variable.name}}}`}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {variable.value ? `Valor: ${variable.value}` : 'Sem valor padrao'}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Helper Text */}
          <div className="mt-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Clique para inserir a variavel no cursor atual.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariableInsertButton;
