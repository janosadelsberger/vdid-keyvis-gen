import * as React from "react";
import { Input } from "@/components/ui/input";

type TimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
};

export function TimePicker({ id, value, onChange }: TimePickerProps) {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    onChange(e.target.value);
  };

  return (
    <Input
      id={id}
      type="time"
      value={value}
      onChange={handleChange}
      step={300}
      placeholder="Uhrzeit wählen"
    />
  );
}

