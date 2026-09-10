import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WDC / Designforum",
  description:
    "Social-Posts für das Designforum zur World Design Capital Frankfurt RheinMain 2026.",
};

export default function WdcLayout({ children }: { children: React.ReactNode }) {
  return children;
}
