export interface Env {
    BASE_URL: string;
    ENTITIES_API_URL: string;
    GHOST_SITEMAP_URL: string;
    CACHE_TTL_SECONDS: string;
    EXCHANGE_API_URL: string;
}

export interface Entity {
    id: string;
    ticker: string;
    tickerRoot: string;
    entityType: string;
    entitySubType?: string;
    entityClass?: string;
    active: boolean;
    isTradeable: boolean;
    lastUpdatedAt: string;
}

export interface Instrument {
    symbol: string;
    type: string;
    active: boolean;
}

export interface SitemapEntry {
    url: string;
    lastmod?: string;
    changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority?: number;
}
