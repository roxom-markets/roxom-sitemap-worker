import type { SitemapEntry } from "../types";

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

export function buildSitemapIndex(sitemapUrls: string[]): string {
    const entries = sitemapUrls
        .map(
            (url) =>
                `  <sitemap>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${new Date().toISOString()}</lastmod>\n  </sitemap>`,
        )
        .join("\n");

    return `${XML_HEADER}
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

export function buildSitemap(entries: SitemapEntry[]): string {
    const urls = entries
        .map((entry) => {
            let url = `  <url>\n    <loc>${escapeXml(entry.url)}</loc>`;
            if (entry.lastmod) {
                url += `\n    <lastmod>${entry.lastmod}</lastmod>`;
            }
            if (entry.changefreq) {
                url += `\n    <changefreq>${entry.changefreq}</changefreq>`;
            }
            if (entry.priority !== undefined) {
                url += `\n    <priority>${entry.priority.toFixed(1)}</priority>`;
            }
            url += "\n  </url>";
            return url;
        })
        .join("\n");

    return `${XML_HEADER}
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
