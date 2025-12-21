// frontend/src/components/aiemployees/AgentProfileStep/ConfigTab.jsx
// Tab de Configuracoes adicionais

import React from 'react';
import { Sliders, MessageSquare, Zap, Globe, Clock, Calendar } from 'lucide-react';

// Timezone options
const timezoneOptions = [
  { value: 'America/Sao_Paulo', label: 'Brasilia (GMT-3)', offset: -3 },
  { value: 'America/New_York', label: 'New York (GMT-5)', offset: -5 },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)', offset: -8 },
  { value: 'Europe/London', label: 'London (GMT+0)', offset: 0 },
  { value: 'Europe/Paris', label: 'Paris (GMT+1)', offset: 1 },
  { value: 'Europe/Lisbon', label: 'Lisboa (GMT+0)', offset: 0 },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)', offset: 9 },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+11)', offset: 11 }
];

// Days of week
const daysOfWeek = [
  { value: 'mon', label: 'Seg' },
  { value: 'tue', label: 'Ter' },
  { value: 'wed', label: 'Qua' },
  { value: 'thu', label: 'Qui' },
  { value: 'fri', label: 'Sex' },
  { value: 'sat', label: 'Sab' },
  { value: 'sun', label: 'Dom' }
];

const responseLengthOptions = [
  { value: 'short', label: 'Curto', description: '1-2 frases por mensagem' },
  { value: 'medium', label: 'Medio', description: '2-4 frases por mensagem' },
  { value: 'long', label: 'Longo', description: 'Respostas detalhadas' }
];

const languageOptions = [
  { value: 'pt-BR', label: 'Portugues (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es', label: 'Espanol' }
];

