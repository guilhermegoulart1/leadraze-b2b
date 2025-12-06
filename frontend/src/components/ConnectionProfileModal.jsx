import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Linkedin, Building2, MapPin, Users, Briefcase, GraduationCap,
  Award, Globe, Languages, Save, ExternalLink, Mail, Phone
} from 'lucide-react';
import api from '../services/api';

const ConnectionProfileModal = ({
  isOpen,
  onClose,
  profile,
  linkedinAccountId
}) => {
  const { t } = useTranslation(['connections', 'common']);
  const [activeTab, setActiveTab] = useState('overview');
  const [saving, setSaving] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Visao Geral', icon: Users },
    { id: 'experience', label: 'Experiencia', icon: Briefcase },
    { id: 'education', label: 'Educacao', icon: GraduationCap },
    { id: 'skills', label: 'Competencias', icon: Award },
    { id: 'more', label: 'Mais', icon: Globe }
  ];

  const handleSaveToCRM = async () => {
    try {
      setSaving(true);
      const response = await api.saveConnectionToCRM(linkedinAccountId, profile);
      if (response.success) {
        alert('Contato salvo no CRM com sucesso!');
      }
    } catch (error) {
      console.error('Error saving to CRM:', error);
      alert(error.message || 'Erro ao salvar no CRM');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {profile.profile_picture ? (
                <img
                  src={profile.profile_picture}
                  alt={profile.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center border-4 border-white">
                  <span className="text-3xl font-bold text-white">
                    {profile.first_name?.[0] || profile.name?.[0] || '?'}
                  </span>
                </div>
              )}
              <div className="text-white">
                <h2 className="text-xl font-bold">{profile.name}</h2>
                <p className="text-blue-100 mt-1">{profile.headline || profile.title}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-blue-100">
                  {profile.company && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {profile.company}
                    </span>
                  )}
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {profile.location}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3 mt-4">
            <a
              href={profile.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver no LinkedIn
            </a>
            <button
              onClick={handleSaveToCRM}
              disabled={saving || profile.in_crm}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {profile.in_crm ? 'Ja esta no CRM' : saving ? 'Salvando...' : 'Salvar no CRM'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {profile.connections_count || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Conexoes</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {profile.followers_count || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Seguidores</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {profile.experience?.length || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Experiencias</p>
                </div>
              </div>

              {/* About */}
              {profile.about && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Sobre</h3>
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line">{profile.about}</p>
                </div>
              )}

              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                {profile.industry && (
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Setor</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{profile.industry}</p>
                  </div>
                )}
                {profile.location && (
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Localizacao</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{profile.location}</p>
                  </div>
                )}
              </div>

              {/* Campaign History */}
              {profile.previous_campaigns?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Historico de Campanhas
                  </h3>
                  <div className="space-y-2">
                    {profile.previous_campaigns.map((campaign, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">{campaign.name}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          campaign.status === 'active'
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                            : campaign.status === 'completed'
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        }`}>
                          {campaign.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Experience Tab */}
          {activeTab === 'experience' && (
            <div className="space-y-4">
              {profile.experience?.length > 0 ? (
                profile.experience.map((exp, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <Briefcase className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {exp.title || exp.position}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400">{exp.company || exp.company_name}</p>
                        {(exp.start_date || exp.dates) && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {exp.start_date} - {exp.end_date || 'Presente'}
                          </p>
                        )}
                        {exp.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{exp.description}</p>
                        )}
                        {exp.location && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {exp.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Nenhuma experiencia profissional encontrada
                </p>
              )}
            </div>
          )}

          {/* Education Tab */}
          {activeTab === 'education' && (
            <div className="space-y-4">
              {profile.education?.length > 0 ? (
                profile.education.map((edu, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {edu.school || edu.school_name}
                        </h4>
                        {edu.degree && (
                          <p className="text-gray-600 dark:text-gray-400">{edu.degree}</p>
                        )}
                        {edu.field_of_study && (
                          <p className="text-gray-600 dark:text-gray-400">{edu.field_of_study}</p>
                        )}
                        {(edu.start_date || edu.dates) && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {edu.start_date} - {edu.end_date || 'Presente'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Nenhuma formacao encontrada
                </p>
              )}
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === 'skills' && (
            <div>
              {profile.skills?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                    >
                      {typeof skill === 'string' ? skill : skill.name || skill.skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Nenhuma competencia encontrada
                </p>
              )}
            </div>
          )}

          {/* More Tab */}
          {activeTab === 'more' && (
            <div className="space-y-6">
              {/* Languages */}
              {profile.languages?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Languages className="w-5 h-5" />
                    Idiomas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.languages.map((lang, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                      >
                        {typeof lang === 'string' ? lang : lang.name || lang.language}
                        {lang.proficiency && ` (${lang.proficiency})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {profile.certifications?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Certificacoes
                  </h3>
                  <div className="space-y-2">
                    {profile.certifications.map((cert, idx) => (
                      <div
                        key={idx}
                        className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {typeof cert === 'string' ? cert : cert.name}
                        </p>
                        {cert.issuing_organization && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">{cert.issuing_organization}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw data for debugging */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Dados Completos
                </h3>
                <pre className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs text-gray-900 dark:text-gray-100 overflow-auto max-h-60">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionProfileModal;
