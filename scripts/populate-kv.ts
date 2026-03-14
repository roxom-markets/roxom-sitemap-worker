/**
 * Populate KV manually by fetching APIs and generating sitemaps locally,
 * then pushing to KV via wrangler CLI.
 *
 * Usage: bun scripts/populate-kv.ts
 */

import { execSync } from "child_process";

const CF_ACCOUNT_ID = "939be7f3eaad96fe02047a7744702446";
const KV_NAMESPACE_ID = "85b576fc172841f2b59d513139f946cf";
const BASE_URL = "https://roxom.com";
const ENTITIES_API_URL = "https://window.roxom.com";
const GHOST_SITEMAP_URL = "https://insights.roxom.com/sitemap-posts.xml";
const EXCHANGE_API_URL = "https://window.roxom.com";
const CACHE_TTL = 3600;

// ─── XML helpers ────────────────────────────────────────────────────
function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

interface SitemapEntry {
    url: string;
    lastmod?: string;
    changefreq?: string;
    priority?: number;
}

function buildSitemap(entries: SitemapEntry[]): string {
    const urls = entries
        .map((e) => {
            let u = `  <url>\n    <loc>${escapeXml(e.url)}</loc>`;
            if (e.lastmod) u += `\n    <lastmod>${e.lastmod}</lastmod>`;
            if (e.changefreq) u += `\n    <changefreq>${e.changefreq}</changefreq>`;
            if (e.priority !== undefined) u += `\n    <priority>${e.priority.toFixed(1)}</priority>`;
            u += "\n  </url>";
            return u;
        })
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

function buildSitemapIndex(sitemapUrls: string[]): string {
    const entries = sitemapUrls
        .map(
            (url) =>
                `  <sitemap>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${new Date().toISOString()}</lastmod>\n  </sitemap>`,
        )
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
}

// ─── KV writer ──────────────────────────────────────────────────────
function putKV(key: string, value: string): void {
    const tmpFile = `/tmp/kv-${key.replace(/[^a-z0-9]/gi, "_")}.xml`;
    require("fs").writeFileSync(tmpFile, value);
    execSync(
        `CLOUDFLARE_ACCOUNT_ID=${CF_ACCOUNT_ID} npx wrangler kv key put --namespace-id ${KV_NAMESPACE_ID} "${key}" --path "${tmpFile}" --ttl ${CACHE_TTL}`,
        { cwd: process.cwd(), stdio: "inherit" },
    );
    require("fs").unlinkSync(tmpFile);
}

// ─── Entity fetching ────────────────────────────────────────────────
interface Entity {
    ticker: string;
    entitySubType?: string;
    entityClass?: string;
    lastUpdatedAt: string;
}

const LINKABLE_TYPES = new Set(["public_company", "stock", "etf"]);

async function fetchEntities(): Promise<Entity[]> {
    const limit = 4000;
    console.log("Fetching entities page 1...");
    const firstResp = await fetch(`${ENTITIES_API_URL}/entities/paginated`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "RoxomSitemapPopulate/1.0" },
        body: JSON.stringify({ page: 1, limit, sortBy: "ticker", sortOrder: "asc" }),
    });
    if (!firstResp.ok) throw new Error(`Entities API page 1: ${firstResp.status}`);
    const firstData = (await firstResp.json()) as any;
    const all: Entity[] = [...firstData.data.entities];
    const totalPages: number = firstData.data.pagination.totalPages;
    console.log(`  Got ${all.length} entities, ${totalPages} total pages`);

    if (totalPages > 1) {
        const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        const results = await Promise.all(
            pages.map(async (p) => {
                console.log(`Fetching entities page ${p}...`);
                const resp = await fetch(`${ENTITIES_API_URL}/entities/paginated`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "User-Agent": "RoxomSitemapPopulate/1.0" },
                    body: JSON.stringify({ page: p, limit, sortBy: "ticker", sortOrder: "asc" }),
                });
                if (!resp.ok) return [];
                const data = (await resp.json()) as any;
                return data.data.entities as Entity[];
            }),
        );
        for (const r of results) all.push(...r);
    }

    return all.filter(
        (e) => LINKABLE_TYPES.has(e.entitySubType ?? "") || LINKABLE_TYPES.has(e.entityClass ?? ""),
    );
}

function getEntityUrlType(e: Entity): "stock" | "etf" {
    if (e.entityClass === "etf" || e.entitySubType === "etf") return "etf";
    return "stock";
}

function encodeTickerForUrl(ticker: string): string {
    return encodeURIComponent(ticker);
}

function safeISODate(dateStr: string): string | undefined {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
}

// ─── Generators ─────────────────────────────────────────────────────
function genIndex(): string {
    return buildSitemapIndex([
        `${BASE_URL}/sitemap-static.xml`,
        `${BASE_URL}/sitemap-blog.xml`,
        `${BASE_URL}/sitemap-stocks.xml`,
        `${BASE_URL}/sitemap-etfs.xml`,
        `${BASE_URL}/sitemap-charts.xml`,
        `${BASE_URL}/sitemap-news.xml`,
        `${BASE_URL}/sitemap-exchange.xml`,
    ]);
}

