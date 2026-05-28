import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.loggedInAt) {
    redirect("/admin/login");
  }
  return children;
}
