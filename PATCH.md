# Local fork patches

## Mobile web controls

- At phone widths, the chat header replaces the separate project-action and Git controls with one **Project actions** (`…`) popover.
- **Open in editor** is hidden at phone widths because mobile browsers cannot use the local desktop-editor action reliably.
- Project scripts and Git actions remain available in the combined popover. Desktop header controls are unchanged.
- Attachment picking uses upstream T3's file picker and upload flow.

## Codex weekly usage

- Codex threads show the remaining percentage for the longest account rate-limit window beside the context-window ring.
- T3 reads the native Codex app-server `account/rateLimits/read` response, the same account data surfaced by Codex `/status`.
- The indicator refreshes immediately and every 10 minutes. Its hover card shows the account email, remaining percentage, reset time, exact last-check time, and a **Refresh now** control.
- Successful reads are cached in server memory for 10 minutes per Codex provider account. **Refresh now** bypasses the cache.
- Usage reads never recover a dormant thread. With no live Codex session, refresh fails quietly and retains the last displayed value.
- Other providers do not show the indicator.

## Web chat bidirectional text

- Web chat messages use one direction for the whole Markdown message. T3 counts RTL and LTR letters across the full message and uses whichever type is more common; punctuation, digits, and whitespace do not determine direction.
- While an answer streams, its direction changes only when the other script gains a clear lead. Once streaming ends, the exact majority wins.
- Markdown lists inherit the message direction and use logical start-side gutters. Inline and fenced code remain explicitly left-to-right and isolated.
- The prompt editor and thread-title fields use automatic plaintext bidi behavior. Thread titles also render with automatic direction in the chat header, sidebar, search results, and tooltips.
- This patch applies only to the web client; the native mobile app is unchanged.

## Finished-thread entry position

- Opening a web chat whose latest turn is no longer running positions the viewport at the latest user message instead of the end of the assistant answer. A 24px top offset keeps the message below the top overlay.
- Active turns retain upstream's initial scroll-to-end and live-follow behavior.
- Citation navigation retains priority over the normal entry position.

## Retired local patches

- `/btw` side questions were intentionally removed during the Sep 3 upstream update because they are no longer used.
- Migration 48 reapplies upstream's migration 44 data correction. Older local databases recorded the removed `/btw` table as migration 44, so Effect would otherwise skip upstream's migration with the same ID.
- The local ImageView click-to-panel patch was replaced by upstream's richer web and mobile viewed-image rendering.
- The local image-only mobile-web picker was replaced by upstream's general attachment picker.
