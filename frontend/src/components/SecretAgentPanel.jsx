import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Clock, ChevronDown, ChevronUp, RefreshCw, Loader, MessageSquare
} from 'lucide-react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';

const SecretAgentPanel = ({ conversationId, onCallAgent }) => {
  const { t } = useTranslation('secretAgentCoaching');
  const [loading, setLoading] = useState(true);
  const [coaching, setCoaching] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (conversationId) {
      loadCoaching();
    }
  }, [conversationId]);

  const loadCoaching = async () => {
    setLoading(true);
    try {
      // Get latest coaching
      const latestResponse = await api.getLatestSecretAgentCoaching(conversationId);
      if (latestResponse.success && latestResponse.data) {
        setCoaching(latestResponse.data);
      } else {
        setCoaching(null);
      }

      // Get history
      const historyResponse = await api.getSecretAgentCoachingHistory(conversationId, 5);
      if (historyResponse.success) {
        setHistory(historyResponse.data?.coachings || []);
      }
    } catch (err) {
      console.error('Error loading coaching:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleNewCoaching = (newCoaching) => {
    setCoaching(newCoaching);
    loadCoaching(); // Reload to update history
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100">
              {t('panel.title')}
            </h4>
            {coaching && (
              <p className="text-xs text-purple-600 dark:text-purple-400">
                {coaching.messages_analyzed} {t('panel.messagesAnalyzed')}
              </p>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {!coaching ? (
            // No coaching yet
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-purple-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('panel.callAgent')}
              </p>
              <button
                onClick={() => onCallAgent?.(handleNewCoaching)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <Sparkles className="w-4 h-4" />
                {t('panel.callAgentButton')}
              </button>
            </div>
          ) : (
            // Has coaching
            <>
              {/* Coaching content */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    {t('panel.generatedAt')} {formatDate(coaching.created_at)}
                  </div>
                  <button
                    onClick={() => onCallAgent?.(handleNewCoaching)}
                    className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t('panel.newCoaching')}
                  </button>
                </div>

                {/* AI Response - Markdown formatted */}
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h3 className="text-base font-bold mt-3 mb-2 text-purple-900 dark:text-purple-100">{children}</h3>,
                      h2: ({ children }) => <h4 className="text-sm font-bold mt-3 mb-2 text-purple-800 dark:text-purple-200">{children}</h4>,
                      h3: ({ children }) => <h5 className="text-sm font-semibold mt-2 mb-1 text-purple-700 dark:text-purple-300">{children}</h5>,
                      p: ({ children }) => <p className="text-sm mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside text-sm mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside text-sm mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      code: ({ inline, children }) =>
                        inline ? (
                          <code className="bg-purple-100 dark:bg-purple-900/30 px-1 py-0.5 rounded text-xs">{children}</code>
                        ) : (
                          <pre className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg text-xs overflow-x-auto my-2">
                            <code>{children}</code>
                          </pre>
                        ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-purple-500 pl-3 my-2 text-sm italic text-gray-600 dark:text-gray-400">
                          {children}
                        </blockquote>
                      ),
                      strong: ({ children }) => <strong className="font-semibold text-purple-800 dark:text-purple-200">{children}</strong>,
                    }}
                  >
                    {coaching.ai_response}
                  </ReactMarkdown>
                </div>
              </div>

              {/* History toggle */}
              {history.length > 1 && (
                <div className="border-t border-purple-200 dark:border-purple-800 pt-3">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    {showHistory ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        {t('panel.collapse')}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        {t('panel.history')} ({history.length - 1} {t('panel.viewMore')})
                      </>
                    )}
                  </button>

                  {/* History list */}
                  {showHistory && (
                    <div className="mt-3 space-y-2">
                      {history.slice(1).map((item) => (
                        <div
                          key={item.id}
                          className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 text-xs"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-500 dark:text-gray-400">
                              {formatDate(item.created_at)}
                            </span>
                            <span className="text-purple-600 dark:text-purple-400">
                              {item.messages_analyzed} msgs
                            </span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 line-clamp-3">
                            {item.objective}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SecretAgentPanel;
