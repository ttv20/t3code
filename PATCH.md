# Local fork patches

GitHub Actions publishes a self-contained Linux x64 nightly from `patched`.
The archive and built-in updater use `ttv20/t3code` instead of the upstream
release repository.

## Mobile web controls

- The upstream responsive chat-header action menu is used at phone widths.
- **Open in editor** is hidden at phone widths because mobile browsers cannot use the local desktop-editor action reliably.
- Project scripts and Git actions remain in the upstream menu. Desktop header controls are unchanged.
- Attachment picking uses upstream T3's file picker and upload flow.

## Provider usage limits

- The composer shows the selected Codex or Claude account's weekly percentage beside its primary actions.
- The indicator reads upstream's provider usage-limit snapshot and adds no separate polling or persistence. Upstream refreshes provider status on its configured interval and from live turn events.
- Its hover card shows the account email, remaining percentage, reset time, last-check time, and a manual refresh action. Manual refresh uses upstream's targeted provider refresh.
- Upstream's `/usage-limits` feature remains available for full quota details and account/environment aggregation.

## Web chat bidirectional text

- Web chat messages use one direction for the whole Markdown message. T3 counts RTL and LTR letters across the full message and uses whichever type is more common; punctuation, digits, whitespace, backtick code spans, and hidden Markdown link destinations do not determine direction.
- While an answer streams, its direction changes only when the other script gains a clear lead. Once streaming ends, the exact majority wins.
- Markdown lists and quote bars inherit the message direction and use logical start-side gutters. Inline and fenced code remain explicitly left-to-right and isolated.
- The prompt editor and thread-title fields use automatic plaintext bidi behavior. Thread titles also render with automatic direction in the chat header, sidebar, search results, and tooltips.
- This patch applies only to the web client; the native mobile app is unchanged.

## Finished-thread entry position

- Opening a web chat whose latest turn is no longer running positions the viewport at the latest user message instead of the end of the assistant answer. A 24px top offset keeps the message below the top overlay.
- Active turns retain upstream's initial scroll-to-end and live-follow behavior.
- Saved reading positions and citation navigation retain priority over the normal entry position.

## Retired local patches

- The custom Codex weekly usage RPC, polling, and cache were replaced by upstream usage-limit state.
- `/btw` side questions were intentionally removed during the Sep 3 upstream update because they are no longer used.
- Startup reconciles the exact migration IDs reused by old `/btw` builds before upstream migrations run. This lets existing fork databases receive the current upstream schema once and then retain canonical migration history.
- The local ImageView click-to-panel patch was replaced by upstream's richer web and mobile viewed-image rendering.
- The local image-only mobile-web picker was replaced by upstream's general attachment picker.
- The local completion chime was removed in favor of upstream thread notifications and sounds.