function genStatic(): string {
    return buildSitemap([
        { url: BASE_URL, changefreq: "weekly", priority: 1.0 },
        { url: `${BASE_URL}/about`, changefreq: "monthly", priority: 0.7 },
        { url: `${BASE_URL}/vip`, changefreq: "weekly", priority: 0.9 },
        { url: `${BASE_URL}/referral`, changefreq: "monthly", priority: 0.6 },
        { url: `${BASE_URL}/legal`, changefreq: "monthly", priority: 0.3 },
        { url: `${BASE_URL}/terminal`, changefreq: "daily", priority: 0.9 },
        { url: `${BASE_URL}/terminal/global`, changefreq: "daily", priority: 0.9 },
        { url: `${BASE_URL}/insights`, changefreq: "daily", priority: 0.8 },
    ]);
}

async function genBlog(): Promise<string> {
    console.log("Fetching Ghost sitemap...");
    const resp = await fetch(GHOST_SITEMAP_URL, {
        headers: { "User-Agent": "RoxomSitemapPopulate/1.0" },
        redirect: "follow",
    });
    if (!resp.ok) throw new Error(`Ghost sitemap: ${resp.status}`);
    let xml = await resp.text();
    xml = xml.replace(/https:\/\/insights\.roxom\.com\//g, `${BASE_URL}/insights/`);
    xml = xml.replace(/<\?xml-stylesheet[^?]*\?>\s*/g, "");
    return xml;
}

async function genExchange(): Promise<string> {
    console.log("Fetching instruments...");
    const resp = await fetch(`${EXCHANGE_API_URL}/instruments?type=perpetual`, {
        headers: { "User-Agent": "RoxomSitemapPopulate/1.0" },
    });
    if (!resp.ok) throw new Error(`Instruments API: ${resp.status}`);
    const data = (await resp.json()) as { items: { symbol: string; isActive: boolean }[] };
    const active = data.items.filter((i) => i.isActive);

    const entries: SitemapEntry[] = [
        { url: `${BASE_URL}/exchange/spot/express`, changefreq: "daily", priority: 0.8 },
    ];
    for (const inst of active) {
        entries.push({
            url: `${BASE_URL}/exchange/futures/${inst.symbol.replace("-", "").toUpperCase()}`,
            changefreq: "daily",
            priority: 0.8,
        });
    }
    return buildSitemap(entries);
}

function genStocks(entities: Entity[]): string {
    const stocks = entities.filter((e) => getEntityUrlType(e) === "stock");
    return buildSitemap(
        stocks.map((e) => ({
            url: `${BASE_URL}/terminal/stock/${encodeTickerForUrl(e.ticker)}`,
            lastmod: safeISODate(e.lastUpdatedAt),
            changefreq: "daily",
            priority: 0.7,
        })),
    );
}

function genEtfs(entities: Entity[]): string {
    const etfs = entities.filter((e) => getEntityUrlType(e) === "etf");
    return buildSitemap(
        etfs.map((e) => ({
            url: `${BASE_URL}/terminal/etf/${encodeTickerForUrl(e.ticker)}`,
            lastmod: safeISODate(e.lastUpdatedAt),
            changefreq: "daily",
            priority: 0.7,
        })),
    );
}

function genCharts(entities: Entity[]): string {
    return buildSitemap(
        entities.map((e) => ({
            url: `${BASE_URL}/terminal/charts/${encodeTickerForUrl(e.ticker)}`,
            lastmod: safeISODate(e.lastUpdatedAt),
            changefreq: "daily",
            priority: 0.5,
        })),
    );
}

function genNews(entities: Entity[]): string {
    return buildSitemap(
        entities.map((e) => ({
            url: `${BASE_URL}/terminal/news/${encodeTickerForUrl(e.ticker)}`,
            lastmod: safeISODate(e.lastUpdatedAt),
            changefreq: "daily",
            priority: 0.4,
        })),
    );
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
    console.log("=== Populating KV with sitemaps ===\n");

    // Fetch entities once (the heavy part)
    const entities = await fetchEntities();
    console.log(`\nTotal linkable entities: ${entities.length}\n`);

    const sitemaps: [string, string][] = [
        ["sitemap:/sitemap.xml", genIndex()],
        ["sitemap:/sitemap-static.xml", genStatic()],
        ["sitemap:/sitemap-blog.xml", await genBlog()],
        ["sitemap:/sitemap-exchange.xml", await genExchange()],
        ["sitemap:/sitemap-stocks.xml", genStocks(entities)],
        ["sitemap:/sitemap-etfs.xml", genEtfs(entities)],
        ["sitemap:/sitemap-charts.xml", genCharts(entities)],
        ["sitemap:/sitemap-news.xml", genNews(entities)],
    ];

    for (const [key, xml] of sitemaps) {
        console.log(`\nPutting ${key} (${xml.length} bytes)...`);
        putKV(key, xml);
    }

    console.log("\n=== Done! All sitemaps populated in KV ===");
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
