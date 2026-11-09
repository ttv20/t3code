import type { Notification, NotificationResponse } from "expo-notifications";
import * as Schema from "effect/Schema";
import { extractAgentNotificationDeepLink } from "./notificationPayload";

export async function dismissLocalCompletionNotificationsOnScreen(input: {
  readonly threadOnScreen: () => string | null;
  readonly getPresented: () => Promise<ReadonlyArray<Notification>>;
  readonly dismiss: (identifier: string) => Promise<void>;
}): Promise<void> {
  const path = input.threadOnScreen();
  if (path === null) return;
  const presented = await input.getPresented();
  if (input.threadOnScreen() !== path) return;
  await Promise.all(
    presented
      .filter(
        (notification) =>
          notification.request.content.data?.localCompletion === true &&
          extractAgentNotificationDeepLink({ notification }) === path,
      )
      .map((notification) => input.dismiss(notification.request.identifier)),
  );
}

export class NotificationNavigationError extends Schema.TaggedError<NotificationNavigationError>()(
  "NotificationNavigationError",
  {
    operation: Schema.Literals(["read", "route", "clear"]),
    notificationId: Schema.optional(Schema.String),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation} the last notification response.`;
  }
}

export async function consumeLastAgentNotificationResponse(input: {
  readonly getLastResponse: () => Promise<NotificationResponse | null>;
  readonly clearLastResponse: () => Promise<void>;
  readonly handleResponse: (response: NotificationResponse) => void;
}): Promise<void> {
  let response: NotificationResponse | null;
  try {
    response = await input.getLastResponse();
  } catch (cause) {
    console.error(new NotificationNavigationError({ operation: "read", cause }));
    return;
  }

  if (!response) {
    return;
  }

  try {
    input.handleResponse(response);
  } catch (cause) {
    console.error(
      new NotificationNavigationError({
        operation: "route",
        notificationId: response.notification.request.identifier,
        cause,
      }),
    );
    return;
  }

  try {
    await input.clearLastResponse();
  } catch (cause) {
    console.error(
      new NotificationNavigationError({
        operation: "clear",
        notificationId: response.notification.request.identifier,
        cause,
      }),
    );
  }
}
