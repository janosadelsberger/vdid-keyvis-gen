import "./globals.css";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "VDID Keyvisual Generator",
  description: "Generate VDID key visuals for web and social media.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body
        className={`${roboto.variable} font-sans bg-[#0A2CD9] text-white`}
      >
        {children}
      </body>
    </html>
  );
}

