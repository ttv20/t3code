package expo.modules.t3agentnotifications

import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class T3AgentNotificationsModule : Module() {
  private val completionGraceHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("T3AgentNotifications")

    AsyncFunction("waitForCompletionGrace") { delayMs: Double, promise: Promise ->
      completionGraceHandler.postDelayed({ promise.resolve(null) }, delayMs.toLong().coerceAtLeast(0))
    }

    OnDestroy {
      completionGraceHandler.removeCallbacksAndMessages(null)
    }

    Function("configure") {
        deviceId: String,
        userId: String,
        scheme: String,
        ongoingEnabled: Boolean
      ->
      appContext.reactContext?.let {
        AgentNotifications.configure(it, deviceId, userId, scheme, ongoingEnabled)
      }
    }

    Function("clear") {
      appContext.reactContext?.let { AgentNotifications.clear(it) }
    }

    Function("showShowcaseActivity") { scheme: String, data: Map<String, String> ->
      appContext.reactContext?.let { AgentNotifications.showcase(it, scheme, data) }
    }

    Function("setThreadOnScreen") { path: String? ->
      AgentNotifications.setThreadOnScreen(path)
    }

    Function("openLiveUpdateSettings") {
      val context = appContext.reactContext
      if (context == null || Build.VERSION.SDK_INT < 36) {
        false
      } else {
        try {
          context.startActivity(
            Intent(Settings.ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS)
              .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          )
          true
        } catch (_: ActivityNotFoundException) {
          false
        }
      }
    }
  }
}