const ConfigTab = ({ profile, onChange }) => {
  return (
    <div className="max-w-2xl space-y-8">
      {/* Formalidade */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Sliders className="w-4 h-4" />
          Formalidade
        </label>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            value={profile.formality || 50}
            onChange={(e) => onChange('formality', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Informal</span>
            <span className="font-medium text-purple-600 dark:text-purple-400">
              {profile.formality || 50}%
            </span>
            <span>Muito Formal</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Nivel de formalidade nas mensagens do agente
        </p>
      </div>

      {/* Assertividade */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Zap className="w-4 h-4" />
          Assertividade
        </label>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            value={profile.assertiveness || 50}
            onChange={(e) => onChange('assertiveness', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Passivo</span>
            <span className="font-medium text-purple-600 dark:text-purple-400">
              {profile.assertiveness || 50}%
            </span>
            <span>Muito Assertivo</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          O quanto o agente sera direto e insistente nas conversas
        </p>
      </div>

      {/* Tamanho das Respostas */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <MessageSquare className="w-4 h-4" />
          Tamanho das Respostas
        </label>
        <div className="grid grid-cols-3 gap-3">
          {responseLengthOptions.map(option => (
            <button
              key={option.value}
              onClick={() => onChange('responseLength', option.value)}
              className={`
                p-4 rounded-lg border-2 text-center transition-all
                ${profile.responseLength === option.value
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }
              `}
            >
              <div className={`text-sm font-medium ${
                profile.responseLength === option.value
                  ? 'text-purple-700 dark:text-purple-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {option.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {option.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Idioma Preferido */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Globe className="w-4 h-4" />
          Idioma Preferido
        </label>
        <select
          value={profile.language || 'pt-BR'}
          onChange={(e) => onChange('language', e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white"
        >
          {languageOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Idioma principal das respostas do agente
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">
          Tempo de Resposta
        </h3>
      </div>

      {/* Latência de Resposta */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Clock className="w-4 h-4" />
          Latencia de Resposta
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Tempo aleatorio que o agente demora para responder quando o lead envia uma mensagem
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              Minimo
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={profile.latency?.min || 30}
                onChange={(e) => onChange('latency', {
                  ...profile.latency,
                  min: parseInt(e.target.value) || 0
                })}
                className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
              />
              <select
                value={profile.latency?.minUnit || 'seconds'}
                onChange={(e) => onChange('latency', {
                  ...profile.latency,
                  minUnit: e.target.value
                })}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
              >
                <option value="seconds">segundos</option>
                <option value="minutes">minutos</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              Maximo
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={profile.latency?.max || 2}
                onChange={(e) => onChange('latency', {
                  ...profile.latency,
                  max: parseInt(e.target.value) || 0
                })}
                className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
              />
              <select
                value={profile.latency?.maxUnit || 'minutes'}
                onChange={(e) => onChange('latency', {
                  ...profile.latency,
                  maxUnit: e.target.value
                })}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
              >
                <option value="seconds">segundos</option>
                <option value="minutes">minutos</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            O agente respondera em um tempo aleatorio entre{' '}
            <strong>{profile.latency?.min || 30} {profile.latency?.minUnit === 'minutes' ? 'minutos' : 'segundos'}</strong> e{' '}
            <strong>{profile.latency?.max || 2} {profile.latency?.maxUnit === 'seconds' ? 'segundos' : 'minutos'}</strong>.
          </p>
        </div>
      </div>

      {/* Horário de Funcionamento */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Calendar className="w-4 h-4" />
            Horario de Funcionamento
          </label>
          <button
            type="button"
            onClick={() => onChange('workingHours', {
              ...profile.workingHours,
              enabled: !profile.workingHours?.enabled
            })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              profile.workingHours?.enabled ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                profile.workingHours?.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {profile.workingHours?.enabled
            ? 'O agente so respondera dentro do horario definido'
            : 'O agente respondera a qualquer momento (24/7)'}
        </p>

        {profile.workingHours?.enabled && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            {/* Timezone */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                Fuso Horario
              </label>
              <select
                value={profile.workingHours?.timezone || 'America/Sao_Paulo'}
                onChange={(e) => onChange('workingHours', {
                  ...profile.workingHours,
                  timezone: e.target.value
                })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
              >
                {timezoneOptions.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Horários */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Inicio
                </label>
                <input
                  type="time"
                  value={profile.workingHours?.startTime || '09:00'}
                  onChange={(e) => onChange('workingHours', {
                    ...profile.workingHours,
                    startTime: e.target.value
                  })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Fim
                </label>
                <input
                  type="time"
                  value={profile.workingHours?.endTime || '18:00'}
                  onChange={(e) => onChange('workingHours', {
                    ...profile.workingHours,
                    endTime: e.target.value
                  })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
                />
              </div>
            </div>

            {/* Dias da semana */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                Dias de Funcionamento
              </label>
              <div className="flex gap-2">
                {daysOfWeek.map(day => {
                  const isSelected = (profile.workingHours?.days || ['mon', 'tue', 'wed', 'thu', 'fri']).includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        const currentDays = profile.workingHours?.days || ['mon', 'tue', 'wed', 'thu', 'fri'];
                        const newDays = isSelected
                          ? currentDays.filter(d => d !== day.value)
                          : [...currentDays, day.value];
                        onChange('workingHours', {
                          ...profile.workingHours,
                          days: newDays
                        });
                      }}
                      className={`
                        w-10 h-10 rounded-lg text-xs font-medium transition-all
                        ${isSelected
                          ? 'bg-purple-500 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:border-purple-300'
                        }
                      `}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comportamento fora do horário */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                Fora do Horario
              </label>
              <select
                value={profile.workingHours?.outsideBehavior || 'queue'}
                onChange={(e) => onChange('workingHours', {
                  ...profile.workingHours,
                  outsideBehavior: e.target.value
                })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-sm"
              >
                <option value="queue">Enfileirar e responder no proximo horario</option>
                <option value="message">Enviar mensagem automatica de ausencia</option>
                <option value="ignore">Nao fazer nada</option>
              </select>
            </div>

            {profile.workingHours?.outsideBehavior === 'message' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Mensagem de Ausencia
                </label>
                <textarea
                  value={profile.workingHours?.awayMessage || ''}
                  onChange={(e) => onChange('workingHours', {
                    ...profile.workingHours,
                    awayMessage: e.target.value
                  })}
                  placeholder="Ola! No momento estou fora do horario de atendimento. Retornarei em breve!"
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-sm resize-none"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Card */}
      <div className="mt-8 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
        <h4 className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-2">
          Preview do Comportamento
        </h4>
        <p className="text-sm text-purple-700 dark:text-purple-400">
          {profile.name || 'O agente'} sera{' '}
          {(profile.formality || 50) > 70 ? 'muito formal' : (profile.formality || 50) > 40 ? 'moderadamente formal' : 'informal'},{' '}
          {(profile.assertiveness || 50) > 70 ? 'muito assertivo' : (profile.assertiveness || 50) > 40 ? 'equilibrado' : 'passivo'} e{' '}
          enviara mensagens{' '}
          {profile.responseLength === 'short' ? 'curtas e diretas' : profile.responseLength === 'long' ? 'detalhadas e completas' : 'de tamanho medio'}.
        </p>
      </div>
    </div>
  );
};

export default ConfigTab;
