import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-1 text-slate-900 dark:text-slate-100", className)}
      classNames={{
        months: "flex flex-col space-y-2",
        caption:
          "flex justify-center pt-1 relative items-center text-sm font-medium",
        nav: "space-x-1 flex items-center",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "w-8 text-[11px] font-medium text-slate-500 dark:text-slate-400",
        row: "flex w-full mt-1",
        cell: "relative text-center text-sm p-0",
        day: cn(
          "h-8 w-8 rounded-md text-sm transition-colors",
          "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vdidBlue dark:hover:bg-slate-700",
        ),
        day_selected:
          "bg-vdidBlue text-white hover:bg-vdidBlue hover:text-white",
        day_today:
          "border border-slate-300 bg-slate-50 font-medium text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
        day_outside:
          "text-slate-300 aria-selected:bg-slate-100 aria-selected:text-slate-500 dark:text-slate-600 dark:aria-selected:bg-slate-700 dark:aria-selected:text-slate-400",
        day_disabled: "text-slate-300 opacity-50 dark:text-slate-600",
      }}
      {...props}
    />
  );
}

