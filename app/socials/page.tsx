"use client";

import { GeneratorPageShell } from "@/components/generator-page-shell";
import { VdidLabGenerator } from "@/components/vdidlab/vdidlab-generator";

export default function SocialsPage() {
  return (
    <GeneratorPageShell title="Socials">
      <VdidLabGenerator />
    </GeneratorPageShell>
  );
}
