# ADR-0002 — Cloudflare Worker access to the geographic resolver

**Decision.** The planned incident-location endpoint will use a request-scoped node-postgres connection through a Cloudflare Hyperdrive binding to the PostGIS origin. Hyperdrive pools the upstream connections. The Worker will use a Node-compatible Workers runtime, call the existing parameterized resolver, and release the connection at the end of the request. Disable query caching on this binding so withdrawals of verified boundaries take effect on the next lookup. [Cloudflare PostgreSQL integration](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/)

Configure Hyperdrive's origin login with membership in ekiti_location_reader and TLS to the database. That role has schema usage and execute access to geo.location_candidates. Migrations and imports use a separate owner credential. The browser sends only the confirmed incident position to the Worker and receives the reconciled result. Keep database credentials and binding access server-side and exclude coordinates from request logs.

This decision covers transport for the future endpoint. Staging must exercise the Worker binding, input validation, rate limits and database permissions before public intake. Local PostGIS tests exercise the same restricted SQL function.
