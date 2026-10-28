# Local fork patches

GitHub Actions publishes a self-contained Linux x64 nightly from `patched`.
The release includes the self-contained Linux x64 CLI plus unsigned Linux x64
and Windows x64 desktop clients. The archives and built-in updater use
`ttv20/t3code` instead of the upstream release repository.

Each release also attaches `t3-<version>-linux-x64.tgz` for direct npm or Bun installation from its GitHub asset URL. It contains the same executable, web UI, and bundled native dependencies as the standalone archive, without depending on upstream's registry packages.

## In-app server updates

- Upstream's sidebar **Update everything** popup is retained. Its standalone-server publication check uses this fork's GitHub release assets instead of upstream npm, refreshing every five minutes. It updates providers first, remote servers next, and the local desktop app last.
- Web and desktop **Settings → Connections** can check GitHub for newer fork releases even when the bundled client and server have identical versions. The primary machine has a **Check for updates** button; connected remote machines have the same action as a refresh icon.
- Checks preserve the server's nightly/stable/preview channel and never offer a downgrade. Native mobile uses the same release lookup through its existing environment maintenance screen.
- Installing uses upstream's remote self-update, progress, reconnect, and optional thread continuation. Settings actions show a confirmation popup naming the destination machine, version, install method, and restart impact; a missing popup host cancels rather than silently installing. These actions update T3 Code only, not provider CLIs.
- Hosts without remote self-update retain upstream's installation-aware manual action: a proven global npm install gets an update command for its existing prefix, and npx/pnpm-dlx/bunx hosts get a matching relaunch command. Managed standalone services and desktop hosts retain their own update paths; checking for a release does not migrate an installation. Release-check failures are not shown as "Up to date".

## Telemetry

- Anonymous PostHog product analytics are opt-in in this fork. Set `T3CODE_TELEMETRY_ENABLED=true` to enable them.
- Personal desktop builds do not embed upstream's remote OTLP tracing configuration. Local diagnostic traces remain available on the machine.

## Mobile web controls

- Upstream V2's thread-details panel groups workspace, script, and Git actions.
- **Open in editor** is hidden at phone widths because mobile browsers cannot use the local desktop-editor action reliably.
- Project scripts and Git actions remain in the upstream thread-details panel.
- Attachment picking uses upstream T3's file picker and upload flow.

## Provider usage limits

- The web and desktop composer shows the selected account's reported five-hour and seven-day limits as two miniature meters in its original bottom spacing. Each meter includes a progress bar, used percentage, and minute-updated reset countdown. Usage above 80% is red.
- The indicator reads upstream's provider usage-limit snapshot and adds no separate polling or persistence. Upstream refreshes provider status on its configured interval and from live turn events.
- Clicking the meters opens the account email, every reported usage window, exact reset times, last-check time, and a manual refresh action. Available reset credits can be redeemed through the existing permission checks and confirmation dialog. Manual refresh uses upstream's targeted provider refresh.
- Upstream's `/usage-limits` feature remains available for full quota details and account/environment aggregation.

## Android local completion notifications

- Settings → Notifications can enable local completion alerts without signing in or configuring T3 Connect or Firebase. Notifications require Android's permission.
- While the app receives live updates in the background, a completed turn can show a notification that opens its thread. The notification title follows the interface language; the thread title retains its original text.
- Initial snapshots and reconnections do not replay old completions. Active-app viewing, interrupted work, and environments already covered by registered push delivery do not produce duplicate local alerts.
- This uses the existing connection. It does not keep Android awake or guarantee delivery after Android pauses the app or its connection.

## Interface translation and direction

- Web, desktop, and native mobile share English, Hebrew, Arabic, and Persian translation catalogs. New installations follow the browser or device language; language and direction preferences are saved per client. An explicit LTR or RTL preference overrides the language's automatic layout direction.
- Interface actions use translated templates, including dynamic dialog titles, thread and draft menus, snooze choices, provider update notifications, pairing explanations and permission descriptions. Project names, branch names, terminal names, paths, and conversation content retain their original values.
- Dates and relative times follow the interface language. Scheduling keeps the Gregorian calendar in every language so the displayed day agrees with the server's date.
- Web and desktop use generated RTLCSS styles and direction-aware controls for menus, dialogs, and portals. Technical text, including code, diffs, terminals, paths, and filename segments, keeps its LTR order. Empty provider configuration path fields also display their placeholders LTR.
- Native mobile passes the selected direction to Android Compose controls, mirrors settings navigation and menu arrows, and aligns settings labels with the interface. Chat-list titles choose their alignment with the shared 30% RTL-letter threshold. Code previews, source files, and command output stay LTR. Android navigation labels and scratch-project labels use the shared translations without translating project names or sample terminal output.
- Native Markdown paragraphs and list entries use the same 30% RTL-word rule as the web, including English product names before Hebrew prose. Appearance settings offer separate chat text size and line height, with a multiline preview. Custom line height stays fixed when the font size changes, with a minimum that prevents clipped text. While editing, the native composer uses a full-width draft above its controls, grows to six lines, and offers further expansion. Its footer shows reported context usage and the selected account’s five-hour/seven-day limits.
- Command input adornments follow the interface direction independently of the text being entered. Project previews isolate names and paths, and keyboard hints wrap within narrow dialogs.

Translation scope and the reasons behind these choices are recorded in [Translation decisions](TRANSLATION_DECISIONS.md).

## Web and desktop chat bidirectional text

- Web and desktop use upstream's per-block word-based direction detection for chat Markdown and the prompt editor. A paragraph, heading, list, quote, or table is RTL when at least 30% of its words start with an RTL letter. Words without letters and inline code do not vote; code blocks stay LTR. Blocks choose direction independently of the interface language and other blocks.
- Lists and quotes share their block's direction, including markers, checkboxes, and quote bars. Empty editor paragraphs continue the preceding paragraph's direction, and keyboard navigation follows the caret's block, including navigation across inline code.
- Thread titles retain automatic direction in the header, sidebar, command palette, search results, rename fields, and tooltips.
- Pending question cards and answer choices retain the shared 30% RTL-letter threshold. Choice rows mirror their text and shortcut/checkmark placement for RTL; collapsed previews preserve the question's direction.
- Timeline navigation previews resolve the user message and assistant answer directions separately and apply the same sentence-boundary correction as rendered Markdown.
- In RTL prose, adjacent Latin words or numbers separated by sentence punctuation or a colon receive a display-only RLM before the next segment. This also works across emphasis and link labels; code and link destinations remain unchanged. The shared sentence-boundary helper also runs in native mobile Markdown. The web layout and preview fixes above do not imply identical native mobile layouts.

## Finished-thread entry position

- Opening a web chat whose latest turn is no longer running positions the viewport at the latest user message instead of the end of the assistant answer. A 24px top offset keeps the message below the top overlay.
- Active turns retain upstream's initial scroll-to-end and live-follow behavior.
- Saved reading positions and citation navigation retain priority over the normal entry position.

## Retired local patches

- The custom Codex weekly usage RPC, polling, and cache were replaced by upstream usage-limit state.
- `/btw` side questions were intentionally removed during the Sep 3 upstream update because they are no longer used.
- The old `/btw` migration compatibility shim was removed after the sole user's database was verified to have canonical upstream migration entries.
- The local ImageView click-to-panel patch was replaced by upstream's richer web and mobile viewed-image rendering.
- The local image-only mobile-web picker was replaced by upstream's general attachment picker.
- The local completion chime was removed in favor of upstream thread notifications and sounds.
