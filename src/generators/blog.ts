import type { Env } from "../types";

/**
 * Fetches Ghost's sitemap-posts.xml and rewrites URLs from
 * insights.roxom.com/{slug} → roxom.com/insights/{slug}
 */
export async function generateBlogSitemap(env: Env): Promise<string> {
    const response = await fetch(env.GHOST_SITEMAP_URL, {
        headers: { "User-Agent": "RoxomSitemapWorker/1.0" },
        redirect: "follow",
    });

    if (!response.ok) {
        console.error(`Failed to fetch Ghost sitemap: ${response.status}`);
        return buildEmptyBlogSitemap();
    }

    let xml = await response.text();

    // Rewrite Ghost domain URLs to the canonical roxom.com/insights/ path
    xml = xml.replace(
        /https:\/\/insights\.roxom\.com\//g,
        `${env.BASE_URL}/insights/`,
    );

    // Remove Ghost's XSL stylesheet reference (not needed)
    xml = xml.replace(/<\?xml-stylesheet[^?]*\?>\s*/g, "");

    return xml;
}

function buildEmptyBlogSitemap(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
}
