import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList, Filter, Eye, CheckCircle, Loader2, X,
  Building2, Users, MessageSquare, Phone, Mail, Calendar,
  Globe, Briefcase, Target, Clock, Download, FileText,
  ListChecks, ChevronDown, ChevronRight, CheckCircle2, Circle,
  Rocket, Settings, FlaskConical, Wrench, Zap
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '../services/api';

const STAGE_ICONS = {
  kickoff: Rocket,
  configuracao: Settings,
  testes: FlaskConical,
  revisao: Users,
  ajustes: Wrench,
  golive: Zap
};

const OnboardingAdminPage = () => {
  const { t, i18n } = useTranslation('onboarding');
  const lang = i18n.language?.startsWith('pt') ? 'pt' : i18n.language?.startsWith('es') ? 'es' : 'en';

  const [onboardings, setOnboardings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOnboarding, setSelectedOnboarding] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [exporting, setExporting] = useState({ pdf: false, csv: false });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1
  });

  // Checklist tab state
  const [modalTab, setModalTab] = useState('responses');
  const [checklistData, setChecklistData] = useState(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [expandedStages, setExpandedStages] = useState({});
  const [togglingTask, setTogglingTask] = useState(null);

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
        setModalTab('responses');
        setChecklistData(null);
        setExpandedStages({});
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error loading onboarding details:', error);
    }
  };

  const loadChecklist = async (onboardingId) => {
    try {
      setChecklistLoading(true);
      const response = await api.getAdminChecklist(onboardingId);
      if (response.success) {
        setChecklistData(response.data);
      }
    } catch (error) {
      console.error('Error loading checklist:', error);
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setModalTab(tab);
    if (tab === 'checklist' && !checklistData && selectedOnboarding) {
      loadChecklist(selectedOnboarding.id);
    }
  };

  const toggleChecklistTask = async (taskKey) => {
    if (!selectedOnboarding || togglingTask) return;
    try {
      setTogglingTask(taskKey);
      const response = await api.toggleChecklistTask(selectedOnboarding.id, taskKey);
      if (response.success) {
        // Optimistic update
        setChecklistData(prev => {
          if (!prev) return prev;
          const newStages = prev.stages.map(stage => ({
            ...stage,
            tasks: stage.tasks.map(task => {
              if (task.key === taskKey) {
                const nowCompleted = response.data.action === 'completed';
                return {
                  ...task,
                  completed: nowCompleted,
                  completed_at: nowCompleted ? new Date().toISOString() : null,
                  completed_by_name: nowCompleted ? 'You' : null
                };
              }
              return task;
            }),
            completedTasks: stage.tasks.reduce((acc, task) => {
              if (task.key === taskKey) {
                return acc + (response.data.action === 'completed' ? 1 : 0);
              }
              return acc + (task.completed ? 1 : 0);
            }, 0),
            percentage: Math.round(
              (stage.tasks.reduce((acc, task) => {
                if (task.key === taskKey) {
                  return acc + (response.data.action === 'completed' ? 1 : 0);
                }
                return acc + (task.completed ? 1 : 0);
              }, 0) / stage.totalTasks) * 100
            )
          }));
          return {
            ...prev,
            stages: newStages,
            completedTasks: response.data.completedTasks,
            percentage: response.data.percentage,
            checklistComplete: response.data.checklistComplete
          };
        });
      }
    } catch (error) {
      console.error('Error toggling task:', error);
    } finally {
      setTogglingTask(null);
    }
  };

  const toggleStageExpand = (stageKey) => {
    setExpandedStages(prev => ({ ...prev, [stageKey]: !prev[stageKey] }));
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

  const exportToCSV = async (id) => {
    try {
      setExporting(prev => ({ ...prev, csv: true }));
      await api.exportOnboardingCSV(id);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert(t('admin.exportError', 'Erro ao exportar CSV'));
    } finally {
      setExporting(prev => ({ ...prev, csv: false }));
    }
  };

  const exportToPDF = () => {
    if (!selectedOnboarding) return;

    setExporting(prev => ({ ...prev, pdf: true }));

    try {
      const o = selectedOnboarding;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;

      const addWrappedText = (text, x, y, maxWidth, fontSize = 10) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text || '-', maxWidth);
        doc.text(lines, x, y);
        return y + (lines.length * fontSize * 0.4) + 2;
      };

      const checkNewPage = (requiredSpace = 30) => {
        if (yPos > 270 - requiredSpace) {
          doc.addPage();
          yPos = 20;
        }
      };

      const addSection = (title) => {
        checkNewPage(40);
        doc.setFillColor(147, 51, 234);
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin + 3, yPos);
        yPos += 10;
        doc.setTextColor(51, 51, 51);
        doc.setFont('helvetica', 'normal');
      };

      const addField = (label, value, fullWidth = false) => {
        checkNewPage();
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(label, margin, yPos);
        yPos += 4;
        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        yPos = addWrappedText(value || '-', margin, yPos, fullWidth ? pageWidth - 2 * margin : (pageWidth - 2 * margin) / 2 - 5);
        yPos += 3;
      };

      // Header
      doc.setFillColor(147, 51, 234);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Onboarding Report', margin, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(o.company_name || o.account_name || 'N/A', margin, 26);
      yPos = 40;

      // Status badge
      const statusColors = {
        pending: [234, 179, 8],
        completed: [59, 130, 246],
        reviewed: [34, 197, 94]
      };
      const statusColor = statusColors[o.status] || [128, 128, 128];
      doc.setFillColor(...statusColor);
      doc.roundedRect(pageWidth - margin - 25, 35, 25, 7, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(t(`admin.status.${o.status}`), pageWidth - margin - 23, 40);
      doc.setTextColor(51, 51, 51);

      // Section 1: Company Data
      addSection(t('admin.modal.section1'));
      addField(t('fields.companyName'), o.company_name);
      addField(t('fields.website'), o.website);
      addField(t('fields.industry'), o.industry);
      addField(t('fields.description'), o.description, true);
      addField(t('fields.productsServices'), o.products_services, true);
      addField(t('fields.differentials'), o.differentials, true);
      addField(t('fields.successCases'), o.success_cases, true);

      // Section 2: Customer Data
      addSection(t('admin.modal.section2'));
      addField(t('fields.idealCustomer'), o.ideal_customer, true);
      addField(t('fields.targetRoles'), o.target_roles);
      addField(t('fields.targetLocation'), o.target_location);
      addField(t('fields.targetIndustries'), o.target_industries, true);
      addField(t('fields.buyingSignals'), o.buying_signals, true);
      addField(t('fields.mainProblem'), o.main_problem, true);

      // Section 3: Support
      addSection(t('admin.modal.section3'));

      // FAQ
      if (Array.isArray(o.faq) && o.faq.length > 0) {
        checkNewPage();
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(t('fields.faq'), margin, yPos);
        yPos += 4;
        o.faq.forEach((item, idx) => {
          checkNewPage();
          doc.setFontSize(9);
          doc.setTextColor(147, 51, 234);
          yPos = addWrappedText(`Q${idx + 1}: ${item.question}`, margin + 2, yPos, pageWidth - 2 * margin - 4, 9);
          doc.setTextColor(51, 51, 51);
          yPos = addWrappedText(`A: ${item.answer}`, margin + 2, yPos, pageWidth - 2 * margin - 4, 9);
          yPos += 2;
        });
      }

      // Objections
      if (Array.isArray(o.objections) && o.objections.length > 0) {
        checkNewPage();
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(t('fields.objections'), margin, yPos);
        yPos += 4;
        o.objections.forEach((item, idx) => {
          checkNewPage();
          doc.setFontSize(9);
          doc.setTextColor(220, 38, 38);
          yPos = addWrappedText(`O${idx + 1}: ${item.objection}`, margin + 2, yPos, pageWidth - 2 * margin - 4, 9);
          doc.setTextColor(51, 51, 51);
          yPos = addWrappedText(`R: ${item.response}`, margin + 2, yPos, pageWidth - 2 * margin - 4, 9);
          yPos += 2;
        });
      }

      addField(t('fields.policies'), o.policies, true);
      addField(t('fields.businessHours'), o.business_hours);
      addField(t('fields.escalationTriggers'), Array.isArray(o.escalation_triggers) ? o.escalation_triggers.join(', ') : o.escalation_triggers, true);

      // Section 4: Final Setup
      addSection(t('admin.modal.section4'));
      addField(t('fields.goals'), Array.isArray(o.goals) ? o.goals.join(', ') : o.goals);
      addField(t('fields.leadTarget'), o.lead_target);
      addField(t('fields.meetingTarget'), o.meeting_target);
      addField(t('fields.calendarLink'), o.calendar_link);
      addField(t('fields.materialsLinks'), o.materials_links, true);
      addField(t('fields.blacklist'), o.blacklist, true);
      addField(t('fields.additionalNotes'), o.additional_notes, true);

      // Section 5: Contact
      addSection(t('admin.modal.contact'));
      addField(t('fields.contactName'), o.contact_name);
      addField(t('fields.contactRole'), o.contact_role);
      addField(t('fields.contactEmail'), o.contact_email);
      addField(t('fields.contactPhone'), o.contact_phone);

      // Footer on all pages
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const footerY = doc.internal.pageSize.getHeight() - 10;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `GetRaze Onboarding Report | Generated: ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          footerY,
          { align: 'center' }
        );
      }

      // Save
      const filename = `onboarding_${(o.company_name || o.account_name || 'report').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert(t('admin.exportError', 'Erro ao gerar PDF'));
    } finally {
      setExporting(prev => ({ ...prev, pdf: false }));
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
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
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
              {/* Tabs */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleTabChange('responses')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    modalTab === 'responses'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  {t('admin.tabs.responses')}
                </button>
                <button
                  onClick={() => handleTabChange('checklist')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    modalTab === 'checklist'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  <ListChecks className="w-4 h-4" />
                  {t('admin.tabs.checklist')}
                  {checklistData && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                      checklistData.checklistComplete
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {checklistData.percentage}%
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* CHECKLIST TAB */}
            {modalTab === 'checklist' && (
              checklistLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : checklistData ? (
                <div className="space-y-4">
                  {/* Overall Progress */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('checklist.overallProgress')}
                      </span>
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {checklistData.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${checklistData.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {checklistData.completedTasks}/{checklistData.totalTasks} {t('checklist.tasksCompleted')}
                    </p>
                  </div>

                  {/* Stages */}
                  {checklistData.stages.map(stage => {
                    const StageIcon = STAGE_ICONS[stage.key] || Circle;
                    const isExpanded = expandedStages[stage.key] !== false; // default expanded
                    const isComplete = stage.completedTasks === stage.totalTasks;
                    const hasProgress = stage.completedTasks > 0;

                    return (
                      <div key={stage.key} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleStageExpand(stage.key)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isComplete
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : hasProgress
                                ? 'bg-purple-100 dark:bg-purple-900/30'
                                : 'bg-gray-100 dark:bg-gray-700'
                          }`}>
                            <StageIcon className={`w-4 h-4 ${
                              isComplete
                                ? 'text-green-600 dark:text-green-400'
                                : hasProgress
                                  ? 'text-purple-600 dark:text-purple-400'
                                  : 'text-gray-400'
                            }`} />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-400">
                                {t('checklist.stage')} {stage.stage}
                              </span>
                              {isComplete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {stage[`title_${lang}`]}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {stage.completedTasks}/{stage.totalTasks}
                            </span>
                            <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-purple-500'}`}
                                style={{ width: `${stage.percentage}%` }}
                              />
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/50">
                            {stage.tasks.map(task => (
                              <div
                                key={task.key}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                              >
                                <button
                                  onClick={() => toggleChecklistTask(task.key)}
                                  disabled={togglingTask === task.key}
                                  className="flex-shrink-0 disabled:opacity-50"
                                >
                                  {togglingTask === task.key ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                                  ) : task.completed ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500 hover:text-green-600 cursor-pointer" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-purple-400 cursor-pointer" />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm ${
                                    task.completed
                                      ? 'text-gray-400 dark:text-gray-500'
                                      : 'text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {task[`title_${lang}`]}
                                  </span>
                                </div>
                                {task.completed && task.completed_at && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                    {formatDate(task.completed_at)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null
            )}

            {/* RESPONSES TAB */}
            {modalTab === 'responses' && (
              <>
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
            </>
            )}

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
                  onClick={() => exportToCSV(selectedOnboarding.id)}
                  disabled={exporting.csv}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 disabled:opacity-50"
                  title={t('admin.exportCSV', 'Exportar CSV')}
                >
                  {exporting.csv ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  CSV
                </button>
                <button
                  onClick={exportToPDF}
                  disabled={exporting.pdf}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 disabled:opacity-50"
                  title={t('admin.exportPDF', 'Exportar PDF')}
                >
                  {exporting.pdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  PDF
                </button>
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
