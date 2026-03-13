import type { Env } from "./types";
import { withCache, xmlResponse } from "./lib/cache";
import { generateSitemapIndex } from "./generators/sitemap-index";
import { generateStaticSitemap } from "./generators/static";
import { generateBlogSitemap } from "./generators/blog";
import {
    generateStocksSitemap,
    generateEtfsSitemap,
    generateChartsSitemap,
    generateNewsSitemap,
} from "./generators/entities";

const ROUTES: Record<
    string,
    (env: Env) => string | Promise<string>
> = {
    "/sitemap.xml": (env) => generateSitemapIndex(env),
    "/sitemap-static.xml": (env) => generateStaticSitemap(env),
    "/sitemap-blog.xml": (env) => generateBlogSitemap(env),
    "/sitemap-stocks.xml": (env) => generateStocksSitemap(env),
    "/sitemap-etfs.xml": (env) => generateEtfsSitemap(env),
    "/sitemap-charts.xml": (env) => generateChartsSitemap(env),
    "/sitemap-news.xml": (env) => generateNewsSitemap(env),
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        const generator = ROUTES[path];
        if (!generator) {
            // Pass through to origin for unmatched routes
            return fetch(request);
        }

        const cacheTtl = parseInt(env.CACHE_TTL_SECONDS, 10) || 3600;

        return withCache(request, cacheTtl, async () => {
            const result = generator(env);
            return result instanceof Promise ? await result : result;
        });
    },
};
