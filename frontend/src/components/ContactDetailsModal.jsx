import React, { useState, useEffect } from 'react';
import {
  X, Mail, Phone, Building2, MapPin, Linkedin, Globe,
  MessageCircle, Instagram, Send, Calendar, FileText,
  Briefcase, GraduationCap, Image, Users, Facebook, Youtube, Twitter
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import ContactAvatar from './ContactAvatar';
import LocationMiniMap from './LocationMiniMap';
import OfficialDataTab from './OfficialDataTab';

const ContactDetailsModal = ({ isOpen, onClose, contactId, onEdit }) => {
  const { t } = useTranslation();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, activity, opportunities

  // Helper to safely parse JSON arrays that might come as strings from DB
  const parseJsonArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // If it's a comma-separated string, split it
        if (value.includes(',')) {
          return value.split(',').map(s => s.trim()).filter(Boolean);
        }
        return value ? [value] : [];
      }
    }
    return [];
  };

  // Helper to safely parse JSON objects
  const parseJsonObject = (value) => {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  };

  // Social icon mapping
  const socialIcons = {
    linkedin: { icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-50' },
    instagram: { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-50' },
    facebook: { icon: Facebook, color: 'text-blue-500', bg: 'bg-blue-50' },
    youtube: { icon: Youtube, color: 'text-red-600', bg: 'bg-red-50' },
    twitter: { icon: Twitter, color: 'text-sky-500', bg: 'bg-sky-50' }
  };

  useEffect(() => {
    if (isOpen && contactId) {
      loadContact();
    }
  }, [isOpen, contactId]);

  const loadContact = async () => {
    try {
      setLoading(true);
      const response = await api.getContact(contactId);
      if (response.success) {
        setContact(response.data.contact);
      }
    } catch (error) {
      console.error('Error loading contact:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const channelConfig = {
    whatsapp: { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'WhatsApp' },
    instagram: { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-100', label: 'Instagram' },
    email: { icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Email' },
    linkedin: { icon: Linkedin, color: 'text-blue-700', bg: 'bg-blue-100', label: 'LinkedIn' },
    telegram: { icon: Send, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Telegram' },
    phone: { icon: Phone, color: 'text-gray-600', bg: 'bg-gray-100', label: t('contacts.details.phone') }
  };

  const tagColors = {
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    pink: 'bg-pink-100 text-pink-700 border-pink-200'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : contact ? (
            <>
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <ContactAvatar
                      photoUrl={contact.profile_picture || (contact.source === 'google_maps' && contact.custom_fields?.photos?.[0])}
                      name={contact.name}
                      size="xl"
                    />
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{contact.name}</h2>
                      {contact.title && (
                        <p className="text-sm text-gray-600">{contact.title}</p>
                      )}
                      {contact.company && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Building2 className="w-4 h-4" />
                          {contact.company}
                        </p>
                      )}
                      {/* Tags */}
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {contact.tags.map(tag => (
                            <span
                              key={tag.id}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                tagColors[tag.color] || tagColors.blue
                              }`}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onEdit && (
                      <button
                        onClick={() => {
                          onEdit(contact);
                          onClose();
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        {t('contacts.actions.edit')}
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mt-4 border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'overview'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('contacts.details.tabs.overview')}
                  </button>
                  <button
                    onClick={() => setActiveTab('opportunities')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'opportunities'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('contacts.details.tabs.opportunities')} ({contact.opportunities?.length || 0})
                  </button>
                  {/* Photos Tab - only show if photos exist */}
                  {contact.photos && parseJsonArray(contact.photos).length > 0 && (
                    <button
                      onClick={() => setActiveTab('photos')}
                      className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                        activeTab === 'photos'
                          ? 'border-purple-600 text-purple-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Image className="w-3.5 h-3.5" />
                      {t('contacts.details.tabs.photos')} ({parseJsonArray(contact.photos).length})
                    </button>
                  )}
                  {/* Official Data Tab - only show if cnpj_data exists */}
                  {contact.cnpj_data && (
                    <button
                      onClick={() => setActiveTab('officialData')}
                      className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                        activeTab === 'officialData'
                          ? 'border-purple-600 text-purple-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {t('contacts.officialData.title')}
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Contact Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('contacts.details.contactInfo')}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {contact.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">{t('contacts.details.email')}</p>
                              <a href={`mailto:${contact.email}`} className="text-sm text-purple-600 hover:underline">
                                {contact.email}
                              </a>
                            </div>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">{t('contacts.details.phone')}</p>
                              <a href={`tel:${contact.phone}`} className="text-sm text-gray-700">
                                {contact.phone}
                              </a>
                            </div>
                          </div>
                        )}
                        {contact.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">{t('contacts.details.location')}</p>
                              <p className="text-sm text-gray-700">{contact.location}</p>
                            </div>
                          </div>
                        )}
                        {/* Mini Map */}
                        {(contact.latitude && contact.longitude) && (
                          <div className="col-span-2">
                            <LocationMiniMap
                              latitude={contact.latitude}
                              longitude={contact.longitude}
                              height={120}
                            />
                          </div>
                        )}
                        {contact.industry && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">{t('contacts.details.industry')}</p>
                              <p className="text-sm text-gray-700">{contact.industry}</p>
                            </div>
                          </div>
                        )}
                        {contact.website && (
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">{t('contacts.details.website', 'Website')}</p>
                              <a
                                href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-purple-600 hover:underline"
                              >
                                {contact.website}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Multiple Emails */}
                    {parseJsonArray(contact.emails).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          {t('contacts.details.allEmails', 'Emails encontrados')} ({parseJsonArray(contact.emails).length})
                        </h3>
                        <div className="space-y-2">
                          {parseJsonArray(contact.emails).map((emailObj, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <div className="flex-1 min-w-0">
                                <a href={`mailto:${emailObj.email}`} className="text-sm text-purple-600 hover:underline truncate block">
                                  {emailObj.email}
                                </a>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {emailObj.type && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                      emailObj.type === 'personal' ? 'bg-green-100 text-green-700' :
                                      emailObj.type === 'commercial' ? 'bg-blue-100 text-blue-700' :
                                      emailObj.type === 'support' ? 'bg-orange-100 text-orange-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {emailObj.type}
                                    </span>
                                  )}
                                  {emailObj.department && (
                                    <span className="text-[10px] text-gray-500">{emailObj.department}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Multiple Phones */}
                    {parseJsonArray(contact.phones).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          {t('contacts.details.allPhones', 'Telefones encontrados')} ({parseJsonArray(contact.phones).length})
                        </h3>
                        <div className="space-y-2">
                          {parseJsonArray(contact.phones).map((phoneObj, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <div className="flex-1 min-w-0">
                                <a href={`tel:${phoneObj.phone}`} className="text-sm text-gray-700 dark:text-gray-300">
                                  {phoneObj.phone}
                                </a>
                                {phoneObj.type && (
                                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                                    phoneObj.type === 'whatsapp' ? 'bg-green-100 text-green-700' :
                                    phoneObj.type === 'mobile' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {phoneObj.type === 'whatsapp' ? 'WhatsApp' : phoneObj.type}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Social Links */}
                    {Object.keys(parseJsonObject(contact.social_links)).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          {t('contacts.details.socialLinks', 'Redes Sociais')}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(parseJsonObject(contact.social_links)).map(([network, url]) => {
                            const config = socialIcons[network] || { icon: Globe, color: 'text-gray-600', bg: 'bg-gray-50' };
                            const IconComponent = config.icon;
                            return (
                              <a
                                key={network}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 px-3 py-2 ${config.bg} dark:bg-gray-800 rounded-lg hover:opacity-80 transition-opacity`}
                              >
                                <IconComponent className={`w-4 h-4 ${config.color}`} />
                                <span className="text-sm capitalize text-gray-700 dark:text-gray-300">{network}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Team Members */}
                    {parseJsonArray(contact.team_members).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          <Users className="w-4 h-4 inline mr-2" />
                          {t('contacts.details.teamMembers', 'Equipe')} ({parseJsonArray(contact.team_members).length})
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          {parseJsonArray(contact.team_members).map((member, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</p>
                              {member.role && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{member.role}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {member.email && (
                                  <a href={`mailto:${member.email}`} className="text-purple-600 hover:underline">
                                    <Mail className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {member.linkedin && (
                                  <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    <Linkedin className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Channels */}
                    {contact.channels && contact.channels.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('contacts.details.channels')}</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {contact.channels.map((channel, idx) => {
                            const config = channelConfig[channel.type];
                            if (!config) return null;
                            const IconComponent = config.icon;
                            return (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className={`p-2 rounded-full ${config.bg}`}>
                                  <IconComponent className={`w-4 h-4 ${config.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500">{config.label}</p>
                                  <p className="text-sm text-gray-900 truncate">
                                    {channel.username || channel.channelId || '-'}
                                  </p>
                                  {channel.messageCount > 0 && (
                                    <p className="text-xs text-gray-500">
                                      {channel.messageCount} {t('contacts.details.messages')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Headline */}
                    {contact.headline && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('contacts.details.headline')}</h3>
                        <p className="text-sm text-gray-700">{contact.headline}</p>
                      </div>
                    )}

                    {/* About */}
                    {contact.about && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('contacts.details.about')}</h3>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{contact.about}</p>
                      </div>
                    )}

                    {/* Company Intelligence (GPT Analysis) */}
                    {(() => {
                      const services = parseJsonArray(contact.company_services);
                      const painPoints = parseJsonArray(contact.pain_points);
                      const hasIntelligence = contact.company_description || services.length > 0 || painPoints.length > 0;

                      if (!hasIntelligence) return null;

                      return (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                              {t('contacts.details.companyIntelligence', 'Inteligência da Empresa')}
                            </h3>
                            <span className="text-xs bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200 px-1.5 py-0.5 rounded">IA</span>
                          </div>

                          {/* Description */}
                          {contact.company_description && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{contact.company_description}</p>
                          )}

                          {/* Services */}
                          {services.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
                                {t('contacts.details.services', 'Serviços')}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {services.map((service, idx) => (
                                  <span key={idx} className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                    {service}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pain Points */}
                          {painPoints.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
                                {t('contacts.details.painPoints', 'Oportunidades')}
                              </p>
                              <ul className="space-y-1">
                                {painPoints.map((pain, idx) => (
                                  <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                                    <span className="text-amber-500 mt-0.5">•</span>
                                    {pain}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Profile Links */}
                    {(contact.profile_url || contact.linkedin_profile_id) && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('contacts.details.profileLinks')}</h3>
                        <div className="space-y-2">
                          {contact.profile_url && (
                            <a
                              href={contact.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-purple-600 hover:underline"
                            >
                              <Globe className="w-4 h-4" />
                              {contact.profile_url}
                            </a>
                          )}
                          {contact.linkedin_profile_id && (
                            <a
                              href={`https://linkedin.com/in/${contact.linkedin_profile_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-purple-600 hover:underline"
                            >
                              <Linkedin className="w-4 h-4" />
                              linkedin.com/in/{contact.linkedin_profile_id}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {contact.notes && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('contacts.details.notesInternal')}</h3>
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('contacts.details.systemInfo')}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">{t('contacts.details.source')}</p>
                          <p className="text-gray-900 capitalize">{contact.source || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('contacts.details.createdAt')}</p>
                          <p className="text-gray-900">
                            {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        {contact.last_interaction_at && (
                          <div>
                            <p className="text-gray-500">{t('contacts.details.lastInteraction')}</p>
                            <p className="text-gray-900">
                              {new Date(contact.last_interaction_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Opportunities Tab */}
                {activeTab === 'opportunities' && (
                  <div>
                    {contact.opportunities && contact.opportunities.length > 0 ? (
                      <div className="space-y-3">
                        {contact.opportunities.map(opp => (
                          <div key={opp.id} className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium text-gray-900">{opp.name}</h4>
                                <p className="text-sm text-gray-500 mt-1">
                                  {t('contacts.details.opportunities.role')}: <span className="capitalize">{opp.role}</span>
                                </p>
                                <p className="text-sm text-gray-500">
                                  {t('contacts.details.opportunities.status')}: <span className="capitalize">{opp.status}</span>
                                </p>
                              </div>
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                {opp.role}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>{t('contacts.details.opportunities.none')}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Photos Tab */}
                {activeTab === 'photos' && (
                  <div>
                    {(() => {
                      const photos = parseJsonArray(contact.photos);
                      if (photos.length === 0) {
                        return (
                          <div className="text-center py-12 text-gray-500">
                            <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>{t('contacts.details.photos.noPhotos')}</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Image className="w-4 h-4 text-purple-600" />
                            {t('contacts.details.photos.googleMapsPhotos')}
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {photos.map((photo, idx) => (
                              <a
                                key={idx}
                                href={photo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative group aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:border-purple-400 transition-colors"
                              >
                                <img
                                  src={photo}
                                  alt={`${contact.name} - Photo ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="hidden items-center justify-center w-full h-full text-gray-400">
                                  <Image className="w-8 h-8" />
                                </div>
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                    Ver imagem
                                  </span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Official Data Tab */}
                {activeTab === 'officialData' && contact.cnpj_data && (
                  <OfficialDataTab
                    cnpj={contact.cnpj}
                    cnpjData={contact.cnpj_data}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-96">
              <p className="text-gray-500">{t('contacts.details.notFound')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactDetailsModal;
