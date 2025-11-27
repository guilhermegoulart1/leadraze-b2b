import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const OnboardingContext = createContext();

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

// Definicao dos steps do onboarding
const ONBOARDING_STEPS = [
  {
    id: 'connect_linkedin',
    path: '/linkedin-accounts',
    icon: 'Linkedin',
  },
  {
    id: 'configure_agent',
    path: '/agents',
    icon: 'Bot',
  },
  {
    id: 'create_campaign',
    path: '/campaigns',
    icon: 'Award',
  },
];

const STORAGE_KEY = 'onboarding_progress';

export const OnboardingProvider = ({ children }) => {
  const { user } = useAuth();
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Carregar progresso do localStorage
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setCompletedSteps(data.completedSteps || []);
          setIsMinimized(data.isMinimized || false);
          setIsDismissed(data.isDismissed || false);
        } catch (e) {
          console.error('Erro ao carregar progresso do onboarding:', e);
        }
      }
    }
  }, [user?.id]);

  // Salvar progresso no localStorage
  const saveProgress = useCallback((completed, minimized, dismissed) => {
    if (user?.id) {
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, JSON.stringify({
        completedSteps: completed,
        isMinimized: minimized,
        isDismissed: dismissed,
      }));
    }
  }, [user?.id]);

  // Marcar step como completo
  const completeStep = useCallback((stepId) => {
    setCompletedSteps(prev => {
      if (prev.includes(stepId)) return prev;
      const updated = [...prev, stepId];
      saveProgress(updated, isMinimized, isDismissed);
      return updated;
    });
  }, [saveProgress, isMinimized, isDismissed]);

  // Verificar se step esta completo
  const isStepCompleted = useCallback((stepId) => {
    return completedSteps.includes(stepId);
  }, [completedSteps]);

  // Minimizar/Expandir
  const toggleMinimize = useCallback(() => {
    setIsMinimized(prev => {
      const updated = !prev;
      saveProgress(completedSteps, updated, isDismissed);
      return updated;
    });
  }, [saveProgress, completedSteps, isDismissed]);

  // Dispensar onboarding
  const dismissOnboarding = useCallback(() => {
    setIsDismissed(true);
    saveProgress(completedSteps, isMinimized, true);
  }, [saveProgress, completedSteps, isMinimized]);

  // Reabrir onboarding
  const reopenOnboarding = useCallback(() => {
    setIsDismissed(false);
    setIsMinimized(false);
    saveProgress(completedSteps, false, false);
  }, [saveProgress, completedSteps]);

  // Resetar progresso
  const resetProgress = useCallback(() => {
    setCompletedSteps([]);
    setIsMinimized(false);
    setIsDismissed(false);
    saveProgress([], false, false);
  }, [saveProgress]);

  // Verificar se onboarding foi finalizado
  const isOnboardingComplete = completedSteps.length === ONBOARDING_STEPS.length;

  // Progresso em porcentagem
  const progress = (completedSteps.length / ONBOARDING_STEPS.length) * 100;

  // Proximo step pendente
  const nextPendingStep = ONBOARDING_STEPS.find(step => !completedSteps.includes(step.id));

  const value = {
    steps: ONBOARDING_STEPS,
    completedSteps,
    completeStep,
    isStepCompleted,
    isMinimized,
    toggleMinimize,
    isDismissed,
    dismissOnboarding,
    reopenOnboarding,
    resetProgress,
    isOnboardingComplete,
    progress,
    nextPendingStep,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
