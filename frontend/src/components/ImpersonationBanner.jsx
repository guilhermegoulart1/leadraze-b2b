import React, { useState, useEffect } from 'react';
import { Shield, Clock, LogOut, AlertTriangle } from 'lucide-react';
import api from '../services/api';

const ImpersonationBanner = () => {
  const [session, setSession] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    // Verifica se ha uma sessao de suporte ativa
    const sessionData = localStorage.getItem('supportSession');
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        setSession(parsed);
      } catch (e) {
        console.error('Error parsing support session:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (!session?.expiresAt) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const expires = new Date(session.expiresAt);
      const diff = expires - now;

      if (diff <= 0) {
        setTimeRemaining('Expirado');
        handleEndSession();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Atualiza a cada minuto

    return () => clearInterval(interval);
  }, [session]);

  const handleEndSession = async () => {
    setEnding(true);
    try {
      const sessionToken = localStorage.getItem('supportSessionToken');
      if (sessionToken) {
        await api.post('/support-access/session/end', {}, {
          headers: {
            'X-Support-Session': sessionToken
          }
        });
      }
    } catch (error) {
      console.error('Error ending session:', error);
    } finally {
      // Limpa dados locais independente do resultado
      localStorage.removeItem('supportSessionToken');
      localStorage.removeItem('supportSession');
      // Redireciona para a pagina de suporte
      window.location.href = '/support-access';
    }
  };

  // Nao renderiza se nao houver sessao
  if (!session) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="font-semibold">Modo Suporte</span>
            </div>
            <span className="text-amber-100">|</span>
            <span className="text-sm">
              Acessando <strong>{session.accountName}</strong> como <strong>{session.operatorName}</strong>
            </span>
            {session.purpose && (
              <>
                <span className="text-amber-100">|</span>
                <span className="text-sm text-amber-100">{session.purpose}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>Expira em: <strong>{timeRemaining}</strong></span>
            </div>

            <button
              onClick={handleEndSession}
              disabled={ending}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {ending ? (
                <span>Encerrando...</span>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  Encerrar Sessao
                </>
              )}
            </button>
          </div>
        </div>

        {/* Warning for limited time */}
        {timeRemaining && parseInt(timeRemaining) <= 30 && !timeRemaining.includes('h') && (
          <div className="flex items-center gap-2 mt-1 text-sm text-amber-100">
            <AlertTriangle className="w-4 h-4" />
            <span>Atencao: Sua sessao expira em breve. Salve seu trabalho.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpersonationBanner;
