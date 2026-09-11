"use client";

import React from "react";
import Link from "next/link";
import { APP_VERSION_LABEL, versionedPath } from "@/lib/app-version";
import { publicFile } from "@/lib/public-file";

export function VdidSidebarLogo() {
  const lightLogo = publicFile("/VDID_Logo_rgb.svg");
  const darkLogo = publicFile("/VDID_Logo_neg.svg");

  return (
    <div className="mb-2">
      <img
        src={lightLogo}
        alt="VDID Logo"
        className="h-16 w-16 dark:hidden"
      />
      <img
        src={darkLogo}
        alt=""
        className="hidden h-16 w-16 dark:block"
      />
    </div>
  );
}

type GeneratorPageShellProps = {
  title: string;
  nav?: React.ReactNode;
  children: React.ReactNode;
};

export function GeneratorPageShell({
  title,
  nav,
  children,
}: GeneratorPageShellProps) {
  return (
    <main className="min-h-screen p-6">
      <div className="flex gap-6">
        <div className="sticky top-6 h-fit flex flex-col items-start">
          <VdidSidebarLogo />
          <Link href={versionedPath("/")} className="group">
            <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">
              {title}
            </h1>
            <p className="text-xs text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
              {APP_VERSION_LABEL}
            </p>
          </Link>
          {nav ? <div className="mt-3">{nav}</div> : null}
        </div>

        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-6xl">
            <div className="rounded-xl bg-white p-6 leading-relaxed text-slate-900 shadow-lg antialiased dark:bg-slate-900 dark:text-slate-100 dark:shadow-none dark:ring-1 dark:ring-white/10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
