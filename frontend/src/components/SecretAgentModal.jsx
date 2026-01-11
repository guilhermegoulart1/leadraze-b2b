import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Loader, Sparkles, Target, AlertCircle, RefreshCw,
  AlertTriangle, Lightbulb, Copy, Check, ChevronRight, MessageSquare, Download
} from 'lucide-react';
import api from '../services/api';

const SecretAgentModal = ({ isOpen, onClose, conversationId, onSuccess }) => {
  const { t } = useTranslation('secretAgentCoaching');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [objective, setObjective] = useState('');

  // Result state
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setObjective('');
      setError('');
      setResult(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!objective.trim()) {
      setError(t('errors.objectiveRequired'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.generateSecretAgentCoaching(conversationId, {
        objective: objective.trim()
      });

      if (response.success) {
        // Parse o resultado
        const data = response.data;
        let parsed = data.parsed;

        // Se não veio parsed, tentar parsear do response
        if (!parsed && data.response) {
          try {
            parsed = JSON.parse(data.response);
          } catch (e) {
            parsed = { situacao: data.response };
          }
        }

        setResult({
          ...data,
          parsed: parsed || {}
        });

        // Notificar sucesso (para atualizar painel se necessário)
        onSuccess?.(data);
      }
    } catch (err) {
      console.error('Error generating coaching:', err);
      setError(err.message || t('errors.generateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMessage = async () => {
    if (!result?.parsed?.sugestao_mensagem) return;
    try {
      await navigator.clipboard.writeText(result.parsed.sugestao_mensagem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleNewAnalysis = () => {
    setResult(null);
    setObjective('');
    setError('');
  };

  const handleDownload = () => {
    if (!result?.parsed) return;

    const p = result.parsed;
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let content = `ORIENTAÇÃO DE VENDAS - SECRET AGENT\n`;
    content += `${'='.repeat(50)}\n`;
    content += `Gerado em: ${date} às ${time}\n`;
    content += `Objetivo: ${objective}\n`;
    content += `Mensagens analisadas: ${result.messagesAnalyzed}\n\n`;

    if (p.tecnica) {
      content += `TÉCNICA RECOMENDADA: ${p.tecnica}\n`;
      if (p.tecnica_motivo) {
        content += `Motivo: ${p.tecnica_motivo}\n`;
      }
      content += `\n`;
    }

    if (p.situacao) {
      content += `ANÁLISE DA SITUAÇÃO\n`;
      content += `${'-'.repeat(30)}\n`;
      content += `${p.situacao}\n\n`;
    }

    if (p.pontos_atencao?.length > 0) {
      content += `PONTOS DE ATENÇÃO\n`;
      content += `${'-'.repeat(30)}\n`;
      p.pontos_atencao.forEach((ponto, i) => {
        content += `${i + 1}. ${ponto}\n`;
      });
      content += `\n`;
    }

    if (p.sugestao_mensagem) {
      content += `SUGESTÃO DE MENSAGEM\n`;
      content += `${'-'.repeat(30)}\n`;
      content += `${p.sugestao_mensagem}\n\n`;
    }

    if (p.proximos_passos?.length > 0) {
      content += `PRÓXIMOS PASSOS\n`;
      content += `${'-'.repeat(30)}\n`;
      p.proximos_passos.forEach((passo, i) => {
        content += `${i + 1}. ${passo}\n`;
      });
    }

    // Criar e baixar arquivo
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orientacao-vendas-${date.replace(/\//g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {result ? 'Análise da IA' : t('modal.title')}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {result
                    ? `${result.messagesAnalyzed} mensagens analisadas`
                    : t('modal.subtitle')
                  }
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
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-8 h-8 text-purple-600 animate-spin mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Analisando conversa...
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Isso pode levar alguns segundos
              </p>
            </div>
          )}

          {/* Input form */}
          {!loading && !result && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  {t('modal.objectiveLabel')}
                </label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder={t('modal.objectivePlaceholder')}
                  rows={4}
                  autoFocus
                  className="w-full px-4 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none placeholder-gray-400 dark:placeholder-gray-500"
                />
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  Ex: "Quero agendar uma reunião", "Preciso qualificar o lead", "Quero entender as dores dele"
                </p>
              </div>
            </div>
          )}

          {/* Result display */}
          {!loading && result && result.parsed && (
            <div className="space-y-4">
              {/* Técnica badge */}
              {result.parsed.tecnica && (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                    {result.parsed.tecnica}
                  </span>
                </div>
              )}

              {/* Situação */}
              {result.parsed.situacao && (
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {result.parsed.situacao}
                  </p>
                </div>
              )}

              {/* Técnica motivo */}
              {result.parsed.tecnica_motivo && (
                <div className="text-xs text-gray-500 dark:text-gray-400 italic border-l-2 border-purple-300 dark:border-purple-700 pl-3">
                  {result.parsed.tecnica_motivo}
                </div>
              )}

              {/* Pontos de Atenção */}
              {result.parsed.pontos_atencao && result.parsed.pontos_atencao.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Pontos de Atenção
                  </p>
                  <div className="space-y-1.5">
                    {result.parsed.pontos_atencao.map((ponto, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                        <span className="text-sm text-amber-800 dark:text-amber-300">{ponto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestão de Mensagem */}
              {result.parsed.sugestao_mensagem && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Sugestão de mensagem
                    </p>
                    <button
                      onClick={handleCopyMessage}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-green-600 dark:text-green-400">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">
                    {result.parsed.sugestao_mensagem}
                  </p>
                </div>
              )}

              {/* Próximos Passos */}
              {result.parsed.proximos_passos && result.parsed.proximos_passos.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Próximos Passos
                  </p>
                  <div className="space-y-1.5">
                    {result.parsed.proximos_passos.map((passo, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-green-800 dark:text-green-300">{passo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex justify-end gap-3">
            {!result ? (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !objective.trim()}
                  className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {t('modal.generateButton')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleNewAnalysis}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Nova Análise
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Salvar
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecretAgentModal;
