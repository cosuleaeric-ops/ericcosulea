import { getTrackedEmails } from "@/lib/tracking/queries";
import MailClient from "./MailClient";

export const dynamic = "force-dynamic";

export default async function EliteMailPage() {
  const emails = await getTrackedEmails();
  return (
    <div className="dark min-h-screen bg-background font-sans text-foreground">
      <MailClient initial={emails} />
    </div>
  );
}
