import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Building2, Camera, Check, Globe, Loader2, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

const languages = [
  { code: 'pt', name: 'Portugues', nativeName: 'Portugues', flag: 'BR' },
  { code: 'en', name: 'English', nativeName: 'English', flag: 'US' },
  { code: 'es', name: 'Spanish', nativeName: 'Espanol', flag: 'ES' },
];

const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const { theme, changeTheme } = useTheme();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now());

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    profile_picture: null,
    avatar_url: null,
    preferred_language: 'pt',
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meu Perfil</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gerencie suas informacoes pessoais</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Picture Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Foto de Perfil</h2>

            <div className="flex items-center gap-6">
              {/* Avatar */}
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
                    className="w-24 h-24 rounded-full object-cover border-4 border-purple-100 dark:border-purple-900/30"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-2xl font-bold border-4 border-purple-100 dark:border-purple-900/30">
                    {getUserInitials()}
                  </div>
                )}

                {/* Camera overlay button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white hover:bg-purple-700 transition-colors shadow-lg dark:shadow-gray-900/50"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Clique no icone da camera para alterar sua foto
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  JPG, PNG ou GIF. Maximo 5MB.
                </p>
                {(formData.profile_picture || formData.avatar_url) && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, profile_picture: null, avatar_url: null }))}
                    className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Informacoes Pessoais</h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Seu nome"
                    required
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">O email nao pode ser alterado</p>
              </div>

              {/* Company */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Empresa
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Nome da sua empresa"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Language Preferences */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Idioma</h2>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`
                    relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                    ${formData.preferred_language === lang.code
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <span className="text-2xl">
                    {lang.flag === 'BR' && '🇧🇷'}
                    {lang.flag === 'US' && '🇺🇸'}
                    {lang.flag === 'ES' && '🇪🇸'}
                  </span>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{lang.nativeName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{lang.name}</p>
                  </div>
                  {formData.preferred_language === lang.code && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Preferences */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tema</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Escolha o tema de sua preferência</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Light Theme */}
              <button
                type="button"
                onClick={() => changeTheme('light')}
                className={`
                  relative p-4 rounded-xl border-2 transition-all
                  ${theme === 'light'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Sun className="w-8 h-8 mx-auto mb-2 text-gray-700 dark:text-gray-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Claro</p>
                </div>
                {theme === 'light' && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>

              {/* Dark Theme */}
              <button
                type="button"
                onClick={() => changeTheme('dark')}
                className={`
                  relative p-4 rounded-xl border-2 transition-all
                  ${theme === 'dark'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Moon className="w-8 h-8 mx-auto mb-2 text-gray-700 dark:text-gray-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Escuro</p>
                </div>
                {theme === 'dark' && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>

              {/* System Theme */}
              <button
                type="button"
                onClick={() => changeTheme('system')}
                className={`
                  relative p-4 rounded-xl border-2 transition-all
                  ${theme === 'system'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Monitor className="w-8 h-8 mx-auto mb-2 text-gray-700 dark:text-gray-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sistema</p>
                </div>
                {theme === 'system' && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <Check className="w-5 h-5" />
              Perfil atualizado com sucesso!
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alteracoes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
