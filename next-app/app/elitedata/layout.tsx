import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { clientIp, recordOwnIp } from "@/lib/analytics/exclusions";
import "./elitedata.css";
import Image from "next/image";

export const metadata: Metadata = {
  title: { default: "EliteData", template: "%s · EliteData" },
  icons: { icon: "/elitedata/favicon.svg" },
};

const NUME = "Eric";

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.loggedInAt) {
    redirect("/admin/login");
  }

  // Sunt logat și mă uit la dashboard → IP-ul de pe care vin e al meu.
  // Îl ținem minte ca să nu-mi mai contorizăm vizitele pe niciun site urmărit,
  // iar când providerul mi-l rotește, prima deschidere a dashboard-ului îl
  // reînnoiește singură.
  await recordOwnIp(clientIp(await headers()));

  return (
    <div className="dfa">
      <div className="dfa-shell">
        <header className="dfa-topbar">
          <a href="/elitedata" className="dfa-brand">
            <span className="dfa-brand-mark" aria-hidden="true">
              <svg
                width="17"
                height="17"
                viewBox="7 6 18 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="8" y="7" width="16" height="4.6" rx="2.3" fill="currentColor" />
                <rect x="8" y="13.7" width="11" height="4.6" rx="2.3" fill="currentColor" />
                <rect x="8" y="20.4" width="16" height="4.6" rx="2.3" fill="currentColor" />
              </svg>
            </span>
            EliteData
          </a>
          <div className="dfa-user">
            <span>{NUME}</span>
            <Image
              className="dfa-avatar"
              src="/assets/avatar.jpeg"
              alt={NUME}
              width={60}
              height={60}
            />
          </div>
        </header>
        <main className="dfa-main">{children}</main>
      </div>
    </div>
  );
}
