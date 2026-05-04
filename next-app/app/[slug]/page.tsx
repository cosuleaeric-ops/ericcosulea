import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { getPostBySlug } from "@/lib/db/queries";
import { rewriteUploadUrls } from "@/lib/blob";

const RO_MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function formatRoDate(date: Date): string {
  return `${date.getDate()} ${RO_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

const TWITTER_EMBED_RE =
  /<!--\s*wp:embed\s+\{"url":"(https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^"]+)".*?\}\s*-->\s*<figure[^>]*class="wp-block-embed[^"]*"[^>]*>[\s\S]*?<\/figure>\s*<!--\s*\/wp:embed\s*-->/gi;

function renderPostContent(html: string): { html: string; hasTweets: boolean } {
  let hasTweets = false;
  const replaced = html.replace(TWITTER_EMBED_RE, (_match, url) => {
    hasTweets = true;
    return `<blockquote class="twitter-tweet"><a href="${url}">${url}</a></blockquote>`;
  });
  return { html: rewriteUploadUrls(replaced), hasTweets };
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const all = await db.select({ slug: posts.slug }).from(posts);
  return all.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} - Eric Cosulea`,
    description: post.excerpt ?? undefined,
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const { html, hasTweets } = renderPostContent(post.contentHtml);

  return (
    <main className="page">
      <article className="post">
        <Link className="post-back" href="/">← homepage</Link>
        <h1 className="post-title">{post.title}</h1>
        <p className="post-meta">{formatRoDate(post.publishedAt)}</p>
        <div className="post-content" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      {hasTweets && (
        <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" async />
      )}
    </main>
  );
}
