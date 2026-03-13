import type { Env, Instrument, SitemapEntry } from "../types";
import { buildSitemap } from "../lib/xml";

let cachedInstruments: Instrument[] | null = null;
let cacheTimestamp = 0;
const CACHE_MS = 60 * 60 * 1000; // 1 hour

async function fetchFuturesInstruments(env: Env): Promise<Instrument[]> {
    const now = Date.now();
    if (cachedInstruments && now - cacheTimestamp < CACHE_MS) {
        return cachedInstruments;
    }

    try {
        const response = await fetch(
            `${env.EXCHANGE_API_URL}/instruments?type=perpetual`,
            { headers: { "User-Agent": "RoxomSitemapWorker/1.0" } },
        );

        if (!response.ok) {
            console.error(
                `Failed to fetch instruments: ${response.status}`,
            );
            return cachedInstruments ?? [];
        }

        const data = (await response.json()) as {
            instruments: Instrument[];
        };
        cachedInstruments = data.instruments.filter((i) => i.active);
        cacheTimestamp = now;

        return cachedInstruments;
    } catch (error) {
        console.error("Failed to fetch instruments:", error);
        return cachedInstruments ?? [];
    }
}

/**
 * Converts instrument symbol to canonical futures URL format.
 * Example: BTC-USD -> BTCUSD
 */
function toCanonicalUrlSymbol(symbol: string): string {
    return symbol.replace("-", "").toUpperCase();
}

export async function generateExchangeSitemap(env: Env): Promise<string> {
    const instruments = await fetchFuturesInstruments(env);

    const entries: SitemapEntry[] = [
        // Static exchange pages
        {
            url: `${env.BASE_URL}/exchange/spot/express`,
            changefreq: "daily",
            priority: 0.8,
        },
    ];

    // Dynamic futures trading pair pages
    for (const instrument of instruments) {
        entries.push({
            url: `${env.BASE_URL}/exchange/futures/${toCanonicalUrlSymbol(instrument.symbol)}`,
            changefreq: "daily",
            priority: 0.8,
        });
    }

    return buildSitemap(entries);
}
