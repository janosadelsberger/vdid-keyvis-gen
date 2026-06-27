"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateLine, parseDateLine } from "@/lib/lab-date-line";

export type LabDateLineFieldsProps = {
  value: string;
  onChange: (dateLine: string) => void;
  dateId?: string;
  timeId?: string;
};

export function LabDateLineFields({
  value,
  onChange,
  dateId = "dateLine-date",
  timeId = "dateLine-time",
}: LabDateLineFieldsProps) {
  const { date, time } = parseDateLine(value);

  const update = (nextDate: Date | null, nextTime: string) => {
    onChange(formatDateLine(nextDate, nextTime));
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={dateId}>Datum</Label>
        <DatePicker
          date={date}
          onChange={(nextDate) => update(nextDate, time)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={timeId}>Uhrzeit</Label>
        <Input
          id={timeId}
          value={time}
          onChange={(e) => update(date, e.target.value)}
          placeholder="9:00–13:00"
        />
      </div>
    </div>
  );
}
