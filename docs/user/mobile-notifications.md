# Mobile notifications

Get push alerts, Live Activities, and home-screen widgets on iOS and Android when agents finish, fail, or need your approval or input.

## Prerequisites

- Sign in to **T3 Connect** on both your phone and host machine (direct/Tailscale connections alone do not deliver background push notifications).
- Enable **Publish agent activity** in **Settings → Sharing & access** on the host.
- Enable **Device Notifications** in **Settings → Notifications** on mobile (Android requires Android 7.0+ and Google Play services).

## Live updates and widgets

- **Live progress**: Enable **Live Activity Updates** (iOS), **Agent Live Updates** (Android 16+, check **Live Update Settings** if missing), or **Ongoing Agent Activity** (older Android). Finished results stay visible for up to 15 minutes.
- **Silent live updates (Android 8+)**: Keep **Ongoing agent activity** on and disable **Agent alerts** in Android system notification settings.
- **iOS widget**: Add the **Agent Activity** widget to your Home Screen or Lock Screen (refreshes when you open T3; marks unfinished work stale after 10 minutes).

## Notes

- Ordinary alerts are muted while the mobile app is in the foreground, though viewing a thread on another device does not silence your phone.
- Force-stopping T3 Code in Android system Settings pauses push delivery until you reopen the app.

## Local completion alerts on Android

Enable **Local completion notifications** in **Settings → Notifications** and allow Android notification permission to receive completion alerts through an active connection. This works with direct and Tailscale connections without signing in to T3 Connect. Tap an alert to open its thread. Opening the thread from the app also clears its alert, including when returning to the thread from the background.

The app must remain connected in the background. If Android blocks background network access, allow background battery usage in Android's settings for T3 Code. Depending on the device, this may be called **Unrestricted** or **Don't optimize**. Alerts stop when Android suspends the app or its connection; reconnecting does not replay earlier completions.
