import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Socials",
  description: "Einzelposts für Instagram, LinkedIn und Stories.",
};

export default function SocialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
