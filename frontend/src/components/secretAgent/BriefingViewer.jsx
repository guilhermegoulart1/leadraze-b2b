import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileText, Building2, Users, Link2, TrendingUp,
  Newspaper, Lightbulb, Clock, Fingerprint, Download, Search,
  Loader2, ExternalLink, Tag, Trash2, AlertTriangle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '../../services/api';
import ClassificationStamp from './ClassificationStamp';

/**
 * Delete Confirmation Modal
 */
const DeleteConfirmModal = ({ briefing, onConfirm, onCancel, loading }) => {
  const { t } = useTranslation('secretAgent');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#12121c] border border-red-900/50 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">
              {t('briefing.deleteConfirmTitle', { defaultValue: 'Excluir Dossiê' })}
            </h3>
            <p className="text-sm text-gray-400">{briefing.case_number}</p>
          </div>
        </div>

        <p className="text-gray-300 mb-6">
          {t('briefing.deleteConfirmMessage', {
            defaultValue: 'Tem certeza que deseja excluir permanentemente este dossiê? Esta ação não pode ser desfeita.',
            target: briefing.target_name
          })}
        </p>

        <div className="bg-gray-800/50 rounded-lg p-3 mb-6">
          <p className="text-sm text-gray-400">
            <span className="font-semibold text-gray-300">{briefing.target_name}</span>
            <br />
            {briefing.total_findings || 0} {t('briefing.totalFindings', { defaultValue: 'descobertas' })} •{' '}
            {briefing.sources_consulted || 0} {t('briefing.sourcesConsulted', { defaultValue: 'fontes' })}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm font-medium"
          >
            {t('modal.cancel', { defaultValue: 'Cancelar' })}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {t('briefing.deleteButton', { defaultValue: 'Excluir' })}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Briefing Viewer Component - View completed intelligence briefings
 * FBI-style dossier document view
 */
const BriefingViewer = ({ briefingId, onBack, onDeleted }) => {
  const { t } = useTranslation('secretAgent');
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('summary');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadBriefing();
  }, [briefingId]);

  const loadBriefing = async () => {
    try {
      setLoading(true);
      const response = await api.secretAgent.getBriefing(briefingId);
      if (response.success) {
        setBriefing(response.data);
      }
    } catch (error) {
      console.error('Error loading briefing:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Export briefing to PDF
   */
  const exportToPDF = async () => {
    if (!briefing) return;

    setExporting(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = 20;

      // Helper function to add text with word wrap
      const addWrappedText = (text, x, y, maxWidth, fontSize = 10, color = [51, 51, 51]) => {
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return y + (lines.length * fontSize * 0.4);
      };

      // Header - Classification stamp
      doc.setFillColor(139, 0, 0); // Dark red
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const classText = briefing.classification || 'CONFIDENTIAL';
      const classWidth = doc.getTextWidth(classText) + 10;
      doc.rect(pageWidth - margin - classWidth, yPos - 5, classWidth, 10, 'F');
      doc.text(classText, pageWidth - margin - classWidth + 5, yPos + 2);

      // Title
      doc.setTextColor(75, 0, 130); // Purple
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('DOSSIÊ DE INTELIGÊNCIA', margin, yPos);
      yPos += 12;

      // Case number
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`Case: ${briefing.case_number}`, margin, yPos);
      yPos += 15;

      // Target info box
      doc.setFillColor(245, 245, 220); // Beige
      doc.rect(margin, yPos, pageWidth - 2 * margin, 35, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 35, 'S');

      yPos += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('ALVO', margin + 5, yPos);
      yPos += 6;
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(briefing.target_name || 'N/A', margin + 5, yPos);
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const typeText = t(`types.${briefing.research_type}`, { defaultValue: briefing.research_type });
      doc.text(`Tipo: ${typeText}`, margin + 5, yPos);

      yPos += 18;

      // Stats row
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const statsY = yPos;
      doc.text(`Fontes: ${briefing.sources_consulted || 0}`, margin, statsY);
      doc.text(`Descobertas: ${briefing.total_findings || 0}`, margin + 50, statsY);

      const formatDuration = (seconds) => {
        if (!seconds) return '--';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
      };
      doc.text(`Duração: ${formatDuration(briefing.duration_seconds)}`, margin + 110, statsY);
      yPos += 12;

      // Horizontal line
      doc.setDrawColor(150, 150, 150);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // Executive Summary
      doc.setFontSize(14);
      doc.setTextColor(75, 0, 130);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO EXECUTIVO', margin, yPos);
      yPos += 8;

      if (briefing.executive_summary) {
        yPos = addWrappedText(briefing.executive_summary, margin, yPos, pageWidth - 2 * margin, 10, [51, 51, 51]);
      } else {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'italic');
        doc.text('Nenhum resumo executivo disponível', margin, yPos);
        yPos += 6;
      }

      yPos += 8;

      // Key Findings
      if (briefing.key_findings && briefing.key_findings.length > 0) {
        // Check if we need a new page
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(75, 0, 130);
        doc.setFont('helvetica', 'bold');
        doc.text('PRINCIPAIS DESCOBERTAS', margin, yPos);
        yPos += 10;

        briefing.key_findings.forEach((finding, i) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }

          const displayText = typeof finding === 'string'
            ? finding
            : (finding?.text || finding?.summary || finding?.title || JSON.stringify(finding));

          doc.setFontSize(10);
          doc.setTextColor(75, 0, 130);
          doc.setFont('helvetica', 'bold');
          doc.text(`${i + 1}.`, margin, yPos);

          doc.setTextColor(51, 51, 51);
          doc.setFont('helvetica', 'normal');
          yPos = addWrappedText(displayText, margin + 8, yPos, pageWidth - 2 * margin - 10, 10, [51, 51, 51]);
          yPos += 4;
        });
      }

      // Suggested Campaigns
      if (briefing.suggested_campaigns && briefing.suggested_campaigns.length > 0) {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        yPos += 6;
        doc.setFontSize(14);
        doc.setTextColor(75, 0, 130);
        doc.setFont('helvetica', 'bold');
        doc.text('CAMPANHAS SUGERIDAS', margin, yPos);
        yPos += 10;

        briefing.suggested_campaigns.forEach((campaign, i) => {
          if (yPos > 260) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(11);
          doc.setTextColor(51, 51, 51);
          doc.setFont('helvetica', 'bold');
          doc.text(campaign.title || `Campanha ${i + 1}`, margin, yPos);
          yPos += 6;

          if (campaign.description) {
            yPos = addWrappedText(campaign.description, margin, yPos, pageWidth - 2 * margin, 10, [100, 100, 100]);
          }
          yPos += 6;
        });
      }

      // Footer on last page
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const footerY = doc.internal.pageSize.getHeight() - 10;
        doc.text(
          `Gerado por GetRaze Intelligence • ${new Date(briefing.created_at).toLocaleDateString()} • Página ${i} de ${pageCount}`,
          pageWidth / 2,
          footerY,
          { align: 'center' }
        );
      }

      // Save the PDF
      const fileName = `dossie-${briefing.case_number}-${briefing.target_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  /**
   * Delete briefing
   */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await api.secretAgent.deleteBriefing(briefingId);
      if (response.success) {
        setShowDeleteModal(false);
        if (onDeleted) {
          onDeleted(briefingId);
        } else {
          onBack();
        }
      }
    } catch (error) {
      console.error('Error deleting briefing:', error);
    } finally {
      setDeleting(false);
    }
  };

  const sections = [
    { id: 'summary', icon: FileText, label: t('briefing.executiveSummary') },
    { id: 'company', icon: Building2, label: t('briefing.companyData') },
    { id: 'people', icon: Users, label: t('briefing.peopleData') },
    { id: 'connections', icon: Link2, label: t('briefing.connectionsData') },
    { id: 'market', icon: TrendingUp, label: t('briefing.marketData') },
    { id: 'media', icon: Newspaper, label: t('briefing.mediaData') },
    { id: 'campaigns', icon: Lightbulb, label: t('briefing.suggestedCampaigns') }
  ];

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center text-gray-500">
        Briefing not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c14] text-gray-200">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          briefing={briefing}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}

      {/* Paper texture overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-5 z-40"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)'
        }}
      />

      <div className="max-w-5xl mx-auto px-6 py-8 relative">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-purple-400">{briefing.case_number}</span>
              <ClassificationStamp classification={briefing.classification} size="sm" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportToPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {t('briefing.download', { defaultValue: 'Exportar PDF' })}
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              {t('briefing.delete', { defaultValue: 'Excluir' })}
            </button>
          </div>
        </div>

        {/* Document Header - Dark Mode */}
        <div className="bg-[#12121c] rounded-t-xl p-8 relative overflow-hidden border border-gray-800">
          {/* Subtle background effect */}
          <div className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)'
            }}
          />

          {/* Stamp */}
          <div className="absolute top-4 right-4 transform rotate-12 z-10">
            <ClassificationStamp classification={briefing.classification} size="lg" />
          </div>

          <div className="flex items-start gap-6 relative z-10">
            <div className="w-16 h-16 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
              <FileText className="w-8 h-8 text-purple-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-purple-400 uppercase tracking-wider font-semibold mb-1">
                {t('briefing.title')}
              </p>
              <h1 className="text-2xl font-bold text-gray-100 mb-2">
                {briefing.target_name}
              </h1>
              <p className="text-sm text-gray-400">
                {t(`types.${briefing.research_type}`)} • {briefing.title}
              </p>

              {/* Tags */}
              {briefing.tags && briefing.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {briefing.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-800 text-gray-300 border border-gray-700 text-xs rounded">
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-700 relative z-10">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                {t('briefing.sourcesConsulted')}
              </p>
              <p className="text-xl font-bold text-gray-100 flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-purple-400" />
                {briefing.sources_consulted || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                {t('briefing.totalFindings')}
              </p>
              <p className="text-xl font-bold text-gray-100 flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-400" />
                {briefing.total_findings || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                {t('briefing.duration')}
              </p>
              <p className="text-xl font-bold text-gray-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                {formatDuration(briefing.duration_seconds)}
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-[#12121c] border border-gray-800 rounded-b-xl">
          {/* Section Tabs */}
          <div className="flex overflow-x-auto border-b border-gray-800 px-4">
            {sections.map(section => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors
                    ${isActive
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'}
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>

          {/* Section Content */}
          <div className="p-6">
            {/* Executive Summary */}
            {activeSection === 'summary' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-3">
                    {t('briefing.executiveSummary')}
                  </h3>
                  <div className="prose prose-invert max-w-none">
                    {briefing.executive_summary ? (
                      <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {briefing.executive_summary}
                      </p>
                    ) : (
                      <p className="text-gray-500 italic">No executive summary available</p>
                    )}
                  </div>
                </div>

                {/* Key Findings */}
                {briefing.key_findings && briefing.key_findings.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-200 mb-3">
                      {t('briefing.keyFindings')}
                    </h3>
                    <ul className="space-y-2">
                      {briefing.key_findings.map((finding, i) => {
                        // Handle both string and object findings
                        const displayText = typeof finding === 'string'
                          ? finding
                          : (finding?.text || finding?.summary || finding?.title || JSON.stringify(finding));

                        return (
                          <li key={i} className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
                            <span className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0 text-xs text-purple-400 font-bold">
                              {i + 1}
                            </span>
                            <span className="text-gray-300">{displayText}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Company Data */}
            {activeSection === 'company' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-3">
                  {t('briefing.companyData')}
                </h3>
                {briefing.company_data && Object.keys(briefing.company_data).length > 0 ? (
                  <pre className="text-sm text-gray-300 bg-gray-800/30 p-4 rounded-lg overflow-auto">
                    {JSON.stringify(briefing.company_data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-500 italic">No company data collected</p>
                )}
              </div>
            )}

            {/* People Data */}
            {activeSection === 'people' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-3">
                  {t('briefing.peopleData')}
                </h3>
                {briefing.people_data && Object.keys(briefing.people_data).length > 0 ? (
                  <pre className="text-sm text-gray-300 bg-gray-800/30 p-4 rounded-lg overflow-auto">
                    {JSON.stringify(briefing.people_data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-500 italic">No people data collected</p>
                )}
              </div>
            )}

            {/* Connections Data */}
            {activeSection === 'connections' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-3">
                  {t('briefing.connectionsData')}
                </h3>
                {briefing.connections_data && Object.keys(briefing.connections_data).length > 0 ? (
                  <pre className="text-sm text-gray-300 bg-gray-800/30 p-4 rounded-lg overflow-auto">
                    {JSON.stringify(briefing.connections_data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-500 italic">No connections data collected</p>
                )}
              </div>
            )}

            {/* Market Data */}
            {activeSection === 'market' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-3">
                  {t('briefing.marketData')}
                </h3>
                {briefing.market_data && Object.keys(briefing.market_data).length > 0 ? (
                  <pre className="text-sm text-gray-300 bg-gray-800/30 p-4 rounded-lg overflow-auto">
                    {JSON.stringify(briefing.market_data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-500 italic">No market data collected</p>
                )}
              </div>
            )}

            {/* Media Data */}
            {activeSection === 'media' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-3">
                  {t('briefing.mediaData')}
                </h3>
                {briefing.media_data && Object.keys(briefing.media_data).length > 0 ? (
                  <pre className="text-sm text-gray-300 bg-gray-800/30 p-4 rounded-lg overflow-auto">
                    {JSON.stringify(briefing.media_data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-500 italic">No media data collected</p>
                )}
              </div>
            )}

            {/* Suggested Campaigns */}
            {activeSection === 'campaigns' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-3">
                  {t('briefing.suggestedCampaigns')}
                </h3>
                {briefing.suggested_campaigns && briefing.suggested_campaigns.length > 0 ? (
                  <div className="grid gap-4">
                    {briefing.suggested_campaigns.map((campaign, i) => (
                      <div key={i} className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                        <h4 className="font-semibold text-gray-200 mb-2">{campaign.title || `Campaign ${i + 1}`}</h4>
                        <p className="text-sm text-gray-400">{campaign.description || JSON.stringify(campaign)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No campaign suggestions generated yet</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>
            {t('briefing.createdAt')}: {new Date(briefing.created_at).toLocaleString()}
          </p>
          <p className="mt-1">
            {briefing.created_by_name && `By ${briefing.created_by_name}`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BriefingViewer;
