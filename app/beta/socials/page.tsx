"use client";

import { GeneratorPageShell } from "@/components/generator-page-shell";
import { SocialsSectionNav } from "@/components/vdidlab/socials-section-nav";
import { VdidLabGenerator } from "@/components/vdidlab/vdidlab-generator";

export default function BetaSocialsPage() {
  return (
    <GeneratorPageShell title="Socials" nav={<SocialsSectionNav />}>
      <VdidLabGenerator family="lab" />
    </GeneratorPageShell>
  );
}
