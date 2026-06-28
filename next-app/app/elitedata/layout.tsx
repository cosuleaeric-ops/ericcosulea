import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import "./elitedata.css";

export const metadata: Metadata = {
  title: { default: "EliteData", template: "%s · EliteData" },
};

function ownerName(): string {
  const email = process.env.ADMIN_EMAIL ?? "";
  const local = email.split("@")[0] ?? "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function ownerInitial(): string {
  return (process.env.ADMIN_EMAIL ?? "E").charAt(0).toUpperCase();
}

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.loggedInAt) {
    redirect("/admin/login");
  }

  return (
    <div className="dfa">
      <div className="dfa-shell">
        <header className="dfa-topbar">
          <a href="/elitedata" className="dfa-brand">
            <span className="dfa-brand-mark">E</span>
            EliteData
          </a>
          <div className="dfa-user">
            <span>{ownerName()}</span>
            <span className="dfa-avatar">{ownerInitial()}</span>
          </div>
        </header>
        <main className="dfa-main">{children}</main>
      </div>
    </div>
  );
}
