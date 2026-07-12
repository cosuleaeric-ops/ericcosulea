import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Newsreader, IBM_Plex_Mono } from "next/font/google";
import { getSession } from "@/lib/session";
import "./brain.css";

const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--brain-font-serif",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--brain-font-mono",
});

export const metadata: Metadata = {
  title: "Brain",
  robots: { index: false, follow: false },
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%23b8532e'/></svg>" },
};

export default async function BrainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.loggedInAt) {
    redirect("/admin/login");
  }
  return <div className={`brain ${serif.variable} ${mono.variable}`}>{children}</div>;
}
