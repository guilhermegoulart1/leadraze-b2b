import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Building2, Camera, Check, Loader2, Sun, Moon, Monitor, Phone, ChevronDown, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import { COUNTRIES } from '../components/PhoneInput';

const languages = [
  { code: 'pt', name: 'Português', flagUrl: 'https://flagcdn.com/w40/br.png' },
  { code: 'en', name: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
  { code: 'es', name: 'Español', flagUrl: 'https://flagcdn.com/w40/es.png' },
];

const ProfilePage = () => {
  const { t, i18n } = useTranslation('settings');
  const { user, setUser } = useAuth();
  const { theme, changeTheme } = useTheme();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now());
  const [currentLang, setCurrentLang] = useState(i18n.language);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef(null);
  const countrySearchRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    profile_picture: null,
    avatar_url: null,
    preferred_language: 'pt',
    default_country: 'BR',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await api.getUserProfile();
      if (response.success) {
        const userData = response.data.user;
        setFormData({
          name: userData.name || '',
          company: userData.company || '',
          profile_picture: userData.profile_picture || null,
          avatar_url: userData.avatar_url || null,
          preferred_language: userData.preferred_language || 'pt',
          default_country: userData.default_country || 'BR',
        });
      }
    } catch (err) {
      setError('Erro ao carregar perfil');
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem valida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no maximo 5MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData(prev => ({
        ...prev,
        profile_picture: event.target.result,
        avatar_url: null // Clear old URL when new image is selected
      }));
      setError(null);
    };
    reader.onerror = () => {
      setError('Erro ao processar imagem');
    };
    reader.readAsDataURL(file);
  };

  const handleLanguageChange = async (langCode) => {
    setFormData(prev => ({
      ...prev,
      preferred_language: langCode
    }));

    // Change i18n language immediately
    await i18n.changeLanguage(langCode);

    // Force re-render by updating state
    setCurrentLang(langCode);
  };

  // Country dropdown handlers
  // Ordenar paises: atual primeiro, depois alfabeticamente
  const getSortedCountries = (countries) => {
    const currentCountry = countries.find(c => c.code === formData.default_country);
    const otherCountries = countries
      .filter(c => c.code !== formData.default_country)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    return currentCountry ? [currentCountry, ...otherCountries] : otherCountries;
  };

  const filteredCountries = countrySearch
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.dialCode.includes(countrySearch) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())
      ).sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    : getSortedCountries(COUNTRIES);

  const selectedCountry = COUNTRIES.find(c => c.code === formData.default_country) || COUNTRIES[0];

  // Close country dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target)) {
        setCountryDropdownOpen(false);
        setCountrySearch('');
      }
    };
    if (countryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [countryDropdownOpen]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (countryDropdownOpen && countrySearchRef.current) {
      countrySearchRef.current.focus();
    }
  }, [countryDropdownOpen]);

  const handleCountrySelect = (country) => {
    setFormData(prev => ({ ...prev, default_country: country.code }));
    setCountryDropdownOpen(false);
    setCountrySearch('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      // Prepare payload - only send profile_picture if it's a new base64 image
      const payload = {
        name: formData.name,
        company: formData.company,
        preferred_language: formData.preferred_language,
        default_country: formData.default_country,
      };

      // Only include profile_picture if it's a new base64 image or explicitly set to null for removal
      if (formData.profile_picture && formData.profile_picture.startsWith('data:image/')) {
        payload.profile_picture = formData.profile_picture;
      } else if (!formData.avatar_url && !formData.profile_picture) {
        // Only send null if both are empty (user wants to remove photo)
        payload.profile_picture = null;
      }
      // Otherwise, don't send profile_picture at all (keeps existing photo)

      const response = await api.updateUserProfile(payload);

      if (response.success) {
        setSuccess(true);

        // Update local user context
        if (response.data.user) {
          setUser({
            ...user,
            name: response.data.user.name,
            company: response.data.user.company,
            profile_picture: response.data.user.profile_picture,
            avatar_url: response.data.user.avatar_url,
            preferred_language: response.data.user.preferred_language,
            default_country: response.data.user.default_country,
            updated_at: response.data.user.updated_at,
          });

          // Update form data with server response
          setFormData(prev => ({
            ...prev,
            profile_picture: response.data.user.profile_picture,
            avatar_url: response.data.user.avatar_url,
          }));

          // Update avatar timestamp to bust cache
          setAvatarTimestamp(Date.now());
        }

        // Hide success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.message || 'Erro ao salvar perfil');
      }
    } catch (err) {
      setError(err.message || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const getUserInitials = () => {
    if (!formData.name) return 'US';
    const names = formData.name.trim().split(' ').filter(n => n.length > 0);
    if (names.length === 1) {
      // Se só tem um nome, pega as 2 primeiras letras
      return names[0].substring(0, 2).toUpperCase();
    }
    // Pega primeira letra do primeiro nome + primeira letra do segundo nome
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 overflow-auto">
      <div className="max-w-3xl mx-auto px-4 py-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Card - Avatar + Info Combined */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex gap-5">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="relative">
                  {(formData.profile_picture || formData.avatar_url) ? (
                    <img
                      src={
                        formData.profile_picture ||
                        (formData.avatar_url && formData.avatar_url.startsWith('http')
                          ? `${formData.avatar_url}?v=${avatarTimestamp}`
                          : formData.avatar_url)
                      }
                      alt="Profile"
                      className="w-16 h-16 rounded-full object-cover border-2 border-purple-100 dark:border-purple-900/30"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-lg font-bold border-2 border-purple-100 dark:border-purple-900/30">
                      {getUserInitials()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white hover:bg-purple-700 transition-colors shadow-md"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                {(formData.profile_picture || formData.avatar_url) && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, profile_picture: null, avatar_url: null }))}
                    className="mt-1 text-xs text-red-500 hover:text-red-600 w-full text-center"
                  >
                    {t('profile.removePhoto')}
                  </button>
                )}
              </div>

              {/* Form Fields */}
              <div className="flex-1 grid grid-cols-2 gap-3">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('profile.name')}
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      placeholder={t('profile.namePlaceholder')}
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('profile.email')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full pl-8 pr-3 py-2 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Company */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('profile.company')}
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      placeholder={t('profile.companyPlaceholder')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preferences Row - Language + Theme side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Language */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">{t('profile.language')}</h3>
              <div className="flex gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`
                      flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-all text-sm
                      ${formData.preferred_language === lang.code
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                      }
                    `}
                  >
                    <img src={lang.flagUrl} alt={lang.name} className="w-5 h-4 object-cover rounded-sm" />
                    <span className="hidden sm:inline">{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">{t('profile.theme')}</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => changeTheme('light')}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border transition-all text-sm
                    ${theme === 'light'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  <Sun className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('profile.themeLight')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => changeTheme('dark')}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border transition-all text-sm
                    ${theme === 'dark'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  <Moon className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('profile.themeDark')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => changeTheme('system')}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border transition-all text-sm
                    ${theme === 'system'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  <Monitor className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('profile.themeAuto')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Default Country for Phone */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('profile.defaultCountry')}</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {t('profile.defaultCountryDescription')}
            </p>

            {/* Country Dropdown */}
            <div className="relative" ref={countryDropdownRef}>
              <button
                type="button"
                onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={selectedCountry.flag}
                    alt={selectedCountry.name}
                    className="w-6 h-4 object-cover rounded-sm"
                  />
                  <span className="text-gray-900 dark:text-gray-100">{selectedCountry.name}</span>
                  <span className="text-gray-500 dark:text-gray-400">{selectedCountry.dialCode}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {countryDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-72 overflow-hidden">
                  {/* Search */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        ref={countrySearchRef}
                        type="text"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Buscar pais..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Countries List */}
                  <div className="overflow-y-auto max-h-56">
                    {filteredCountries.length > 0 ? (
                      filteredCountries.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => handleCountrySelect(country)}
                          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left ${
                            formData.default_country === country.code ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                          }`}
                        >
                          <img
                            src={country.flag}
                            alt={country.name}
                            className="w-6 h-4 object-cover rounded-sm"
                          />
                          <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                            {country.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {country.dialCode}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Nenhum pais encontrado
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Messages + Submit */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  {t('profile.savedSuccess')}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('profile.saving')}
                </>
              ) : (
                t('profile.save')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
