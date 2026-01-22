import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Loader
} from 'lucide-react';
import api from '../../services/api';
import WeekView from './WeekView';
import MonthView from './MonthView';

const CalendarView = ({
  filters = {},
  onTaskClick,
  onTaskCreate,
  onRefresh,
  refreshTrigger = 0
}) => {
  const { t } = useTranslation('tasks');
  const [calendarView, setCalendarView] = useState('week'); // 'week' or 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calculate date range based on view
  const getDateRange = useCallback(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (calendarView === 'week') {
      // Get start of week (Sunday)
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);

      // Get end of week (Saturday)
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      // Get start of month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      // Include days from previous month shown in calendar
      const firstDayOfWeek = start.getDay();
      start.setDate(start.getDate() - firstDayOfWeek);

      // Get end of month
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);

      // Include days from next month shown in calendar
      const lastDayOfWeek = end.getDay();
      end.setDate(end.getDate() + (6 - lastDayOfWeek));
    }

    return { start, end };
  }, [currentDate, calendarView]);

  // Load tasks for the current view
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      const params = {
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        include_completed: filters.status === 'completed' ? 'true' : 'false'
      };

      if (filters.assigned_to) {
        params.assigned_to = filters.assigned_to;
      }

      const response = await api.getTasksCalendar(params);

      if (response.success) {
        setTasks(response.data.tasks || []);
      }
    } catch (error) {
      console.error('Error loading calendar tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, filters, refreshTrigger]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Navigation handlers
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (calendarView === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (calendarView === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Handle task move (drag and drop)
  const handleTaskMove = async (taskId, newDueDate) => {
    try {
      // Optimistic update
      setTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, dueDate: newDueDate } : task
        )
      );

      await api.updateTask(taskId, { due_date: newDueDate });
      onRefresh?.();
    } catch (error) {
      console.error('Error moving task:', error);
      loadTasks(); // Revert on error
    }
  };

  // Handle slot/day click to create task
  const handleSlotClick = (dateTime) => {
    onTaskCreate?.(dateTime);
  };

  // Format current period label
  const formatPeriodLabel = () => {
    const options = calendarView === 'week'
      ? { month: 'long', year: 'numeric' }
      : { month: 'long', year: 'numeric' };

    if (calendarView === 'week') {
      const { start, end } = getDateRange();
      const sameMonth = start.getMonth() === end.getMonth();

      if (sameMonth) {
        return `${start.getDate()} - ${end.getDate()} de ${currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
      } else {
        return `${start.getDate()} de ${start.toLocaleDateString('pt-BR', { month: 'short' })} - ${end.getDate()} de ${end.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`;
      }
    }

    return currentDate.toLocaleDateString('pt-BR', options);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('calendar.today', 'Hoje')}
          </button>

          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={goToPrevious}
              className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize ml-2">
            {formatPeriodLabel()}
          </h2>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-0.5">
          <button
            onClick={() => setCalendarView('week')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              calendarView === 'week'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('calendar.week', 'Semana')}
          </button>
          <button
            onClick={() => setCalendarView('month')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              calendarView === 'month'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('calendar.month', 'Mês')}
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        ) : calendarView === 'week' ? (
          <WeekView
            tasks={tasks}
            currentDate={currentDate}
            onTaskClick={onTaskClick}
            onTaskMove={handleTaskMove}
            onSlotClick={handleSlotClick}
          />
        ) : (
          <MonthView
            tasks={tasks}
            currentDate={currentDate}
            onTaskClick={onTaskClick}
            onTaskMove={handleTaskMove}
            onDayClick={handleSlotClick}
          />
        )}
      </div>
    </div>
  );
};

export default CalendarView;
