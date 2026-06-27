"use client";

import { EventAssetGenerator } from "@/components/event-asset-generator";
import { GeneratorPageShell } from "@/components/generator-page-shell";

export default function Home() {
  return (
    <GeneratorPageShell title="Keyvisual Generator">
      <EventAssetGenerator />
    </GeneratorPageShell>
  );
}
