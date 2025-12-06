import React from 'react';
import { CheckSquare, AlertCircle, Clock, Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const UserTasks = ({ tasks = {} }) => {
  const { overdue = 0, today = 0, tomorrow = 0, total_pending = 0 } = tasks;

  const taskGroups = [
    {
      key: 'overdue',
      label: 'Atrasadas',
      count: overdue,
      color: 'red',
      icon: AlertCircle,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-600 dark:text-red-400',
      dotColor: 'bg-red-500 dark:bg-red-400'
    },
    {
      key: 'today',
      label: 'Para Hoje',
      count: today,
      color: 'amber',
      icon: Clock,
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      textColor: 'text-amber-600 dark:text-amber-400',
      dotColor: 'bg-amber-500 dark:bg-amber-400'
    },
    {
      key: 'tomorrow',
      label: 'Para Amanhã',
      count: tomorrow,
      color: 'blue',
      icon: Calendar,
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-600 dark:text-blue-400',
      dotColor: 'bg-blue-500 dark:bg-blue-400'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Suas Tarefas</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total_pending} pendentes</p>
        </div>
        <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30">
          <CheckSquare className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {taskGroups.map((group) => {
          const Icon = group.icon;

          return (
            <div
              key={group.key}
              className={`flex items-center justify-between p-3 rounded-lg ${group.bgColor}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${group.dotColor}`} />
                <Icon className={`w-4 h-4 ${group.textColor}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{group.label}</span>
              </div>
              <span className={`text-lg font-bold ${group.textColor}`}>
                {group.count}
              </span>
            </div>
          );
        })}
      </div>

      <Link
        to="/tasks"
        className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
      >
        Ver todas as tarefas
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
};

export default UserTasks;
