import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Socials",
  description: "Einzelposts für Instagram, LinkedIn, Stories und WDC Designforum.",
};

export default function BetaSocialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
