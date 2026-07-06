import { getTrackedEmails } from "@/lib/tracking/queries";
import MailClient from "./MailClient";
import "./mail.css";

export const dynamic = "force-dynamic";

export default async function MailTrackerPage() {
  const emails = await getTrackedEmails();
  return <MailClient initial={emails} />;
}
