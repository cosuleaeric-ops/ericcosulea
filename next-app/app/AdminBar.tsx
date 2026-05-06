import { isAuthenticated } from "@/lib/session";
import AdminBarClient from "./AdminBarClient";

export default async function AdminBar() {
  if (!(await isAuthenticated())) return null;
  return <AdminBarClient />;
}
