import type { Env, Entity, SitemapEntry } from "../types";
import { buildSitemap } from "../lib/xml";

const LINKABLE_TYPES = new Set(["public_company", "stock", "etf"]);

function isEntityLinkable(entity: Entity): boolean {
    return (
        LINKABLE_TYPES.has(entity.entitySubType ?? "") ||
        LINKABLE_TYPES.has(entity.entityClass ?? "")
    );
}

function getEntityUrlType(entity: Entity): "stock" | "etf" {
    if (entity.entityClass === "etf" || entity.entitySubType === "etf") {
        return "etf";
    }
    return "stock";
}

let cachedEntities: Entity[] | null = null;
let cacheTimestamp = 0;
const ENTITY_CACHE_MS = 60 * 60 * 1000; // 1 hour in-memory cache

async function fetchEntities(env: Env): Promise<Entity[]> {
    const now = Date.now();
    if (cachedEntities && now - cacheTimestamp < ENTITY_CACHE_MS) {
        return cachedEntities;
    }

    try {
        const allEntities: Entity[] = [];
        let page = 1;
        const limit = 250;
        let totalPages = 1;

        while (page <= totalPages) {
            const response = await fetch(
                `${env.ENTITIES_API_URL}/entities/paginated`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": "RoxomSitemapWorker/1.0",
                    },
                    body: JSON.stringify({
                        page,
                        limit,
                        sortBy: "ticker",
                        sortOrder: "asc",
                    }),
                },
            );

            if (!response.ok) {
                console.error(
                    `Failed to fetch entities page ${page}: ${response.status}`,
                );
                return cachedEntities ?? [];
            }

            const data = (await response.json()) as {
                success: boolean;
                data: {
                    entities: Entity[];
                    pagination: {
                        page: number;
                        limit: number;
                        total: number;
                        totalPages: number;
                    };
                };
            };

            allEntities.push(...data.data.entities);
            totalPages = data.data.pagination.totalPages;
            page++;
        }

        cachedEntities = allEntities.filter(isEntityLinkable);
        cacheTimestamp = now;

        return cachedEntities;
    } catch (error) {
        console.error("Failed to fetch entities:", error);
        return cachedEntities ?? [];
    }
}

export async function generateStocksSitemap(env: Env): Promise<string> {
    const entities = await fetchEntities(env);
    const stocks = entities.filter((e) => getEntityUrlType(e) === "stock");

    const entries: SitemapEntry[] = stocks.map((entity) => ({
        url: `${env.BASE_URL}/terminal/stock/${encodeTickerForUrl(entity.ticker)}`,
        lastmod: entity.lastUpdatedAt
            ? new Date(entity.lastUpdatedAt).toISOString()
            : undefined,
        changefreq: "daily",
        priority: 0.7,
    }));

    return buildSitemap(entries);
}

export async function generateEtfsSitemap(env: Env): Promise<string> {
    const entities = await fetchEntities(env);
    const etfs = entities.filter((e) => getEntityUrlType(e) === "etf");

    const entries: SitemapEntry[] = etfs.map((entity) => ({
        url: `${env.BASE_URL}/terminal/etf/${encodeTickerForUrl(entity.ticker)}`,
        lastmod: entity.lastUpdatedAt
            ? new Date(entity.lastUpdatedAt).toISOString()
            : undefined,
        changefreq: "daily",
        priority: 0.7,
    }));

    return buildSitemap(entries);
}

export async function generateChartsSitemap(env: Env): Promise<string> {
    const entities = await fetchEntities(env);

    const entries: SitemapEntry[] = entities.map((entity) => ({
        url: `${env.BASE_URL}/terminal/charts/${encodeTickerForUrl(entity.ticker)}`,
        lastmod: entity.lastUpdatedAt
            ? new Date(entity.lastUpdatedAt).toISOString()
            : undefined,
        changefreq: "daily",
        priority: 0.5,
    }));

    return buildSitemap(entries);
}

export async function generateNewsSitemap(env: Env): Promise<string> {
    const entities = await fetchEntities(env);

    const entries: SitemapEntry[] = entities.map((entity) => ({
        url: `${env.BASE_URL}/terminal/news/${encodeTickerForUrl(entity.ticker)}`,
        lastmod: entity.lastUpdatedAt
            ? new Date(entity.lastUpdatedAt).toISOString()
            : undefined,
        changefreq: "daily",
        priority: 0.4,
    }));

    return buildSitemap(entries);
}

function encodeTickerForUrl(ticker: string): string {
    // Dots in tickers need encoding to prevent path interpretation
    return encodeURIComponent(ticker);
}
