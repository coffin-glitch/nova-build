"use client";

import { Calendar, Clock } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DateTimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
}

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
}

// Native HTML5 Time Input Component - Completely Isolated
function TimeInput({ value, onChange }: TimeInputProps) {
  const [timeValue, setTimeValue] = useState(value || '09:00');

  useEffect(() => {
    setTimeValue(value || '09:00');
  }, [value]);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputTime = e.target.value;
    console.log('Raw time input:', inputTime);
    
    // Convert to military time format (24-hour)
    const militaryTime = convertToMilitaryTime(inputTime);
    console.log('Converted to military time:', militaryTime);
    
    setTimeValue(militaryTime);
    // Call parent onChange immediately for real-time updates
    onChange(militaryTime);
  };

  // Helper function to convert time to military format
  const convertToMilitaryTime = (timeString: string): string => {
    if (!timeString) return '09:00';
    
    // If already in HH:MM format, return as is
    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }
    
    // Parse the time string
    const [time, period] = timeString.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let militaryHours = hours;
    
    // Convert 12-hour to 24-hour format
    if (period) {
      if (period.toLowerCase() === 'pm' && hours !== 12) {
        militaryHours = hours + 12;
      } else if (period.toLowerCase() === 'am' && hours === 12) {
        militaryHours = 0;
      }
    }
    
    // Format as HH:MM
    return `${militaryHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const setCurrentTime = () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setTimeValue(currentTime);
    onChange(currentTime);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={timeValue}
          onChange={handleTimeChange}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1 text-center text-lg font-mono"
          step="60"
          data-format="24"
          style={{ colorScheme: 'light' }}
          lang="en-GB"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={setCurrentTime}
          className="px-2"
        >
          <Clock className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Click to select time or type directly (stored in 24-hour military format)
      </p>
    </div>
  );
}

// Native HTML5 Date Input Component - Completely Isolated
function DateInput({ value, onChange }: DateInputProps) {
  const [dateValue, setDateValue] = useState(value || '');

  useEffect(() => {
    setDateValue(value || '');
  }, [value]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDateValue(newDate);
    // Call parent onChange immediately for real-time updates
    onChange(newDate);
  };

  const setCurrentDate = () => {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    setDateValue(dateString);
    onChange(dateString);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={dateValue}
          onChange={handleDateChange}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={setCurrentDate}
          className="px-2"
        >
          <Calendar className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Main DateTimePicker Component with Completely Native HTML5 Inputs
export function DateTimePicker({ value, onChange, placeholder, className }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');

  // Initialize values from prop - only run once
  useEffect(() => {
    if (value) {
      const dateTime = new Date(value);
      const date = dateTime.toISOString().split('T')[0];
      const time = `${dateTime.getHours().toString().padStart(2, '0')}:${dateTime.getMinutes().toString().padStart(2, '0')}`;
      setDateValue(date);
      setTimeValue(time);
    } else {
      // Set default to current date and 9:00 AM
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      setDateValue(today);
      setTimeValue('09:00');
    }
  }, []); // Empty dependency array - only run once

  // Completely separate handlers for date and time
  const handleDateChange = (newDate: string) => {
    console.log('Date changed to:', newDate);
    setDateValue(newDate);
    // Update datetime when date changes
    if (timeValue) {
      updateDateTime(newDate, timeValue);
    }
  };

  const handleTimeChange = (newTime: string) => {
    console.log('Time changed to:', newTime);
    setTimeValue(newTime);
    // Update datetime when time changes
    if (dateValue) {
      updateDateTime(dateValue, newTime);
    }
  };

  // Helper function to combine date and time
  const updateDateTime = (date: string, time: string) => {
    console.log('updateDateTime called with:', date, time);
    if (date && time) {
      const [hours, minutes] = time.split(':').map(Number);
      // Create date in local timezone to avoid timezone shift
      const [year, month, day] = date.split('-').map(Number);
      const dateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      console.log('Final datetime:', dateTime.toISOString());
      onChange(dateTime.toISOString());
    }
  };

  const formatDisplayValue = () => {
    if (!dateValue || !timeValue) return placeholder || 'Select date and time';
    
    // Parse date in local timezone to avoid timezone shift
    const [year, month, day] = dateValue.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const time = timeValue;

    return `${date.toLocaleDateString()} at ${time}`;
  };

  const setCurrentDateTime = () => {
    const now = new Date();
    // Use local date to avoid timezone issues
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    setDateValue(today);
    setTimeValue(currentTime);
    updateDateTime(today, currentTime);
  };

  const handleDone = () => {
    // Ensure the current values are saved before closing
    if (dateValue && timeValue) {
      updateDateTime(dateValue, timeValue);
    }
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal h-11 text-base border-2 border-border rounded-lg focus:border-primary transition-colors ${className || ''}`}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {formatDisplayValue()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div className="text-center">
            <h4 className="text-sm font-semibold text-foreground">Select Date & Time</h4>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Date</Label>
              <DateInput value={dateValue} onChange={handleDateChange} />
            </div>

            <div>
              <Label className="text-sm font-medium">Time (24-hour)</Label>
              <TimeInput value={timeValue} onChange={handleTimeChange} />
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={setCurrentDateTime}
              className="flex-1"
            >
              <Clock className="mr-2 h-4 w-4" />
              Now
            </Button>
            <Button
              onClick={handleDone}
              size="sm"
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}