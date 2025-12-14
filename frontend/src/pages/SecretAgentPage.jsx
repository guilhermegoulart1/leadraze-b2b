import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye, Plus, Search, FileText, Lock, Fingerprint,
  Building2, User, TrendingUp, Link2, ChevronRight,
  Clock, AlertTriangle, CheckCircle2, Loader2
} from 'lucide-react';
import api from '../services/api';
import InvestigationRoom from '../components/secretAgent/InvestigationRoom';
import BriefingViewer from '../components/secretAgent/BriefingViewer';
import StartInvestigationModal from '../components/secretAgent/StartInvestigationModal';
import ClassificationStamp from '../components/secretAgent/ClassificationStamp';

const SecretAgentPage = () => {
  const { t } = useTranslation(['secretAgent', 'common']);
  const [loading, setLoading] = useState(true);
  const [investigations, setInvestigations] = useState([]);
  const [briefings, setBriefings] = useState([]);
  const [selectedInvestigation, setSelectedInvestigation] = useState(null);
  const [selectedBriefing, setSelectedBriefing] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [investigationsRes, briefingsRes] = await Promise.all([
        api.secretAgent.getInvestigations(),
        api.secretAgent.getBriefings()
      ]);

      if (investigationsRes.success) {
        setInvestigations(investigationsRes.data || []);
      }
      if (briefingsRes.success) {
        setBriefings(briefingsRes.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInvestigation = async (data) => {
    try {
      // First create a session
      const sessionRes = await api.secretAgent.createSession();
      if (!sessionRes.success) throw new Error('Failed to create session');

      // Then start the investigation
      const investigationRes = await api.secretAgent.startInvestigation(sessionRes.data.id, data);
      if (investigationRes.success) {
        await loadData();
        setShowStartModal(false);
        setSelectedInvestigation(investigationRes.data.investigation);
      }
    } catch (error) {
      console.error('Error starting investigation:', error);
      throw error;
    }
  };

  const activeInvestigations = investigations.filter(i => i.status === 'running' || i.status === 'queued');
  const filteredBriefings = briefings.filter(b =>
    !searchQuery ||
    b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.target_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.case_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'running': return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
      case 'queued': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'company': return <Building2 className="w-4 h-4" />;
      case 'person': return <User className="w-4 h-4" />;
      case 'niche': return <TrendingUp className="w-4 h-4" />;
      case 'connection': return <Link2 className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  if (selectedInvestigation) {
    return (
      <InvestigationRoom
        investigation={selectedInvestigation}
        onBack={() => {
          setSelectedInvestigation(null);
          loadData();
        }}
      />
    );
  }

  if (selectedBriefing) {
    return (
      <BriefingViewer
        briefingId={selectedBriefing.id}
        onBack={() => {
          setSelectedBriefing(null);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c14] text-gray-200">
      {/* Scan lines effect overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-5 z-50"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)'
        }}
      />

      <div className="max-w-7xl mx-auto px-6 py-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-lg shadow-amber-900/50">
              <Eye className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-amber-400 tracking-wide">
                {t('title')}
              </h1>
              <p className="text-sm text-gray-500">{t('subtitle')}</p>
            </div>
          </div>

          <button
            onClick={() => setShowStartModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg font-medium transition-all shadow-lg shadow-amber-900/30"
          >
            <Plus className="w-5 h-5" />
            {t('newInvestigation')}
          </button>
        </div>

        {/* Active Investigations */}
        {activeInvestigations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('activeInvestigations')} ({activeInvestigations.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeInvestigations.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => setSelectedInvestigation(inv)}
                  className="group bg-[#12121c] border border-amber-900/30 rounded-lg p-4 hover:border-amber-600/50 transition-all text-left"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-amber-600">{inv.case_number}</span>
                    {getStatusIcon(inv.status)}
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(inv.target_type)}
                    <span className="font-medium text-gray-200 truncate">{inv.target_name}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-500"
                      style={{ width: `${inv.progress || 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{inv.progress || 0}%</span>
                    <span className="flex items-center gap-1">
                      {t(`status.${inv.status}`)}
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Briefings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('previousBriefings')}
            </h2>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-[#12121c] border border-gray-800 rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:border-amber-600/50 focus:ring-1 focus:ring-amber-600/30 w-64"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : filteredBriefings.length === 0 ? (
            <div className="text-center py-12 bg-[#12121c] rounded-lg border border-gray-800">
              <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 mb-1">{t('empty.noBriefings')}</p>
              <p className="text-gray-600 text-sm">{t('empty.startFirst')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBriefings.map((briefing) => (
                <button
                  key={briefing.id}
                  onClick={() => setSelectedBriefing(briefing)}
                  className="w-full group bg-[#12121c] border border-gray-800 rounded-lg p-4 hover:border-amber-600/30 transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    {/* Classification Stamp */}
                    <div className="flex-shrink-0">
                      <ClassificationStamp
                        classification={briefing.classification}
                        size="sm"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-amber-600">{briefing.case_number}</span>
                        <span className="text-xs text-gray-600">|</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          {getTypeIcon(briefing.research_type)}
                          {t(`types.${briefing.research_type}`)}
                        </span>
                      </div>

                      <h3 className="font-medium text-gray-200 truncate mb-1">
                        {briefing.target_name}
                      </h3>

                      {briefing.executive_summary && (
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {briefing.executive_summary}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Fingerprint className="w-3 h-3" />
                          {briefing.sources_consulted || 0} {t('briefing.sourcesConsulted').toLowerCase()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Search className="w-3 h-3" />
                          {briefing.total_findings || 0} {t('briefing.totalFindings').toLowerCase()}
                        </span>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-gray-600">
                        {new Date(briefing.created_at).toLocaleDateString()}
                      </p>
                      <ChevronRight className="w-4 h-4 text-gray-600 mt-2 ml-auto group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Start Investigation Modal */}
      {showStartModal && (
        <StartInvestigationModal
          onClose={() => setShowStartModal(false)}
          onStart={handleStartInvestigation}
        />
      )}
    </div>
  );
};

export default SecretAgentPage;
