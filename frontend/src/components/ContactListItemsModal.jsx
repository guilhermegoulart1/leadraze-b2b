import React, { useState, useEffect } from 'react';
import { X, Users, Mail, Phone, Linkedin, Building2, Briefcase, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const ContactListItemsModal = ({ isOpen, onClose, list }) => {
  const { t } = useTranslation(['contacts', 'common']);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && list) {
      loadItems();
    }
  }, [isOpen, list]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await api.getContactListItems(list.id, { limit: 1000 });
      if (response.success) {
        setItems(response.data.items || []);
      }
    } catch (error) {
      console.error('Erro ao carregar itens da lista:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const name = (item.name || item.contact_name || '').toLowerCase();
      const email = (item.email || item.contact_email || '').toLowerCase();
      const company = (item.company || item.contact_company || '').toLowerCase();

      return name.includes(search) || email.includes(search) || company.includes(search);
    }

    return true;
  });

  if (!isOpen || !list) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{list.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {items.length} {t('lists.contacts')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('lists.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">{t('lists.loadingContacts')}</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? t('lists.noContactsFound') : t('lists.emptyList')}
              </h3>
              <p className="text-gray-600">
                {searchTerm ? t('lists.tryAdjustingSearch') : t('lists.importToStart')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('lists.contact')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('lists.company')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('form.email')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('lists.phone')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('lists.channels')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => {
                    const name = item.name || item.contact_name || '-';
                    const email = item.email || item.contact_email;
                    const phone = item.phone || item.contact_phone;
                    const linkedin = item.linkedin_url || item.contact_linkedin_url;
                    const company = item.company || item.contact_company;
                    const position = item.position || item.contact_position;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        {/* Contato */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{name}</div>
                            {position && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <Briefcase className="w-3 h-3" />
                                {position}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Empresa */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {company ? (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              {company}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {email ? (
                            <a href={`mailto:${email}`} className="text-sm text-gray-600 hover:text-purple-600">
                              {email}
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>

                        {/* Telefone */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {phone ? (
                            <span className="text-sm text-gray-600">{phone}</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>

                        {/* Canais */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Linkedin
                              className={`w-5 h-5 ${linkedin ? 'text-blue-600' : 'text-gray-300'}`}
                              title={linkedin ? t('lists.linkedinAvailable') : t('lists.linkedinNotAvailable')}
                            />
                            <Mail
                              className={`w-5 h-5 ${email ? 'text-green-600' : 'text-gray-300'}`}
                              title={email ? t('lists.emailAvailable') : t('lists.emailNotAvailable')}
                            />
                            <Phone
                              className={`w-5 h-5 ${phone ? 'text-purple-600' : 'text-gray-300'}`}
                              title={phone ? t('lists.phoneAvailable') : t('lists.phoneNotAvailable')}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {searchTerm ? t('lists.showing', { filtered: filteredItems.length, total: items.length }) : `${items.length} ${t('lists.contacts')}`}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            {t('common:buttons.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactListItemsModal;
