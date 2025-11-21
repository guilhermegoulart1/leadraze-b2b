import React, { useState, useEffect } from 'react';
import {
  X, Mail, Phone, Building2, MapPin, Linkedin, Globe,
  MessageCircle, Instagram, Send, Calendar, FileText,
  Briefcase, GraduationCap
} from 'lucide-react';
import api from '../services/api';

const ContactDetailsModal = ({ isOpen, onClose, contactId, onEdit }) => {
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, activity, opportunities

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
    phone: { icon: Phone, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Telefone' }
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
                    {contact.profile_picture ? (
                      <img
                        src={contact.profile_picture}
                        alt={contact.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xl">
                        {contact.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
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
                        Editar
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
                    Visão Geral
                  </button>
                  <button
                    onClick={() => setActiveTab('opportunities')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'opportunities'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Oportunidades ({contact.opportunities?.length || 0})
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Contact Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Informações de Contato</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {contact.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Email</p>
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
                              <p className="text-xs text-gray-500">Telefone</p>
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
                              <p className="text-xs text-gray-500">Localização</p>
                              <p className="text-sm text-gray-700">{contact.location}</p>
                            </div>
                          </div>
                        )}
                        {contact.industry && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Indústria</p>
                              <p className="text-sm text-gray-700">{contact.industry}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Channels */}
                    {contact.channels && contact.channels.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Canais de Comunicação</h3>
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
                                      {channel.messageCount} mensagens
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
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Headline</h3>
                        <p className="text-sm text-gray-700">{contact.headline}</p>
                      </div>
                    )}

                    {/* About */}
                    {contact.about && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Sobre</h3>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{contact.about}</p>
                      </div>
                    )}

                    {/* Profile Links */}
                    {(contact.profile_url || contact.linkedin_profile_id) && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Links do Perfil</h3>
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
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Notas Internas</h3>
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Informações do Sistema</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Origem</p>
                          <p className="text-gray-900 capitalize">{contact.source || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Criado em</p>
                          <p className="text-gray-900">
                            {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        {contact.last_interaction_at && (
                          <div>
                            <p className="text-gray-500">Última Interação</p>
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
                                  Função: <span className="capitalize">{opp.role}</span>
                                </p>
                                <p className="text-sm text-gray-500">
                                  Status: <span className="capitalize">{opp.status}</span>
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
                        <p>Nenhuma oportunidade vinculada</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-96">
              <p className="text-gray-500">Contato não encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactDetailsModal;
