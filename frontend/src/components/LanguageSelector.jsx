import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import api from '../services/api';

const languages = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
  },
];

export default function LanguageSelector({ variant = 'dropdown' }) {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const changeLanguage = async (languageCode) => {
    try {
      setIsSaving(true);

      // Change language in i18n
      await i18n.changeLanguage(languageCode);

      // Save to backend (if user is logged in)
      try {
        await api.put('/users/language', { language: languageCode });
      } catch (error) {
        // If user is not logged in, just change locally
        console.log('Language saved locally only');
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Error changing language:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Dropdown variant (for settings page)
  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Globe className="w-4 h-4 text-gray-500" />
          <span className="text-2xl">{currentLanguage.flag}</span>
          <span className="font-medium">{currentLanguage.nativeName}</span>
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown menu */}
            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => changeLanguage(language.code)}
                  disabled={isSaving}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                    currentLanguage.code === language.code ? 'bg-blue-50' : ''
                  } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-2xl">{language.flag}</span>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{language.nativeName}</div>
                    <div className="text-sm text-gray-500">{language.name}</div>
                  </div>
                  {currentLanguage.code === language.code && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Compact variant (for header/user menu)
  if (variant === 'compact') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={currentLanguage.nativeName}
        >
          <span className="text-xl">{currentLanguage.flag}</span>
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => changeLanguage(language.code)}
                  disabled={isSaving}
                  className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors ${
                    currentLanguage.code === language.code ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="text-xl">{language.flag}</span>
                  <span className="text-sm">{language.nativeName}</span>
                  {currentLanguage.code === language.code && (
                    <Check className="w-4 h-4 text-blue-600 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}
