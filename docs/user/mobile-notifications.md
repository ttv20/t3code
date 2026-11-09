# Mobile notifications

## Push alerts and ongoing activity

Sign in to T3 Connect, link your environments, and enable **Device Notifications** in **Settings → Notifications** to receive alerts when an agent finishes, fails, needs approval, or asks for input. Tap a notification to open its thread. Your environment must have agent activity publishing enabled.

Enable **Live Activity Updates** on iOS, **Agent Live Updates** on Android 16 and newer, or **Ongoing Agent Activity** on older Android versions to follow work without opening the app. Finished results remain visible for up to 15 minutes. You can dismiss an Android activity card without disabling alerts; turn off the same switch to stop future cards.

For activity without ordinary alerts on Android 8 or newer, leave **Ongoing agent activity** enabled and turn off **Agent alerts** in Android's notification settings for T3 Code. Activity updates continue, and the same card shows the finished result without a separate alert. On Android 16 and newer, the finished result remains a Live Update until dismissed or expired. Keep app-wide notification permission and **Live updates** enabled so Android can display it.

On iOS you can also add the **Agent Activity** widget to your Home Screen or Lock Screen. It shows the same agents as the Live Activity, using your T3 Connect sign-in. The widget refreshes when you open T3 and shows unfinished work as out of date after 10 minutes.

Ordinary alerts stay quiet while the mobile app is in the foreground. Ongoing activity continues to update. Viewing a thread on another device does not silence your phone's alerts.

Android push notifications require Android 7.0 or newer and Google Play services. Android 16 and newer can promote ongoing activity to a Live Update, subject to system settings and device support. Other devices show a regular ongoing notification. If Live Updates don't appear on Android 16 or newer, check **Live Update Settings** in T3 Code's **Settings → Notifications**. Android 7's battery-saving modes can delay removal of expired cards.

Notification permission and Android notification channels are controlled in system Settings. Push delivery requires T3 Connect; a direct or Tailscale connection alone does not enable push notifications. The mobile app does not need to maintain a connection to your environment for push delivery. Force-stopping the Android app in system Settings prevents push delivery until you open it again.

## Local completion alerts on Android

Enable **Local completion notifications** in **Settings → Notifications** and allow Android notification permission to receive completion alerts through an active connection. This works with direct and Tailscale connections without signing in to T3 Connect. Tap an alert to open its thread. Opening the thread from the app also clears its alert, including when returning to the thread from the background.

The app must remain connected in the background. If Android blocks background network access, allow background battery usage in Android's settings for T3 Code. Depending on the device, this may be called **Unrestricted** or **Don't optimize**. Alerts stop when Android suspends the app or its connection; reconnecting does not replay earlier completions.
