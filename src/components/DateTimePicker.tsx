"use client";

import { useState, useEffect } from "react";

interface DateTimePickerProps {
  value: string; // ISO string or datetime-local format
  onChange: (value: string) => void;
  minDate?: string; // YYYY-MM-DD
}

// Generate time options in 15-minute increments
function generateTimeOptions() {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      const value = `${h}:${m}`;

      // Format label as 12-hour time
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? "AM" : "PM";
      const label = `${hour12}:${m.padStart(2, "0")} ${ampm}`;

      options.push({ value, label });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export default function DateTimePicker({ value, onChange, minDate }: DateTimePickerProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");

  // Parse initial value
  useEffect(() => {
    if (value) {
      // Handle both ISO strings and datetime-local format
      const dateObj = new Date(value);
      if (!isNaN(dateObj.getTime())) {
        // Format as YYYY-MM-DD for date input
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
        const day = dateObj.getDate().toString().padStart(2, "0");
        setDate(`${year}-${month}-${day}`);

        // Format as HH:MM for time select
        const hours = dateObj.getHours().toString().padStart(2, "0");
        const minutes = dateObj.getMinutes().toString().padStart(2, "0");
        // Round to nearest 15 minutes
        const roundedMinutes = Math.round(parseInt(minutes) / 15) * 15;
        const finalMinutes = roundedMinutes === 60 ? "00" : roundedMinutes.toString().padStart(2, "0");
        setTime(`${hours}:${finalMinutes}`);
      }
    }
  }, []);

  // Combine date and time and emit change
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (newDate && time) {
      onChange(`${newDate}T${time}`);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (date && newTime) {
      onChange(`${date}T${newTime}`);
    }
  };

  // Get today's date for min attribute
  const today = minDate || new Date().toISOString().split("T")[0];

  return (
    <div className="flex gap-3">
      {/* Date Picker */}
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          min={today}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white
                     focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none
                     [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50
                     [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
          required
        />
      </div>

      {/* Time Dropdown */}
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1">Time</label>
        <select
          value={time}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white
                     focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none
                     appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.5rem center",
            backgroundSize: "1.5em 1.5em",
            paddingRight: "2.5rem",
          }}
          required
        >
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
