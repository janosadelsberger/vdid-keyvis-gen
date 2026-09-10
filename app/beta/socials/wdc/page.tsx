"use client";

import { GeneratorPageShell } from "@/components/generator-page-shell";
import { SocialsSectionNav } from "@/components/vdidlab/socials-section-nav";
import { VdidLabGenerator } from "@/components/vdidlab/vdidlab-generator";

export default function BetaWdcSocialsPage() {
  return (
    <GeneratorPageShell title="WDC / Designforum" nav={<SocialsSectionNav />}>
      <VdidLabGenerator family="wdc" />
    </GeneratorPageShell>
  );
}
