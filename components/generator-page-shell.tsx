"use client";

import React from "react";
import { publicFile } from "@/lib/public-file";

export function VdidSidebarLogo() {
  const logoPath = publicFile("/VDID_Logo_neg.svg");

  return (
    <div className="mb-2">
      <img src={logoPath} alt="VDID Logo" className="w-16 h-16" />
    </div>
  );
}

type GeneratorPageShellProps = {
  title: string;
  children: React.ReactNode;
};

export function GeneratorPageShell({
  title,
  children,
}: GeneratorPageShellProps) {
  return (
    <main className="min-h-screen p-6">
      <div className="flex gap-6">
        <div className="sticky top-6 h-fit flex flex-col items-start">
          <VdidSidebarLogo />
          <h1 className="text-lg font-medium text-white">{title}</h1>
        </div>

        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-6xl">
            <div className="bg-white rounded-xl shadow-lg p-6 leading-relaxed text-slate-900 antialiased">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
