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
                ? "bg-white/15 font-medium text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
