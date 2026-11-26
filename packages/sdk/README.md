# @insight/analytics

Small browser SDK for sending product events to an INSIGHT project.

```ts
import { createInsight } from "@insight/analytics";

const insight = createInsight({
  apiKey: "ia_pub_...",
  endpoint: "https://your-insight-domain.example",
});

insight.identify("user_123");
insight.track("page_view", { path: window.location.pathname });
```

The key is publishable and must not be treated as a server secret. The SDK uses Web Crypto for session and event identifiers and fails closed when secure browser cryptography is unavailable. Event IDs and session IDs are generated with the browser cryptographic random number generator; the SDK does not fall back to Math.random. Do not include sensitive personal data in event properties. Event properties are limited to 20 KB, the in-memory queue to 1,000 events, and each request is split below 220 KB and 100 events. Failed requests are retried with the same idempotency keys. Call shutdown before a controlled application teardown when possible; the queue is in memory and is not persisted across page reloads.
