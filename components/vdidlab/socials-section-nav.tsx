"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { unversionedPath, versionedPath } from "@/lib/app-version";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/socials/", label: "Lab" },
  { href: "/socials/wdc/", label: "WDC" },
] as const;

export function SocialsSectionNav() {
  const pathname = usePathname();
  const current = unversionedPath(pathname ?? "/");

  return (
    <nav className="flex flex-wrap gap-1" aria-label="Socials-Bereich">
      {LINKS.map((link) => {
        const active =
          current === link.href || current === link.href.replace(/\/$/, "");
        return (
          <Link
            key={link.href}
            href={versionedPath(link.href)}
            className={cn(
              "rounded-md px-2 py-1 text-sm transition-colors",
              active
                ? "bg-vdidBlue/10 font-medium text-vdidBlue dark:bg-white/10 dark:text-white"
                : "text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
