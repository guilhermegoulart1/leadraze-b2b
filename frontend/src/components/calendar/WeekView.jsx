import React, { useMemo, useRef, useEffect, useState } from 'react';
import CalendarTaskCard from './CalendarTaskCard';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8:00 to 22:00
const HOUR_HEIGHT = 60; // pixels per hour

const WeekView = ({
  tasks = [],
  currentDate,
  onTaskClick,
  onTaskMove,
  onSlotClick
}) => {
  const scrollRef = useRef(null);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);

  // Get week days starting from Sunday
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day); // Go to Sunday

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  }, [currentDate]);

  // Calculate current time indicator position
  useEffect(() => {
    const updateTimePosition = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      if (hours >= 8 && hours < 22) {
        const position = (hours - 8) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
        setCurrentTimePosition(position);
      }
    };

    updateTimePosition();
    const interval = setInterval(updateTimePosition, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const hours = now.getHours();
      if (hours >= 8 && hours < 22) {
        const scrollPosition = Math.max(0, (hours - 8 - 1) * HOUR_HEIGHT);
        scrollRef.current.scrollTop = scrollPosition;
      }
    }
  }, []);

  // Group tasks by day and separate all-day tasks
  const { dayTasks, allDayTasks } = useMemo(() => {
    const dayTasks = {};
    const allDayTasks = {};

    weekDays.forEach(day => {
      const dateKey = day.toISOString().split('T')[0];
      dayTasks[dateKey] = [];
      allDayTasks[dateKey] = [];
    });

    tasks.forEach(task => {
      if (!task.dueDate) return;

      const taskDate = new Date(task.dueDate);
      const dateKey = taskDate.toISOString().split('T')[0];

      if (!dayTasks[dateKey]) return;

      // Check if task has specific time (not midnight) - use UTC to be consistent
      const hasTime = taskDate.getUTCHours() !== 0 || taskDate.getUTCMinutes() !== 0;

      // Check if multi-day task
      const isMultiDay = task.endDate && new Date(task.endDate).toISOString().split('T')[0] !== dateKey;

      if (!hasTime || isMultiDay) {
        allDayTasks[dateKey].push(task);
      } else {
        dayTasks[dateKey].push(task);
      }
    });

    return { dayTasks, allDayTasks };
  }, [tasks, weekDays]);

  const formatDayHeader = (date) => {
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return {
      dayName: dayNames[date.getDay()],
      dayNumber: date.getDate()
    };
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getTaskPosition = (task) => {
    const taskDate = new Date(task.dueDate);
    // Use UTC hours to be consistent with how we store times
    const hours = taskDate.getUTCHours();
    const minutes = taskDate.getUTCMinutes();
    const top = (hours - 8) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
    return { top: Math.max(0, top), height: HOUR_HEIGHT - 4 };
  };

  const handleSlotClick = (date, hour) => {
    // Create date with UTC time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hourStr = String(hour).padStart(2, '0');
    const utcString = `${year}-${month}-${day}T${hourStr}:00:00Z`;
    onSlotClick?.(utcString);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header with day names */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        {/* Time column placeholder */}
        <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-700" />

        {/* Day headers */}
        {weekDays.map((date) => {
          const { dayName, dayNumber } = formatDayHeader(date);
          const dateKey = date.toISOString().split('T')[0];
          const dayAllDayTasks = allDayTasks[dateKey] || [];

          return (
            <div key={dateKey} className="flex-1 min-w-[120px] border-r border-gray-200 dark:border-gray-700 last:border-r-0">
              <div className={`text-center py-2 ${isToday(date) ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {dayName}
                </div>
                <div className={`text-lg font-semibold ${
                  isToday(date)
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {dayNumber}
                </div>
              </div>

              {/* All-day tasks section */}
              {dayAllDayTasks.length > 0 && (
                <div className="px-1 pb-1 space-y-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                  {dayAllDayTasks.slice(0, 3).map(task => (
                    <CalendarTaskCard
                      key={task.id}
                      task={task}
                      compact
                      onClick={onTaskClick}
                    />
                  ))}
                  {dayAllDayTasks.length > 3 && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
                      +{dayAllDayTasks.length - 3} mais
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto">
        <div className="flex relative" style={{ minHeight: HOURS.length * HOUR_HEIGHT }}>
          {/* Time labels column */}
          <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="h-[60px] text-right pr-2 text-xs text-gray-400 dark:text-gray-500"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="relative -top-2">{hour.toString().padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((date) => {
            const dateKey = date.toISOString().split('T')[0];
            const dayTaskList = dayTasks[dateKey] || [];

            return (
              <div
                key={dateKey}
                className={`flex-1 min-w-[120px] border-r border-gray-200 dark:border-gray-700 last:border-r-0 relative ${
                  isToday(date) ? 'bg-purple-50/30 dark:bg-purple-900/10' : ''
                }`}
              >
                {/* Hour grid lines (clickable slots) */}
                {HOURS.map(hour => (
                  <div
                    key={`slot-${dateKey}-${hour}`}
                    className="h-[60px] border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => handleSlotClick(date, hour)}
                  />
                ))}

                {/* Tasks positioned absolutely */}
                {dayTaskList.map((task) => {
                  const pos = getTaskPosition(task);
                  return (
                    <div
                      key={task.id}
                      className="absolute left-1 right-1 z-10 cursor-pointer"
                      style={{
                        top: pos.top,
                        minHeight: pos.height,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick?.(task);
                      }}
                    >
                      <CalendarTaskCard
                        task={task}
                        onClick={onTaskClick}
                      />
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {isToday(date) && currentTimePosition > 0 && (
                  <div
                    className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                    style={{ top: currentTimePosition }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekView;
