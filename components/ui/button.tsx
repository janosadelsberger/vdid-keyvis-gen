import * as React from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ring-offset-slate-100 dark:ring-offset-slate-900";

    const variants: Record<"default" | "outline" | "ghost", string> = {
      default:
        "bg-vdidBlue text-vdidWhite hover:bg-blue-700 focus-visible:ring-vdidBlue dark:hover:bg-[#3B5CFF]",
      outline:
        "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
      ghost:
        "bg-transparent text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-400 dark:text-slate-100 dark:hover:bg-slate-800",
    };

    const sizes: Record<"sm" | "md", string> = {
      sm: "h-8 px-3",
      md: "h-10 px-4",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

