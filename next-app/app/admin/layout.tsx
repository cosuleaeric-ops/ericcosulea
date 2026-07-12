import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-app min-h-screen bg-background text-foreground">{children}</div>;
}
