"use client";

import { EventAssetGenerator } from "@/components/event-asset-generator";
import { publicFile } from "@/lib/public-file";

export default function Home() {
  const logoPath = publicFile("/VDID_Logo_neg.svg");

  return (
    <main className="min-h-screen p-6">
      <div className="flex gap-6">
        {/* Sticky Left Sidebar with Logo and Title */}
        <div className="sticky top-6 h-fit flex flex-col items-start">
          <div className="mb-2">
            <img
              src={logoPath}
              alt="VDID Logo"
              className="w-16 h-16"
            />
          </div>
          <h1 className="text-lg font-medium text-white">Asset Generator</h1>
        </div>

        {/* Main Content - Centered */}
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-6xl">
            <div className="bg-white rounded-xl shadow-lg p-6 leading-relaxed text-slate-900 antialiased">
              <EventAssetGenerator />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

