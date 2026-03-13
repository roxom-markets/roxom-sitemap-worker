export function xmlResponse(body: string, cacheTtl: number): Response {
    return new Response(body, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": `public, max-age=${cacheTtl}, s-maxage=${cacheTtl}`,
        },
    });
}

export async function withCache(
    request: Request,
    cacheTtl: number,
    generate: () => Promise<string>,
): Promise<Response> {
    const cache = caches.default;
    const cacheKey = new Request(request.url, { method: "GET" });

    const cached = await cache.match(cacheKey);
    if (cached) {
        return cached;
    }

    const body = await generate();
    const response = xmlResponse(body, cacheTtl);

    // Clone before putting in cache (response body can only be read once)
    const responseToCache = response.clone();
    // Don't await — fire and forget to avoid blocking the response
    cache.put(cacheKey, responseToCache);

    return response;
}
