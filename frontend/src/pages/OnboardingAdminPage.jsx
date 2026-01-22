import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList, Filter, Eye, CheckCircle, Loader2, X,
  Building2, Users, MessageSquare, Phone, Mail, Calendar,
  Globe, Briefcase, Target, Clock
} from 'lucide-react';
import api from '../services/api';

const OnboardingAdminPage = () => {
  const { t } = useTranslation('onboarding');

  const [onboardings, setOnboardings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOnboarding, setSelectedOnboarding] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1
  });

  useEffect(() => {
    loadOnboardings();
  }, [statusFilter, pagination.page]);

  const loadOnboardings = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit };
      if (statusFilter) params.status = statusFilter;

      const response = await api.getOnboardingsAdmin(params);
      if (response.success) {
        setOnboardings(response.data.onboardings);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination
        }));
      }
    } catch (error) {
      console.error('Error loading onboardings:', error);
      alert(t('errors.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const viewOnboarding = async (id) => {
    try {
      const response = await api.getOnboardingById(id);
      if (response.success) {
        setSelectedOnboarding(response.data.onboarding);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error loading onboarding details:', error);
    }
  };

  const markAsReviewed = async (id) => {
    try {
      setMarkingReviewed(true);
      const response = await api.markOnboardingReviewed(id);
      if (response.success) {
        loadOnboardings();
        if (selectedOnboarding?.id === id) {
          setSelectedOnboarding(prev => ({ ...prev, status: 'reviewed' }));
        }
      }
    } catch (error) {
      console.error('Error marking as reviewed:', error);
      alert(t('errors.saveFailed'));
    } finally {
      setMarkingReviewed(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      reviewed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {t(`admin.status.${status}`)}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-purple-600" />
          {t('admin.title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('admin.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <div className="flex gap-2">
            {['', 'pending', 'completed', 'reviewed'].map(status => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${statusFilter === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                {status === '' ? t('admin.filters.all') : t(`admin.filters.${status}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : onboardings.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {t('admin.empty')}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.table.company')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.table.contact')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.table.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.table.createdAt')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {onboardings.map(onboarding => (
                <tr key={onboarding.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {onboarding.company_name || onboarding.account_name || '-'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {onboarding.industry || '-'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-gray-900 dark:text-white">
                        {onboarding.contact_name || onboarding.user_name || '-'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {onboarding.contact_email || onboarding.user_email || '-'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(onboarding.status)}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {formatDate(onboarding.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => viewOnboarding(onboarding.id)}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                        title={t('admin.actions.view')}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {onboarding.status === 'completed' && (
                        <button
                          onClick={() => markAsReviewed(onboarding.id)}
                          disabled={markingReviewed}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                          title={t('admin.actions.markReviewed')}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('admin.pagination', { current: pagination.page, total: pagination.pages })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                &lt;
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedOnboarding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('admin.modal.title')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedOnboarding.company_name || selectedOnboarding.account_name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedOnboarding.status)}
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1: Company */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-purple-600" />
                  {t('admin.modal.section1')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.companyName')}</p>
                    <p className="text-gray-900 dark:text-white">{selectedOnboarding.company_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.website')}</p>
                    <p className="text-gray-900 dark:text-white">
                      {selectedOnboarding.website ? (
                        <a href={selectedOnboarding.website} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                          {selectedOnboarding.website}
                        </a>
                      ) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.industry')}</p>
                    <p className="text-gray-900 dark:text-white">{selectedOnboarding.industry || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.description')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.description || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.productsServices')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.products_services || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.differentials')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.differentials || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.successCases')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.success_cases || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Customers */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-purple-600" />
                  {t('admin.modal.section2')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.idealCustomer')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.ideal_customer || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.targetRoles')}</p>
                    <p className="text-gray-900 dark:text-white">{selectedOnboarding.target_roles || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.targetLocation')}</p>
                    <p className="text-gray-900 dark:text-white">{selectedOnboarding.target_location || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.targetIndustries')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.target_industries || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.buyingSignals')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.buying_signals || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.mainProblem')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.main_problem || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Section 3: Support */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                  {t('admin.modal.section3')}
                </h3>
                <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.faq')}</p>
                    <div className="text-gray-900 dark:text-white">
                      {Array.isArray(selectedOnboarding.faq) && selectedOnboarding.faq.length > 0 ? (
                        <div className="space-y-2">
                          {selectedOnboarding.faq.map((item, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-3">
                              <p className="font-medium text-purple-600">P: {item.question}</p>
                              <p className="text-gray-600 dark:text-gray-300 mt-1">R: {item.answer}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>-</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.objections')}</p>
                    <div className="text-gray-900 dark:text-white">
                      {Array.isArray(selectedOnboarding.objections) && selectedOnboarding.objections.length > 0 ? (
                        <div className="space-y-2">
                          {selectedOnboarding.objections.map((item, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-3">
                              <p className="font-medium text-red-600">Objeção: {item.objection}</p>
                              <p className="text-gray-600 dark:text-gray-300 mt-1">Resposta: {item.response}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>-</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.policies')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.policies || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.businessHours')}</p>
                    <p className="text-gray-900 dark:text-white">{selectedOnboarding.business_hours || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.escalationTriggers')}</p>
                    <p className="text-gray-900 dark:text-white">
                      {Array.isArray(selectedOnboarding.escalation_triggers) && selectedOnboarding.escalation_triggers.length > 0
                        ? selectedOnboarding.escalation_triggers.join(', ')
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 4: Final */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-purple-600" />
                  {t('admin.modal.section4')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.goals')}</p>
                    <p className="text-gray-900 dark:text-white">
                      {Array.isArray(selectedOnboarding.goals) && selectedOnboarding.goals.length > 0
                        ? selectedOnboarding.goals.join(', ')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.leadTarget')}</p>
                    <p className="text-gray-900 dark:text-white">{selectedOnboarding.lead_target || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.meetingTarget')}</p>
                    <p className="text-gray-900 dark:text-white">{selectedOnboarding.meeting_target || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.calendarLink')}</p>
                    <p className="text-gray-900 dark:text-white">
                      {selectedOnboarding.calendar_link ? (
                        <a href={selectedOnboarding.calendar_link} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                          {selectedOnboarding.calendar_link}
                        </a>
                      ) : '-'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.materialsLinks')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.materials_links || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.blacklist')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.blacklist || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.additionalNotes')}</p>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedOnboarding.additional_notes || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Phone className="w-5 h-5 text-purple-600" />
                  {t('admin.modal.contact')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.contactName')}</p>
                    <p className="text-gray-900 dark:text-white">{selectedOnboarding.contact_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.contactRole')}</p>
                    <p className="text-gray-900 dark:text-white">{selectedOnboarding.contact_role || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.contactEmail')}</p>
                    <p className="text-gray-900 dark:text-white">
                      {selectedOnboarding.contact_email ? (
                        <a href={`mailto:${selectedOnboarding.contact_email}`} className="text-purple-600 hover:underline">
                          {selectedOnboarding.contact_email}
                        </a>
                      ) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('fields.contactPhone')}</p>
                    <p className="text-gray-900 dark:text-white">
                      {selectedOnboarding.contact_phone ? (
                        <a href={`https://wa.me/${selectedOnboarding.contact_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                          {selectedOnboarding.contact_phone}
                        </a>
                      ) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>Criado: {formatDate(selectedOnboarding.created_at)}</p>
                {selectedOnboarding.completed_at && <p>Completado: {formatDate(selectedOnboarding.completed_at)}</p>}
                {selectedOnboarding.reviewed_at && <p>Revisado: {formatDate(selectedOnboarding.reviewed_at)} por {selectedOnboarding.reviewer_name}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Fechar
                </button>
                {selectedOnboarding.status === 'completed' && (
                  <button
                    onClick={() => markAsReviewed(selectedOnboarding.id)}
                    disabled={markingReviewed}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {markingReviewed ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {t('admin.actions.markReviewed')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingAdminPage;
