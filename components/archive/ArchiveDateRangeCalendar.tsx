"use client";

import { Button } from "@/components/ui/button";
import { Glass } from "@/components/ui/glass";
import { Calendar, ChevronLeft, ChevronRight, Eye, EyeOff, X } from "lucide-react";
import { useMemo, useState } from "react";

interface ArchiveDateRangeCalendarProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClear: () => void;
  accentColor?: string;
}

export function ArchiveDateRangeCalendar({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
  accentColor = "#3b82f6"
}: ArchiveDateRangeCalendarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(
    dateFrom ? new Date(dateFrom + 'T12:00:00') : null
  );
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(
    dateTo ? new Date(dateTo + 'T12:00:00') : null
  );
  const [selectingRange, setSelectingRange] = useState<'start' | 'end' | null>(null);

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    const startDay = firstDay.getDay();
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  }, [currentMonth]);

  const handleDateClick = (date: Date) => {
    if (!selectingRange) {
      // Start selecting range
      setSelectedStartDate(date);
      setSelectedEndDate(null);
      setSelectingRange('end');
      onDateFromChange(date.toISOString().split('T')[0]);
      onDateToChange('');
    } else if (selectingRange === 'start') {
      setSelectedStartDate(date);
      setSelectingRange('end');
      onDateFromChange(date.toISOString().split('T')[0]);
    } else {
      // End selecting range
      if (date < (selectedStartDate || new Date(0))) {
        // If clicked date is before start, make it the new start
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(date);
        onDateFromChange(date.toISOString().split('T')[0]);
        onDateToChange(selectedStartDate!.toISOString().split('T')[0]);
      } else {
        setSelectedEndDate(date);
        onDateToChange(date.toISOString().split('T')[0]);
      }
      setSelectingRange(null);
    }
  };

  const isDateInRange = (date: Date) => {
    if (!selectedStartDate) return false;
    if (selectedEndDate) {
      return date >= selectedStartDate && date <= selectedEndDate;
    }
    return date.getTime() === selectedStartDate.getTime();
  };

  const isDateSelected = (date: Date) => {
    if (selectedStartDate && date.getTime() === selectedStartDate.getTime()) return 'start';
    if (selectedEndDate && date.getTime() === selectedEndDate.getTime()) return 'end';
    return false;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Glass className="border-2">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Calendar className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Select Date Range</h3>
              <p className="text-xs text-muted-foreground">
                {dateFrom && dateTo 
                  ? `${dateFrom} to ${dateTo}`
                  : dateFrom 
                    ? `From ${dateFrom}`
                    : 'No date range selected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClear();
                  setSelectedStartDate(null);
                  setSelectedEndDate(null);
                  setSelectingRange(null);
                }}
                className="h-8 w-8 p-0"
                title="Clear date range"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(!isVisible)}
              className="h-8 w-8 p-0"
              title={isVisible ? "Hide calendar" : "Show calendar"}
            >
              {isVisible ? (
                <EyeOff className="h-4 w-4" style={{ color: accentColor }} />
              ) : (
                <Eye className="h-4 w-4" style={{ color: accentColor }} />
              )}
            </Button>
          </div>
        </div>
      </div>

      {isVisible && (
        <div className="px-6 pb-6 space-y-3">
          {/* Calendar */}
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h4 className="text-lg font-semibold">{monthName}</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="h-8"
              disabled={currentMonth >= new Date(today.getFullYear(), today.getMonth(), 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const isToday = date.getTime() === today.getTime();
              const isPast = date < today;
              const inRange = isDateInRange(date);
              const selected = isDateSelected(date);
              const isDisabled = date > today;

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => !isDisabled && handleDateClick(date)}
                  disabled={isDisabled}
                  className={`
                    aspect-square rounded-lg text-sm font-medium transition-all duration-200
                    ${isDisabled 
                      ? 'opacity-30 cursor-not-allowed' 
                      : 'hover:scale-110 cursor-pointer'
                    }
                    ${selected === 'start' || selected === 'end'
                      ? 'bg-primary text-primary-foreground shadow-lg scale-110'
                      : inRange
                        ? 'bg-primary/20 text-primary'
                        : isToday
                          ? 'border-2 border-primary font-bold'
                          : isPast
                            ? 'hover:bg-accent'
                            : 'hover:bg-accent/50'
                    }
                  `}
                  style={{
                    backgroundColor: selected 
                      ? accentColor 
                      : inRange 
                        ? `${accentColor}20`
                        : undefined,
                    color: selected ? '#ffffff' : inRange ? accentColor : undefined,
                    borderColor: isToday ? accentColor : undefined,
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Instructions */}
          {!dateFrom && !dateTo && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              Click a date to start selecting a range
            </p>
          )}
          {dateFrom && !dateTo && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              Click another date to complete the range
            </p>
          )}
        </div>
      )}
    </Glass>
  );
}

