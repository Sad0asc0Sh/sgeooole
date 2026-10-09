import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Markdown content negotiation for the homepage (agent readiness).
 *
 * When an AI agent requests `/` with `Accept: text/markdown`, rewrite to
 * the Markdown representation at /home.md — same canonical URL, Markdown
 * body with `Vary: Accept`. Browsers never send that Accept value, and
 * Next.js internal requests (RSC / prefetch / router state) are excluded,
 * so human traffic and client navigation are completely unaffected.
 */
export function middleware(request: NextRequest) {
  const accept = request.headers.get("accept") || "";
  const wantsMarkdown = accept.includes("text/markdown");
  const isInternalNextRequest =
    request.headers.has("rsc") ||
    request.headers.has("next-router-state-tree") ||
    request.headers.has("next-router-prefetch");

  if (wantsMarkdown && !isInternalNextRequest) {
    const url = request.nextUrl.clone();
    url.pathname = "/home.md";
    const response = NextResponse.rewrite(url);
    response.headers.set("Vary", "Accept");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Homepage only — deliberately the narrowest possible surface.
  matcher: ["/"],
};
