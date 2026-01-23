// frontend/src/components/dashboard/RoadmapsDashboard.jsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Map, CheckCircle, Clock, AlertTriangle, ListTodo,
  TrendingUp, ChevronRight, Loader, Calendar, RefreshCw, Users
} from 'lucide-react';
import api from '../../services/api';

// Metric Card Component
const MetricCard = ({ icon: Icon, label, value, subValue, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            {subValue && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{subValue}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Progress Bar Component
const ProgressBar = ({ value, max, color = 'blue' }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-300 ${colorClasses[color]}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
};

// Active Execution Card
const ExecutionCard = ({ execution, onClick }) => {
  const progress = execution.total_tasks > 0
    ? (execution.completed_tasks / execution.total_tasks) * 100
    : 0;
  const hasOverdue = execution.overdue_tasks > 0;

  return (
    <button
      onClick={() => onClick?.(execution)}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {execution.roadmap_name}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {execution.contact_name || execution.company_name}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1" />
      </div>

      <div className="flex items-center gap-3 mb-2">
        <ProgressBar
          value={execution.completed_tasks}
          max={execution.total_tasks}
          color={hasOverdue ? 'red' : progress === 100 ? 'green' : 'blue'}
        />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {execution.completed_tasks}/{execution.total_tasks}
        </span>
      </div>

      {hasOverdue && (
        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="w-3 h-3" />
          <span>{execution.overdue_tasks} tarefa(s) atrasada(s)</span>
        </div>
      )}
    </button>
  );
};

// Task Item (for overdue and upcoming)
const TaskItem = ({ task, variant = 'overdue' }) => {
  const isOverdue = variant === 'overdue';
  const dueDate = new Date(task.due_date);
  const now = new Date();
  const diffMs = dueDate - now;
  const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));

  let timeText;
  if (isOverdue) {
    timeText = diffDays === 0 ? 'Vence hoje' : `Atrasado há ${diffDays} dia(s)`;
  } else {
    if (diffHours < 24) {
      timeText = diffHours <= 1 ? 'Em breve' : `Em ${diffHours}h`;
    } else {
      timeText = diffDays === 1 ? 'Amanhã' : `Em ${diffDays} dias`;
    }
  }

  const bgClass = isOverdue
    ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20'
    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20';

  const iconBgClass = isOverdue
    ? 'bg-red-100 dark:bg-red-900/30'
    : 'bg-blue-100 dark:bg-blue-900/30';

  const iconColorClass = isOverdue
    ? 'text-red-600 dark:text-red-400'
    : 'text-blue-600 dark:text-blue-400';

  const timeColorClass = isOverdue
    ? 'text-red-600 dark:text-red-400'
    : 'text-blue-600 dark:text-blue-400';

  // Display context: roadmap name OR opportunity title
  const contextText = task.roadmap_name || task.opportunity_title || '';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${bgClass}`}>
      <div className={`p-1.5 rounded-full ${iconBgClass}`}>
        {isOverdue ? (
          <AlertTriangle className={`w-3.5 h-3.5 ${iconColorClass}`} />
        ) : (
          <Clock className={`w-3.5 h-3.5 ${iconColorClass}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {task.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {contextText && `${contextText} • `}{task.contact_name}
        </p>
        <p className={`text-xs mt-1 ${timeColorClass}`}>
          {timeText}
        </p>
      </div>
      {task.assignee_name && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {task.assignee_avatar ? (
            <img src={task.assignee_avatar} alt="" className="w-5 h-5 rounded-full" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[9px] font-medium text-gray-600 dark:text-gray-300">
              {task.assignee_name.charAt(0)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const RoadmapsDashboard = () => {
  const { t } = useTranslation('dashboard');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(7);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    loadData();
  }, [period, selectedUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.getRoadmapsDashboard({ period, user_id: selectedUser || undefined });
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Error loading tasks dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const periods = [
    { value: 7, label: '7 dias' },
    { value: 30, label: '30 dias' },
    { value: 90, label: '90 dias' }
  ];

  const metrics = data?.metrics || {};
  const activeExecutions = data?.active_executions || [];
  const overdueTasks = data?.overdue_tasks || [];
  const upcomingTasks = data?.upcoming_tasks || [];
  const completedPerDay = data?.completed_per_day || [];
  const users = data?.users || [];

  // Format chart data
  const chartData = completedPerDay.map(item => {
    const date = new Date(item.date);
    return {
      ...item,
      dateFormatted: date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
      completed: parseInt(item.completed) || 0
    };
  });

  const totalCompletedInPeriod = chartData.reduce((sum, item) => sum + item.completed, 0);

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</p>
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            {payload[0].value} {payload[0].value === 1 ? 'tarefa concluída' : 'tarefas concluídas'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Period selector */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p.value
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* User filter */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos os usuários</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              icon={ListTodo}
              label="Pendentes"
              value={metrics.pending_tasks || 0}
              color="blue"
            />
            <MetricCard
              icon={CheckCircle}
              label="Concluídas"
              value={metrics.tasks_completed || 0}
              subValue={`/ ${metrics.total_tasks || 0}`}
              color="green"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Atrasadas"
              value={metrics.overdue_tasks || 0}
              color="red"
            />
            <MetricCard
              icon={Calendar}
              label="Vencem esta Semana"
              value={metrics.due_this_week || 0}
              color="orange"
            />
            <MetricCard
              icon={TrendingUp}
              label="Taxa de Conclusão"
              value={`${metrics.completion_rate || 0}%`}
              color="purple"
            />
          </div>

          {/* Completed Tasks Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Tarefas Concluídas
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Últimos {period} dias
                </p>
              </div>
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="h-48">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="dateFormatted"
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#10b981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                  Sem dados
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Total no período
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {totalCompletedInPeriod} {totalCompletedInPeriod === 1 ? 'tarefa' : 'tarefas'}
                </span>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overdue Tasks */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Tarefas Atrasadas
                  </h3>
                  {overdueTasks.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                      {overdueTasks.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {overdueTasks.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {overdueTasks.map(task => (
                      <TaskItem key={task.id} task={task} variant="overdue" />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-300 dark:text-green-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Nenhuma tarefa atrasada
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Tasks */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Próximas Tarefas
                  </h3>
                  {upcomingTasks.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                      {upcomingTasks.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {upcomingTasks.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {upcomingTasks.map(task => (
                      <TaskItem key={task.id} task={task} variant="upcoming" />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Nenhuma tarefa para esta semana
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Roadmaps */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Roadmaps Ativos
                  </h3>
                  {metrics.active_executions > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                      {metrics.active_executions}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {activeExecutions.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {activeExecutions.map(execution => (
                      <ExecutionCard key={execution.id} execution={execution} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Map className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Nenhum roadmap em andamento
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RoadmapsDashboard;
