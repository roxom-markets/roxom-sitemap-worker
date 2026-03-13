import type { Env } from "../types";
import { buildSitemapIndex } from "../lib/xml";

export function generateSitemapIndex(env: Env): string {
    const base = env.BASE_URL;

    return buildSitemapIndex([
        `${base}/sitemap-static.xml`,
        `${base}/sitemap-blog.xml`,
        `${base}/sitemap-stocks.xml`,
        `${base}/sitemap-etfs.xml`,
        `${base}/sitemap-charts.xml`,
        `${base}/sitemap-news.xml`,
    ]);
}
