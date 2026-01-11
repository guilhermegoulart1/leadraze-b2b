// frontend/src/components/ConversationInviteModal.jsx
// Modal para enviar convite de conexão a partir de uma conversa
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, UserPlus, Send, Loader, Check, AlertCircle, MessageSquare, MessageSquareDashed
} from 'lucide-react';
import api from '../services/api';

// Variáveis disponíveis para mensagem de convite
const MESSAGE_VARIABLES = [
  { key: 'first_name', label: 'Primeiro Nome' },
  { key: 'name', label: 'Nome Completo' },
  { key: 'company', label: 'Empresa' },
  { key: 'title', label: 'Cargo' }
];

const ConversationInviteModal = ({
  isOpen,
  onClose,
  linkedinAccountId,
  contact,
  onSuccess
}) => {
  const { t } = useTranslation(['conversations', 'common']);
  const [mode, setMode] = useState(null); // null | 'with_message' | 'without_message'
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null); // 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const textareaRef = useRef(null);

  // Reset quando modal abre
  useEffect(() => {
    if (isOpen) {
      setMode(null);
      setMessage('');
      setResult(null);
      setErrorMessage('');
    }
  }, [isOpen]);

  const insertVariable = (variableKey) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const variable = `{{${variableKey}}}`;
    const currentValue = message;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);

    // Verificar limite de 300 caracteres
    if (newValue.length > 300) return;

    setMessage(newValue);

    // Reposicionar cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  // Processar variáveis para preview
  const processPreview = (text) => {
    if (!text || !contact) return text;

    let processed = text;

    // Extrair primeiro nome
    const firstName = contact.name?.split(' ')[0] || contact.first_name || '';

    const replacements = {
      'first_name': firstName,
      'name': contact.name || '',
      'company': contact.company || '',
      'title': contact.title || contact.headline || ''
    };

    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      processed = processed.replace(regex, value || `{{${key}}}`);
    });

    return processed;
  };

  const handleSend = async () => {
    if (!linkedinAccountId || !contact?.provider_id) {
      setResult('error');
      setErrorMessage('Dados do contato incompletos');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setErrorMessage('');

    try {
      // Processar mensagem com variáveis
      const processedMessage = mode === 'with_message' ? processPreview(message) : null;

      const response = await api.sendInvitation(
        linkedinAccountId,
        contact.provider_id,
        processedMessage
      );

      if (response.success) {
        setResult('success');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setResult('error');
        setErrorMessage(response.message || 'Erro ao enviar convite');
      }
    } catch (err) {
      console.error('Erro ao enviar convite:', err);
      setResult('error');
      setErrorMessage(err.message || 'Erro ao enviar convite');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Enviar Convite
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {contact?.name || 'Usuário'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 overflow-y-auto">
          {/* Resultado */}
          {result === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Convite enviado!
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                O convite foi enviado para {contact?.name || 'o usuário'}
              </p>
            </div>
          )}

          {result === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Erro ao enviar
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {errorMessage}
              </p>
              <button
                onClick={() => setResult(null)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Seleção de modo (sem resultado) */}
          {!result && !mode && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Como você deseja enviar o convite de conexão?
              </p>

              <button
                onClick={() => setMode('with_message')}
                className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Com mensagem
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Envie uma mensagem personalizada junto com o convite
                  </p>
                </div>
              </button>

              <button
                onClick={() => setMode('without_message')}
                className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <MessageSquareDashed className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Sem mensagem
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Envie apenas o convite de conexão
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Modo sem mensagem - confirmação */}
          {!result && mode === 'without_message' && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Você está prestes a enviar um convite de conexão para:
                </p>
                <div className="mt-3 flex items-center gap-3">
                  {contact?.profile_picture ? (
                    <img
                      src={contact.profile_picture}
                      alt={contact.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <span className="text-purple-600 dark:text-purple-400 font-medium text-lg">
                        {contact?.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {contact?.name || 'Usuário'}
                    </p>
                    {contact?.headline && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {contact.headline}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setMode(null)}
                className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
              >
                Voltar
              </button>
            </div>
          )}

          {/* Modo com mensagem */}
          {!result && mode === 'with_message' && (
            <div className="space-y-4">
              {/* Botões de variáveis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Inserir variável:
                </label>
                <div className="flex flex-wrap gap-2">
                  {MESSAGE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      type="button"
                      className="px-2.5 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mensagem (máx. 300 caracteres):
                </label>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                  placeholder="Ex: Olá {{first_name}}, vi que você trabalha na {{company}}..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">
                    {message.length}/300 caracteres
                  </span>
                </div>
              </div>

              {/* Preview */}
              {message && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preview:
                  </label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {processPreview(message)}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setMode(null)}
                className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
              >
                Voltar
              </button>
            </div>
          )}
        </div>

        {/* Footer - só mostra quando tem modo selecionado e não tem resultado */}
        {!result && mode && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={isLoading || (mode === 'with_message' && !message.trim())}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Convite
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationInviteModal;
