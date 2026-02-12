import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, ChevronRight, X, BarChart3 } from 'lucide-react';
import api from '../services/api';
import OnboardingProgress from './OnboardingProgress';

const OnboardingAlert = () => {
  const { t } = useTranslation('onboarding');
  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [formCompleted, setFormCompleted] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [showProgressModal, setShowProgressModal] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const response = await api.getChecklistProgress();
      if (response.success) {
        const data = response.data;

        if (!data.formCompleted) {
          // Form not completed yet - show red alert
          setShowAlert(true);
          setFormCompleted(false);
        } else if (!data.checklistComplete) {
          // Form done but checklist not 100% - show progress alert
          setShowAlert(true);
          setFormCompleted(true);
          setProgressData(data);
        } else {
          // Everything complete - hide alert
          setShowAlert(false);
        }
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('onboarding_alert_dismissed', 'true');
  };

  // Check if dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem('onboarding_alert_dismissed') === 'true') {
      setDismissed(true);
    }
  }, []);

  // Listen for onboarding form completion event
  useEffect(() => {
    const handleCompleted = () => {
      checkOnboardingStatus();
      setDismissed(false);
      sessionStorage.removeItem('onboarding_alert_dismissed');
    };
    window.addEventListener('onboarding-completed', handleCompleted);
    return () => window.removeEventListener('onboarding-completed', handleCompleted);
  }, []);

  if (loading || !showAlert || dismissed) {
    return null;
  }

  // Mode 1: Form not completed - red alert with link to form
  if (!formCompleted) {
    return (
      <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-3 relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">{t('alert.title')}</p>
              <p className="text-sm text-red-200">{t('alert.description')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/onboarding"
              className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
            >
              {t('alert.button')}
              <ChevronRight className="w-4 h-4" />
            </Link>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
              title={t('alert.dismiss')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mode 2: Form completed, checklist in progress - purple/blue alert with progress
  return (
    <>
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{t('checklist.alertTitle')}</p>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-32 bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressData?.percentage || 0}%` }}
                  />
                </div>
                <p className="text-sm text-purple-200">
                  {progressData?.percentage || 0}% {t('checklist.complete')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProgressModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
            >
              {t('checklist.viewProgress')}
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
              title={t('alert.dismiss')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {showProgressModal && (
        <OnboardingProgress
          data={progressData}
          onClose={() => setShowProgressModal(false)}
        />
      )}
    </>
  );
};

export default OnboardingAlert;
