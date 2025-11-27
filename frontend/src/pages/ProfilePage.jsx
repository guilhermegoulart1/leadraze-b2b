import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Building2, Camera, Check, Globe, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const languages = [
  { code: 'pt', name: 'Portugues', nativeName: 'Portugues', flag: 'BR' },
  { code: 'en', name: 'English', nativeName: 'English', flag: 'US' },
  { code: 'es', name: 'Spanish', nativeName: 'Espanol', flag: 'ES' },
];

const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    profile_picture: null,
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
        profile_picture: event.target.result
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
      const response = await api.updateUserProfile(formData);

      if (response.success) {
        setSuccess(true);

        // Update local user context
        if (response.data.user) {
          setUser({
            ...user,
            name: response.data.user.name,
            company: response.data.user.company,
            profile_picture: response.data.user.profile_picture,
            preferred_language: response.data.user.preferred_language,
          });
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
    return formData.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-600 mt-1">Gerencie suas informacoes pessoais</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Picture Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Foto de Perfil</h2>

            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                {formData.profile_picture ? (
                  <img
                    src={formData.profile_picture}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-purple-100"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-2xl font-bold border-4 border-purple-100">
                    {getUserInitials()}
                  </div>
                )}

                {/* Camera overlay button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white hover:bg-purple-700 transition-colors shadow-lg"
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
                <p className="text-sm text-gray-600 mb-2">
                  Clique no icone da camera para alterar sua foto
                </p>
                <p className="text-xs text-gray-400">
                  JPG, PNG ou GIF. Maximo 5MB.
                </p>
                {formData.profile_picture && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, profile_picture: null }))}
                    className="mt-2 text-sm text-red-600 hover:text-red-700"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Informacoes Pessoais</h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all outline-none"
                    placeholder="Seu nome"
                    required
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">O email nao pode ser alterado</p>
              </div>

              {/* Company */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empresa
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all outline-none"
                    placeholder="Nome da sua empresa"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Language Preferences */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Globe className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Idioma</h2>
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
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className="text-2xl">
                    {lang.flag === 'BR' && '🇧🇷'}
                    {lang.flag === 'US' && '🇺🇸'}
                    {lang.flag === 'ES' && '🇪🇸'}
                  </span>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{lang.nativeName}</p>
                    <p className="text-sm text-gray-500">{lang.name}</p>
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

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
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
