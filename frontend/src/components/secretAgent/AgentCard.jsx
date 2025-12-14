import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, Clock, AlertTriangle, User } from 'lucide-react';

// Agent avatar images (using placeholder silhouettes for now)
// These would be replaced with actual photos from Unsplash or custom photos
const AGENT_AVATARS = {
  marcus_chen: null, // Will show silhouette
  sarah_mitchell: null,
  james_rodriguez: null,
  elena_volkov: null,
  david_park: null,
  director_morgan: null
};

/**
 * Agent Card Component - Shows individual intelligence team agent
 * Gaming-style card with photo, status, and progress
 */
const AgentCard = ({ agent, report, showAnimation = false }) => {
  const { t } = useTranslation('secretAgent');

  const agentInfo = {
    marcus_chen: { color: 'from-blue-600 to-blue-800', accent: 'blue' },
    sarah_mitchell: { color: 'from-pink-600 to-pink-800', accent: 'pink' },
    james_rodriguez: { color: 'from-green-600 to-green-800', accent: 'green' },
    elena_volkov: { color: 'from-purple-600 to-purple-800', accent: 'purple' },
    david_park: { color: 'from-cyan-600 to-cyan-800', accent: 'cyan' },
    director_morgan: { color: 'from-indigo-600 to-indigo-800', accent: 'indigo' }
  };

  const info = agentInfo[agent.id] || { color: 'from-gray-600 to-gray-800', accent: 'gray' };
  const status = report?.status || 'pending';
  const progress = report?.progress || 0;

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'working':
        return <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    if (status === 'working' && report?.current_task) {
      return report.current_task;
    }
    return t(`status.${status}`);
  };

  return (
    <div className={`
      relative bg-[#12121c] border rounded-xl overflow-hidden transition-all duration-300
      ${status === 'working' ? 'border-purple-600/50 shadow-lg shadow-purple-900/20' : 'border-gray-800'}
      ${status === 'completed' ? 'border-green-600/30' : ''}
    `}>
      {/* Scan animation overlay for working status */}
      {status === 'working' && showAnimation && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent animate-pulse"
            style={{
              animation: 'scan 2s linear infinite',
              top: `${progress}%`
            }}
          />
        </div>
      )}

      <div className="p-4">
        {/* Avatar and Name */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar Circle */}
          <div className={`
            relative w-12 h-12 rounded-full flex items-center justify-center
            bg-gradient-to-br ${info.color}
            ${status === 'working' ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#12121c]' : ''}
          `}>
            {AGENT_AVATARS[agent.id] ? (
              <img
                src={AGENT_AVATARS[agent.id]}
                alt={agent.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              // Silhouette placeholder
              <User className="w-6 h-6 text-white/80" />
            )}

            {/* Status indicator dot */}
            <div className={`
              absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#12121c]
              flex items-center justify-center
              ${status === 'completed' ? 'bg-green-500' : ''}
              ${status === 'working' ? 'bg-purple-500' : ''}
              ${status === 'failed' ? 'bg-red-500' : ''}
              ${status === 'pending' ? 'bg-gray-600' : ''}
            `}>
              {status === 'working' && (
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
              )}
            </div>
          </div>

          {/* Name and Role */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-200 truncate">
              {t(`agents.${agent.id}.name`) || agent.name}
            </h4>
            <p className="text-xs text-gray-500 truncate">
              {t(`agents.${agent.id}.role`) || agent.role}
            </p>
          </div>

          {/* Status Icon */}
          {getStatusIcon()}
        </div>

        {/* Progress Bar */}
        <div className="mb-2">
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`
                h-full transition-all duration-500 rounded-full
                ${status === 'completed' ? 'bg-green-500' : ''}
                ${status === 'working' ? 'bg-gradient-to-r from-purple-600 to-purple-400' : ''}
                ${status === 'failed' ? 'bg-red-500' : ''}
                ${status === 'pending' ? 'bg-gray-700' : ''}
              `}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status Text */}
        <p className={`
          text-xs truncate
          ${status === 'working' ? 'text-purple-400' : ''}
          ${status === 'completed' ? 'text-green-400' : ''}
          ${status === 'failed' ? 'text-red-400' : ''}
          ${status === 'pending' ? 'text-gray-500' : ''}
        `}>
          {getStatusText()}
        </p>
      </div>

      {/* Completed Report Preview */}
      {status === 'completed' && report?.report_text && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-800/50">
          <p className="text-xs text-gray-400 line-clamp-2">
            {report.report_text.substring(0, 150)}...
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes scan {
          0% { top: 0%; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default AgentCard;
