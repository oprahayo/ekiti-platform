# Ekiti Civic: wider-web references and inner-page search

Ekiti Civic uses one source-grounded, low-data search interface across desktop and mobile. Reviewed Ekiti records and external web results remain visibly separate.

## Implemented

- Search has All results, Places & services, Ekiti information, and Wider web tabs.
- A compact universal search field is available on inner pages, with private report intent directed to the report workflow rather than included in a public search URL.
- The Find public web sources button is opt-in. No external search request occurs simply because someone visits a page.
- GET /api/web-search accepts one short public query, rejects email/phone and obvious personal case text, checks the method and origin, rate limits requests, returns no-store and never accesses the private database.
- The public staging setup enables Wikimedia search through the official MediaWiki REST API without a key. All returned pages are clearly labeled unverified by Ekiti Civic, link to original Wikipedia sources and display provider attribution. Wikipedia excerpts are generally subject to CC BY-SA; consult source page licensing and revision history.
- If a server-held BRAVE_SEARCH_API_KEY is present, Brave Search provides broader indexed web references. This is not the Google index, and Brave credits/pricing and account requirements apply.
- Failure never fabricates content: the visitor can deliberately open Google or Brave search on their own websites.
- After an explicit search, a compact, citation-numbered **Source highlights** panel collects up to three unmodified provider descriptions for easier reading. These are labelled **unverified excerpts**, not an AI-generated answer, with original HTTPS citations. This does not fetch, summarize, or authenticate full page contents.
- Eight hand-drawn, bundled SVG launcher icons; no third-party font or icon CDN.

## Setup

EXTERNAL_WEB_SEARCH_ENABLED=true enables the public on-demand reference endpoint. The guest staging preparation script enables this flag, while continuing to force all private report/evidence flags off.

Optional broader search can be configured by an operator using a Cloudflare Worker secret:
    npx wrangler secret put BRAVE_SEARCH_API_KEY --name ekiti-platform-staging

Do not commit secrets, promise unlimited free searches, or enable secret-backed indexing without reviewing cost and retention. Wikimedia API requires a recognizable user agent, which this integration supplies.

## Limitations and future work

- A web search snippet is not a reviewed civic fact. The interface does not synthesize generative answers from these snippets.
- Source evaluation, retrieval-augmented answer generation, source freshness/credibility, structured SEO content, and the complete town map remain separate acceptance tasks.
- Government report dispatch and actual agency delivery/read receipts require a separate authenticated private release and verified office integration (#42).
- Independent operator: inEkiti Official. A local report draft is not a government submission.

Documentation:
- https://www.mediawiki.org/wiki/API:REST_API/Reference
- https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy
- https://api-dashboard.search.brave.com/documentation/pricing
