import type { Env, SitemapEntry } from "../types";
import { buildSitemap } from "../lib/xml";

export function generateStaticSitemap(env: Env): string {
    const base = env.BASE_URL;

    const entries: SitemapEntry[] = [
        { url: base, changefreq: "weekly", priority: 1.0 },
        { url: `${base}/about`, changefreq: "monthly", priority: 0.7 },
        { url: `${base}/vip`, changefreq: "weekly", priority: 0.9 },
        { url: `${base}/referral`, changefreq: "monthly", priority: 0.6 },
        { url: `${base}/legal`, changefreq: "monthly", priority: 0.3 },
        { url: `${base}/terminal`, changefreq: "daily", priority: 0.9 },
        { url: `${base}/terminal/global`, changefreq: "daily", priority: 0.9 },
        { url: `${base}/insights`, changefreq: "daily", priority: 0.8 },
    ];

    return buildSitemap(entries);
}
