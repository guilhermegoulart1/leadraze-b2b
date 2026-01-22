import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, ChevronRight, X } from 'lucide-react';
import api from '../services/api';

const OnboardingAlert = () => {
  const { t } = useTranslation('onboarding');
  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const response = await api.getOnboarding();
      if (response.success) {
        const onboarding = response.data.onboarding;
        // Show alert if no onboarding or not completed
        if (!onboarding || (onboarding.status !== 'completed' && onboarding.status !== 'reviewed')) {
          setShowAlert(true);
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
    // Store in sessionStorage to keep dismissed for this session
    sessionStorage.setItem('onboarding_alert_dismissed', 'true');
  };

  // Check if dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem('onboarding_alert_dismissed') === 'true') {
      setDismissed(true);
    }
  }, []);

  if (loading || !showAlert || dismissed) {
    return null;
  }

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
};

export default OnboardingAlert;
