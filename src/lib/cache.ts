export function xmlResponse(body: string, cacheTtl: number): Response {
    return new Response(body, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": `public, max-age=${cacheTtl}, s-maxage=${cacheTtl}`,
        },
    });
}
