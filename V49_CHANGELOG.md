# Gold Alert Pro v49.0.0

- Changed the default Iranian 18k gold page to the primary `www.tgju.org` profile URL, retaining the `gem.tgju.org` URL as a fallback.
- The Iran 18k provider now tries both distinct configured/default endpoints, validates the parsed price, and reports per-host failures instead of failing on the first endpoint.
- Polling now logs which provider (Iran 18k, global gold, dollar, or coins) failed, making deployment diagnostics actionable.
- No API keys or secrets are included. Configure provider URLs and credentials through deployment environment variables.
