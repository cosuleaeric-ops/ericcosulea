import Link from "next/link";
import type { Metadata } from "next";
import { getAllPostsForAdmin, getProjectsForHome, getAllImages } from "@/lib/db/queries";
import { blobUrl } from "@/lib/blob";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowUpRight,
  BarChart3,
  Brain,
  ExternalLink,
  Mail,
  Plus,
  Soup,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TOOLS: { href: string; name: string; icon: LucideIcon; chip: string }[] = [
  { href: "/pnlpersonal", name: "p&l personal", icon: Wallet, chip: "bg-[#eef1fd] text-[#5469d4]" },
  { href: "/dogu", name: "dogu", icon: Soup, chip: "bg-[#fdf0ec] text-[#d85a30]" },
  { href: "/brain", name: "brain", icon: Brain, chip: "bg-[#ecf7f1] text-[#1d9e75]" },
  { href: "/elite-deux", name: "elite deux", icon: Zap, chip: "bg-[#fdf6e7] text-[#ba7517]" },
  { href: "/admin/mail", name: "elitemail", icon: Mail, chip: "bg-[#e8f3fd] text-[#2f7fd0]" },
  { href: "/elitedata", name: "analytics", icon: BarChart3, chip: "bg-[#f3eefb] text-[#7a4fc9]" },
];

const RO_MONTHS_SHORT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "noi", "dec"];

function formatRoDateShort(date: Date): string {
  return `${date.getDate()} ${RO_MONTHS_SHORT[date.getMonth()]}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">{children}</p>;
}

export default async function AdminDashboard() {
  const [posts, projects, images] = await Promise.all([
    getAllPostsForAdmin(),
    getProjectsForHome(),
    getAllImages(),
  ]);

  const today = new Date().toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Bucharest",
  });

  return (
    <div className="mx-auto max-w-[700px] px-9 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">admin</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{today}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/" target="_blank">
              <ExternalLink /> vezi site-ul
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/posts/new">
              <Plus /> articol nou
            </Link>
          </Button>
        </div>
      </div>

      <SectionLabel>tooluri</SectionLabel>
      <div className="mb-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="flex-row items-center gap-3 px-3.5 py-3 transition-colors hover:border-ring">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>
                <t.icon className="size-[17px]" />
              </span>
              <span className="text-[13px] font-medium">{t.name}</span>
              <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground/60" />
            </Card>
          </Link>
        ))}
      </div>

      <SectionLabel>editezi aici</SectionLabel>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <Link href="/admin/posts">
          <Card className="h-full gap-0 px-4 py-3.5 transition-colors hover:border-ring">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[13px] font-medium">articole</span>
              <span className="text-[11px] text-muted-foreground">{posts.length}</span>
            </div>
            {posts.slice(0, 2).map((p, i) => (
              <p
                key={p.id}
                className={`truncate text-xs leading-relaxed text-foreground/75 ${i === 0 ? "border-b border-border/60 pb-1.5 mb-1.5" : ""}`}
              >
                {p.title}
                <span className="text-muted-foreground"> · {formatRoDateShort(p.publishedAt)}</span>
              </p>
            ))}
          </Card>
        </Link>
        <Link href="/admin/projects">
          <Card className="h-full gap-0 px-4 py-3.5 transition-colors hover:border-ring">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[13px] font-medium">proiecte</span>
              <span className="text-[11px] text-muted-foreground">{projects.length}</span>
            </div>
            <p className="truncate border-b border-border/60 pb-1.5 mb-1.5 text-xs leading-relaxed text-foreground/75">
              {projects.slice(0, 2).map((p) => p.name).join(" · ")}
            </p>
            <p className="truncate text-xs leading-relaxed text-foreground/75">
              {projects.slice(2, 4).map((p) => p.name).join(" · ")}
            </p>
          </Card>
        </Link>
        <Link href="/inspo">
          <Card className="h-full gap-0 px-4 py-3.5 transition-colors hover:border-ring">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[13px] font-medium">inspo</span>
              <span className="text-[11px] text-muted-foreground">{images.length} img</span>
            </div>
            <div className="flex gap-1.5">
              {images.slice(0, 3).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={blobUrl(`inspo/${img.filename}`)}
                  alt=""
                  className="aspect-square w-0 flex-1 rounded-md object-cover"
                />
              ))}
              <span className="flex aspect-square w-0 flex-1 items-center justify-center rounded-md bg-muted">
                <Plus className="size-3.5 text-muted-foreground" />
              </span>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
