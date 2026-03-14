import type { Env } from "./types";
import { xmlResponse } from "./lib/cache";
import { generateSitemapIndex } from "./generators/sitemap-index";
import { generateStaticSitemap } from "./generators/static";
import { generateBlogSitemap } from "./generators/blog";
import {
    generateStocksSitemap,
    generateEtfsSitemap,
    generateChartsSitemap,
    generateNewsSitemap,
} from "./generators/entities";
import { generateExchangeSitemap } from "./generators/exchange";

const SITEMAP_ROUTES: string[] = [
    "/sitemap.xml",
    "/sitemap-static.xml",
    "/sitemap-blog.xml",
    "/sitemap-stocks.xml",
    "/sitemap-etfs.xml",
    "/sitemap-charts.xml",
    "/sitemap-news.xml",
    "/sitemap-exchange.xml",
];

/**
 * Generators for each sitemap — used by the cron trigger to pre-build.
 * Blog, static, index, and exchange are lightweight and can also run inline.
 */
const GENERATORS: Record<string, (env: Env) => string | Promise<string>> = {
    "/sitemap.xml": (env) => generateSitemapIndex(env),
    "/sitemap-static.xml": (env) => generateStaticSitemap(env),
    "/sitemap-blog.xml": (env) => generateBlogSitemap(env),
    "/sitemap-stocks.xml": (env) => generateStocksSitemap(env),
    "/sitemap-etfs.xml": (env) => generateEtfsSitemap(env),
    "/sitemap-charts.xml": (env) => generateChartsSitemap(env),
    "/sitemap-news.xml": (env) => generateNewsSitemap(env),
    "/sitemap-exchange.xml": (env) => generateExchangeSitemap(env),
};

/** Sitemaps that are too heavy to generate during a request (entities). */
const HEAVY_SITEMAPS = new Set([
    "/sitemap-stocks.xml",
    "/sitemap-etfs.xml",
    "/sitemap-charts.xml",
    "/sitemap-news.xml",
]);

/** Lightweight sitemaps safe to generate inline if not in KV. */
const LIGHT_GENERATORS: Record<
    string,
    (env: Env) => string | Promise<string>
> = {
    "/sitemap.xml": GENERATORS["/sitemap.xml"],
    "/sitemap-static.xml": GENERATORS["/sitemap-static.xml"],
    "/sitemap-blog.xml": GENERATORS["/sitemap-blog.xml"],
    "/sitemap-exchange.xml": GENERATORS["/sitemap-exchange.xml"],
};

export default {
    /**
     * HTTP request handler — serves sitemaps from KV, falling back to
     * inline generation for lightweight sitemaps only.
     */
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        // Manual rebuild trigger: GET /_rebuild?key=<REBUILD_KEY>
        if (path === "/_rebuild") {
            const key = url.searchParams.get("key");
            if (!env.REBUILD_KEY || key !== env.REBUILD_KEY) {
                return new Response("Unauthorized", { status: 401 });
            }

            const cacheTtl = parseInt(env.CACHE_TTL_SECONDS, 10) || 3600;
            const results: string[] = [];

            for (const sitemapPath of SITEMAP_ROUTES) {
                try {
                    const generator = GENERATORS[sitemapPath];
                    const result = generator(env);
                    const body =
                        result instanceof Promise ? await result : result;
                    await env.KV.put(`sitemap:${sitemapPath}`, body, {
                        expirationTtl: cacheTtl,
                    });
                    results.push(`OK ${sitemapPath} (${body.length} bytes)`);
                } catch (error) {
                    results.push(
                        `FAIL ${sitemapPath}: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }

            return new Response(results.join("\n"), {
                headers: { "Content-Type": "text/plain" },
            });
        }

        if (!SITEMAP_ROUTES.includes(path)) {
            return fetch(request);
        }

        const cacheTtl = parseInt(env.CACHE_TTL_SECONDS, 10) || 3600;

        // Try KV first
        const kvKey = `sitemap:${path}`;
        const cached = await env.KV.get(kvKey);
        if (cached) {
            return xmlResponse(cached, cacheTtl);
        }

        // For heavy sitemaps with no KV data, return a minimal placeholder
        // (cron hasn't run yet). This avoids 1101 errors.
        if (HEAVY_SITEMAPS.has(path)) {
            const placeholder =
                '<?xml version="1.0" encoding="UTF-8"?>' +
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
                "</urlset>";
            return xmlResponse(placeholder, 60);
        }

        // Lightweight sitemaps can be generated inline
        const generator = LIGHT_GENERATORS[path];
        if (generator) {
            const result = generator(env);
            const body =
                result instanceof Promise ? await result : result;
            // Store in KV for next request
            await env.KV.put(kvKey, body, {
                expirationTtl: cacheTtl,
            });
            return xmlResponse(body, cacheTtl);
        }

        return fetch(request);
    },

    /**
     * Cron trigger — rebuilds ALL sitemaps and stores in KV.
     * Scheduled invocations have 30s+ CPU time, enough for entity fetches.
     */
    async scheduled(
        _event: ScheduledEvent,
        env: Env,
        ctx: ExecutionContext,
    ): Promise<void> {
        ctx.waitUntil(
            (async () => {
                const cacheTtl =
                    parseInt(env.CACHE_TTL_SECONDS, 10) || 3600;

                console.log("Sitemap cron: starting rebuild");

                for (const path of SITEMAP_ROUTES) {
                    try {
                        const generator = GENERATORS[path];
                        const result = generator(env);
                        const body =
                            result instanceof Promise
                                ? await result
                                : result;
                        await env.KV.put(`sitemap:${path}`, body, {
                            expirationTtl: cacheTtl,
                        });
                        console.log(
                            `Sitemap cron: rebuilt ${path} (${body.length} bytes)`,
                        );
                    } catch (error) {
                        console.error(
                            `Sitemap cron: failed ${path}:`,
                            error,
                        );
                    }
                }

                console.log("Sitemap cron: rebuild complete");
            })(),
        );
    },
};
