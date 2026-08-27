import { IBM_Plex_Mono, Newsreader } from "next/font/google";
import "@/app/brain/brain.css";

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

export default function AdminBrainLayout({ children }: { children: React.ReactNode }) {
  return <div className={`brain ${serif.variable} ${mono.variable}`}>{children}</div>;
}
