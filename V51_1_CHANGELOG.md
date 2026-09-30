# Gold Alert Pro v51.1.0

- Prefer the TGJU 18k gold profile page over the generic homepage.
- Add limited retries for transient network failures, timeouts, HTTP 408/425/429, and 5xx responses; HTTP 404 is not retried.
- Prevent malformed history URLs and validate the configured HTTP timeout.
- Align the backend-reported application version with the package version.
- Keep upstream source failures visible; no synthetic or stale quote is presented as a fresh market price.
