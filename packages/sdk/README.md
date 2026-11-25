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

The key is publishable and must not be treated as a server secret. Do not include sensitive personal data in event properties. Call shutdown before a controlled application teardown when possible.
