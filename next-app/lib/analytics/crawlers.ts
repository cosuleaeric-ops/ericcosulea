// Detecție crawlere AI / boți din user-agent (fără dependențe externe).
// Ele NU rulează JavaScript, deci nu ajung niciodată la /api/event — sunt
// colectate server-side (middleware pe site + POST la /api/crawler).

export type CrawlerCategory = "answer" | "search" | "training" | "other";
export type CrawlerHit = { name: string; category: CrawlerCategory };

// [regex pe token UA, nume afișat, categorie]. Ordine: specific → generic.
const CRAWLERS: Array<[RegExp, string, CrawlerCategory]> = [
  // ── OpenAI ──
  [/ChatGPT-User/i, "ChatGPT-User", "answer"],
  [/OAI-SearchBot/i, "OAI-SearchBot", "search"],
  [/GPTBot/i, "GPTBot", "training"],
  // ── Anthropic ──
  [/Claude-User/i, "Claude-User", "answer"],
  [/Claude-SearchBot/i, "Claude-SearchBot", "search"],
  [/ClaudeBot/i, "ClaudeBot", "training"],
  [/anthropic-ai/i, "anthropic-ai", "training"],
  // ── Perplexity ──
  [/Perplexity-User/i, "Perplexity-User", "answer"],
  [/PerplexityBot/i, "PerplexityBot", "search"],
  // ── Google ──
  [/Google-Extended/i, "Google-Extended", "training"],
  [/GoogleOther/i, "GoogleOther", "training"],
  [/Googlebot/i, "Googlebot", "search"],
  // ── Microsoft / Bing ──
  [/BingBot|bingbot|BingPreview/i, "Bingbot", "search"],
  // ── Apple ──
  [/Applebot-Extended/i, "Applebot-Extended", "training"],
  [/Applebot/i, "Applebot", "search"],
  // ── Alte AI (training / crawl) ──
  [/CCBot/i, "CCBot (Common Crawl)", "training"],
  [/Amazonbot/i, "Amazonbot", "training"],
  [/Bytespider/i, "Bytespider (ByteDance)", "training"],
  [/Meta-ExternalAgent|Meta-ExternalFetcher/i, "Meta-ExternalAgent", "training"],
  [/FacebookBot/i, "FacebookBot", "training"],
  [/cohere-ai|cohere-training-data-crawler/i, "Cohere", "training"],
  [/DuckAssistBot/i, "DuckAssistBot", "answer"],
  [/DuckDuckBot/i, "DuckDuckBot", "search"],
  [/YouBot/i, "YouBot", "search"],
  [/Diffbot/i, "Diffbot", "training"],
  [/Timpibot/i, "Timpibot", "training"],
  [/ImagesiftBot/i, "ImagesiftBot", "training"],
  [/AI2Bot/i, "AI2Bot", "training"],
  [/PanguBot/i, "PanguBot", "training"],
  [/DeepSeek/i, "DeepSeekBot", "training"],
  [/QwenBot|Alibaba/i, "QwenBot", "training"],
  [/xAI|GrokBot|\bGrok\b/i, "Grok (xAI)", "training"],
  [/YandexBot/i, "YandexBot", "search"],
  [/Baiduspider/i, "Baiduspider", "search"],
  [/PetalBot/i, "PetalBot", "other"],
  [/DataForSeoBot/i, "DataForSeoBot", "other"],
];

export function detectCrawler(ua: string | null | undefined): CrawlerHit | null {
  if (!ua) return null;
  for (const [re, name, category] of CRAWLERS) {
    if (re.test(ua)) return { name, category };
  }
  return null;
}
