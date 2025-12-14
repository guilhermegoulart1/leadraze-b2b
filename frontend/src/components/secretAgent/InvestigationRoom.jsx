import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Eye, Clock, Target, Crosshair,
  FileText, CheckCircle2, Loader2, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import AgentCard from './AgentCard';
import ClassificationStamp from './ClassificationStamp';

// Intelligence team agents (static data)
const INTELLIGENCE_TEAM = [
  { id: 'marcus_chen', name: 'Marcus Chen', role: 'Analista de Dados' },
  { id: 'sarah_mitchell', name: 'Sarah Mitchell', role: 'Analista de Pessoas' },
  { id: 'james_rodriguez', name: 'James Rodriguez', role: 'Analista de Conexões' },
  { id: 'elena_volkov', name: 'Elena Volkov', role: 'Analista de Mercado' },
  { id: 'david_park', name: 'David Park', role: 'Analista de Mídia' },
  { id: 'director_morgan', name: 'Director Morgan', role: 'Diretor de Operações' }
];

// Agents to run per research type (must match backend orchestratorService.js)
const AGENTS_BY_RESEARCH_TYPE = {
  company: ['marcus_chen', 'sarah_mitchell', 'elena_volkov', 'david_park', 'james_rodriguez', 'director_morgan'],
  person: ['sarah_mitchell', 'james_rodriguez', 'david_park', 'elena_volkov', 'director_morgan'],
  niche: ['elena_volkov', 'david_park', 'sarah_mitchell', 'james_rodriguez', 'director_morgan'],
  connection: ['sarah_mitchell', 'james_rodriguez', 'david_park', 'elena_volkov', 'director_morgan']
};

// Get agents relevant for a research type
const getAgentsForType = (researchType) => {
  const agentIds = AGENTS_BY_RESEARCH_TYPE[researchType] || AGENTS_BY_RESEARCH_TYPE.company;
  return INTELLIGENCE_TEAM.filter(agent => agentIds.includes(agent.id));
};

/**
 * Investigation Room Component - Real-time view of ongoing investigation
 * Gaming-style interface showing agents working with live updates
 */
const InvestigationRoom = ({ investigation, onBack }) => {
  const { t } = useTranslation('secretAgent');
  const [data, setData] = useState(investigation);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState({});

  // Poll for updates every 5 seconds while investigation is running
  useEffect(() => {
    if (data.status === 'running' || data.status === 'queued') {
      const interval = setInterval(loadInvestigation, 5000);
      return () => clearInterval(interval);
    }
  }, [data.status]);

  useEffect(() => {
    loadInvestigation();
  }, []);

  const loadInvestigation = async () => {
    try {
      const response = await api.secretAgent.getInvestigation(data.id);
      if (response.success) {
        setData(response.data);

        // Convert agent_reports array to object keyed by agent_id
        if (response.data.agent_reports) {
          const reportsObj = {};
          response.data.agent_reports.forEach(r => {
            reportsObj[r.agent_id] = r;
          });
          setReports(reportsObj);
        }
      }
    } catch (error) {
      console.error('Error loading investigation:', error);
    }
  };

  // Get agents relevant for this research type
  const relevantAgents = getAgentsForType(data.target_type || data.research_type);
  const relevantAgentIds = relevantAgents.map(a => a.id);

  // Count only relevant agents for progress
  const completedAgents = Object.values(reports).filter(r =>
    r.status === 'completed' && relevantAgentIds.includes(r.agent_id)
  ).length;
  const totalAgents = relevantAgents.length;
  const overallProgress = data.progress || Math.round((completedAgents / totalAgents) * 100);

  const getElapsedTime = () => {
    if (!data.started_at) return '--:--';
    const started = new Date(data.started_at);
    const now = data.completed_at ? new Date(data.completed_at) : new Date();
    const diff = Math.floor((now - started) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0c0c14] text-gray-200">
      {/* Scan lines effect */}
      <div className="fixed inset-0 pointer-events-none opacity-5 z-50"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)'
        }}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 relative">
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
              <div className={`
                w-3 h-3 rounded-full
                ${data.status === 'running' ? 'bg-red-500 animate-pulse' : ''}
                ${data.status === 'completed' ? 'bg-green-500' : ''}
                ${data.status === 'queued' ? 'bg-purple-400' : ''}
                ${data.status === 'failed' ? 'bg-red-500' : ''}
              `} />
              <span className="text-xs font-medium text-red-400 uppercase tracking-wider">
                {t('investigation.title')}
              </span>
              <span className="text-xs font-mono text-purple-400">{data.case_number}</span>
            </div>
          </div>

          <button
            onClick={loadInvestigation}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Mission Briefing Header */}
        <div className="bg-[#12121c] border border-gray-800 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Target Info */}
            <div className="md:col-span-2">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center flex-shrink-0">
                  <Target className="w-7 h-7 text-purple-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    {t('investigation.target')}
                  </p>
                  <h2 className="text-xl font-bold text-gray-100 truncate">
                    {data.target_name}
                  </h2>
                  <p className="text-sm text-gray-400 truncate">
                    {t(`types.${data.target_type}`)} • {data.objective || 'Investigação completa'}
                  </p>
                </div>
              </div>
            </div>

            {/* Timer */}
            <div className="text-center md:text-left">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                <Clock className="w-3 h-3 inline mr-1" />
                Tempo Decorrido
              </p>
              <p className="text-2xl font-mono font-bold text-purple-400">
                {getElapsedTime()}
              </p>
            </div>

            {/* Progress */}
            <div className="text-center md:text-left">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                {t('investigation.progress')}
              </p>
              <p className="text-2xl font-bold text-gray-100">
                {overallProgress}%
              </p>
              <div className="h-2 bg-gray-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Field Team Section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            {t('investigation.fieldTeam')}
            <span className="text-gray-500">({completedAgents}/{totalAgents})</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {relevantAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                report={reports[agent.id]}
                showAnimation={data.status === 'running'}
              />
            ))}
          </div>
        </div>

        {/* Reports Feed */}
        {Object.values(reports).some(r => r.status === 'completed' && r.report_text) && (
          <div className="bg-[#12121c] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-gray-300">
                {t('investigation.reportsReceived')}
              </h3>
            </div>

            <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
              {Object.values(reports)
                .filter(r => r.status === 'completed' && r.report_text)
                .map(report => (
                  <div key={report.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200">
                          {t(`agents.${report.agent_id}.name`) || report.agent_name} reporta:
                        </p>
                        <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">
                          {report.report_text}
                        </p>
                        {report.findings && report.findings.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {report.findings.slice(0, 5).map((finding, i) => {
                              // Handle both string and object findings
                              const displayText = typeof finding === 'string'
                                ? finding
                                : (finding?.text || finding?.summary || finding?.title ||
                                   finding?.name || finding?.description ||
                                   (typeof finding === 'object' ? Object.values(finding).filter(v => typeof v === 'string')[0] : null) ||
                                   'Descoberta');
                              return (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded"
                                >
                                  {displayText}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Completed - View Briefing Button */}
        {data.status === 'completed' && (
          <div className="mt-6 text-center">
            <ClassificationStamp classification="TOP_SECRET" size="lg" />

            <button
              onClick={() => {
                // Navigate to briefing view
                onBack();
              }}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg font-medium transition-all shadow-lg shadow-purple-900/30"
            >
              <FileText className="w-5 h-5 inline mr-2" />
              {t('investigation.viewBriefing')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestigationRoom;
