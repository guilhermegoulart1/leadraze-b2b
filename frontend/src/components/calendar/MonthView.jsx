import React, { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import CalendarTaskCard from './CalendarTaskCard';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MonthView = ({
  tasks = [],
  currentDate,
  onTaskClick,
  onTaskMove,
  onDayClick
}) => {
  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();

    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Previous month days to show
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }

    // Next month days to complete the grid (6 rows)
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // Group tasks by date including multi-day spans
  const tasksByDate = useMemo(() => {
    const grouped = {};

    calendarDays.forEach(({ date }) => {
      const dateKey = date.toISOString().split('T')[0];
      grouped[dateKey] = [];
    });

    tasks.forEach(task => {
      if (!task.dueDate) return;

      const startDate = new Date(task.dueDate);
      const endDate = task.endDate ? new Date(task.endDate) : startDate;

      // Add task to each day it spans
      let currentDay = new Date(startDate);
      currentDay.setHours(0, 0, 0, 0);

      const endDay = new Date(endDate);
      endDay.setHours(23, 59, 59, 999);

      while (currentDay <= endDay) {
        const dateKey = currentDay.toISOString().split('T')[0];
        if (grouped[dateKey]) {
          // Mark position in multi-day span
          const isStart = currentDay.toDateString() === startDate.toDateString();
          const isEnd = currentDay.toDateString() === endDate.toDateString();
          const isMultiDay = startDate.toDateString() !== endDate.toDateString();

          grouped[dateKey].push({
            ...task,
            _isStart: isStart,
            _isEnd: isEnd,
            _isMultiDay: isMultiDay,
            _spanPosition: isStart ? 'start' : isEnd ? 'end' : 'middle'
          });
        }
        currentDay.setDate(currentDay.getDate() + 1);
      }
    });

    return grouped;
  }, [tasks, calendarDays]);

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const destDate = result.destination.droppableId.replace('day-', '');

    // Keep the original time, just change the date
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalDate = new Date(task.dueDate);
    const newDate = new Date(destDate);
    newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

    onTaskMove?.(taskId, newDate.toISOString());
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Day names header */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          {DAY_NAMES.map(day => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, isCurrentMonth }, index) => {
            const dateKey = date.toISOString().split('T')[0];
            const dayTasks = tasksByDate[dateKey] || [];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <Droppable key={dateKey} droppableId={`day-${dateKey}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    onClick={() => onDayClick?.(date.toISOString())}
                    className={`
                      min-h-[100px] p-1 border-r border-b border-gray-200 dark:border-gray-700
                      cursor-pointer transition-colors
                      ${index % 7 === 6 ? 'border-r-0' : ''}
                      ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800/30' : ''}
                      ${isWeekend && isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}
                      ${isToday(date) ? 'bg-purple-50 dark:bg-purple-900/20' : ''}
                      ${snapshot.isDraggingOver ? 'bg-purple-100 dark:bg-purple-900/40' : ''}
                      hover:bg-gray-50 dark:hover:bg-gray-800/50
                    `}
                  >
                    {/* Day number */}
                    <div className={`
                      text-sm font-medium mb-1
                      ${isToday(date)
                        ? 'text-white bg-purple-600 dark:bg-purple-500 w-6 h-6 rounded-full flex items-center justify-center'
                        : isCurrentMonth
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-400 dark:text-gray-600'
                      }
                    `}>
                      {date.getDate()}
                    </div>

                    {/* Tasks */}
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 4).map((task, taskIndex) => (
                        <Draggable
                          key={`${task.id}-${dateKey}`}
                          draggableId={task.id}
                          index={taskIndex}
                          isDragDisabled={task._spanPosition !== 'start' && task._isMultiDay}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`
                                ${task._isMultiDay && task._spanPosition === 'middle' ? '-mx-1' : ''}
                                ${task._isMultiDay && task._spanPosition === 'start' ? '-mr-1' : ''}
                                ${task._isMultiDay && task._spanPosition === 'end' ? '-ml-1' : ''}
                              `}
                              onClick={(e) => {
                                e.stopPropagation();
                                onTaskClick?.(task);
                              }}
                            >
                              <CalendarTaskCard
                                task={task}
                                compact
                                isDragging={snapshot.isDragging}
                                className={`
                                  ${task._isMultiDay && task._spanPosition === 'start' ? 'rounded-r-none' : ''}
                                  ${task._isMultiDay && task._spanPosition === 'end' ? 'rounded-l-none' : ''}
                                  ${task._isMultiDay && task._spanPosition === 'middle' ? 'rounded-none' : ''}
                                `}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {dayTasks.length > 4 && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium px-1">
                          +{dayTasks.length - 4} mais
                        </div>
                      )}
                    </div>

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
};

export default MonthView;
