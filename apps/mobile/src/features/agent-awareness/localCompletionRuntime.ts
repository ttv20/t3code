import { enabledEnvironmentIds } from "@t3tools/client-runtime/state/connections";
import { isShownUnderParent } from "@t3tools/client-runtime/state/threads";
import { EnvironmentId, type OrchestrationV2ThreadShell } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { environmentCatalog } from "../../connection/catalog";
import { appAtomRegistry } from "../../state/atom-registry";
import { mobilePreferencesAtom } from "../../state/preferences";
import { environmentPresentations } from "../../state/presentation";
import { serverEnvironment } from "../../state/server";
import { environmentShell } from "../../state/shell";
import { environmentThreadShells } from "../../state/threads";
import { readUiTranslator } from "../../state/ui-language";
import {
  createLocalCompletionNotifications,
  localCompletionAllowed,
  localCompletionThread,
  presentLocalCompletionNotification,
  type LocalCompletionThread,
} from "./localCompletionNotifications";
import { hasAgentAwarenessPushRegistration } from "./remoteRegistration";

export function installLocalCompletionNotifications(): () => void {
  if (Platform.OS !== "android") return () => undefined;
  let disposed = false;
  const subscriptions = new Map<EnvironmentId, () => void>();
  const canNotify = (environmentId: string) => {
    const preferences = appAtomRegistry.get(mobilePreferencesAtom);
    const env = EnvironmentId.make(environmentId);
    return (
      !disposed &&
      localCompletionAllowed({
        appState: AppState.currentState,
        enabled:
          AsyncResult.isSuccess(preferences) &&
          preferences.value.localCompletionNotificationsEnabled !== false,
        connected:
          appAtomRegistry.get(environmentPresentations.presentationAtom(env))?.connection.phase ===
          "connected",
        pushRegistered: hasAgentAwarenessPushRegistration(),
        publishesActivity: appAtomRegistry.get(serverEnvironment.configValueAtom(env))?.environment
          .capabilities.agentActivityPublishing,
      })
    );
  };
  const present = (environmentId: string, thread: LocalCompletionThread) => {
    const env = EnvironmentId.make(environmentId);
    return presentLocalCompletionNotification({
      thread,
      current: () => {
        const shell = appAtomRegistry.get(environmentShell.stateValueAtom(env));
        const raw = Option.isSome(shell.snapshot)
          ? shell.snapshot.value.threads.find((candidate) => candidate.id === thread.id)
          : undefined;
        return {
          generation: shell.generation,
          live: shell.status === "live",
          thread: raw ? localCompletionThread(env, raw) : undefined,
        };
      },
      canNotify: () => canNotify(environmentId),
      permitted: async () => (await Notifications.getPermissionsAsync()).granted,
      configureChannel: async () => {
        await Notifications.setNotificationChannelAsync("agent-alerts", {
          name: readUiTranslator()("Agent alerts"),
          importance: Notifications.AndroidImportance.HIGH,
        });
      },
      schedule: async (latest) => {
        await Notifications.scheduleNotificationAsync({
          identifier: JSON.stringify(["local-completion", environmentId, latest.id, latest.runId]),
          content: {
            title: readUiTranslator()("Thread completed"),
            body: latest.title,
            sound: "default",
            data: {
              localCompletion: true,
              environmentId,
              threadId: latest.id,
              deepLink: `/threads/${encodeURIComponent(environmentId)}/${encodeURIComponent(latest.id)}`,
            },
          },
          trigger: { channelId: "agent-alerts" },
        });
      },
    });
  };
  const tracker = createLocalCompletionNotifications({
    canNotify,
    notify: (environmentId, thread) => {
      void present(environmentId, thread).catch((error) =>
        console.warn("Could not show local completion notification.", error),
      );
    },
  });
  const watch = (environmentId: EnvironmentId) => {
    let previous = new Map<
      string,
      { raw: OrchestrationV2ThreadShell; observation: LocalCompletionThread }
    >();
    return appAtomRegistry.subscribe(
      environmentShell.stateValueAtom(environmentId),
      (shell) => {
        const delegated = appAtomRegistry.get(environmentThreadShells.delegatedUnderParentAtom);
        const next = new Map<
          string,
          { raw: OrchestrationV2ThreadShell; observation: LocalCompletionThread }
        >();
        tracker.observe(environmentId, {
          generation: shell.generation,
          live: shell.status === "live",
          threads: Option.isSome(shell.snapshot)
            ? shell.snapshot.value.threads
                .filter(
                  (thread) =>
                    !isShownUnderParent(
                      { environmentId, threadId: thread.id },
                      thread.lineage,
                      delegated,
                    ),
                )
                .map((raw) => {
                  const prior = previous.get(raw.id);
                  const observation =
                    prior?.raw === raw
                      ? prior.observation
                      : localCompletionThread(environmentId, raw);
                  next.set(raw.id, { raw, observation });
                  return observation;
                })
            : [],
        });
        previous = next;
      },
      { immediate: true },
    );
  };
  const unsubscribe = appAtomRegistry.subscribe(
    environmentCatalog.catalogValueAtom,
    (catalog) => {
      const ids = new Set(enabledEnvironmentIds(catalog));
      for (const [environmentId, close] of subscriptions)
        if (!ids.has(environmentId)) {
          close();
          subscriptions.delete(environmentId);
          tracker.forget(environmentId);
        }
      for (const environmentId of ids)
        if (!subscriptions.has(environmentId))
          subscriptions.set(environmentId, watch(environmentId));
    },
    { immediate: true },
  );
  return () => {
    disposed = true;
    unsubscribe();
    for (const close of subscriptions.values()) close();
    subscriptions.clear();
    tracker.dispose();
  };
}
