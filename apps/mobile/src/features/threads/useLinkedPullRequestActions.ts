import { useUiLanguage } from "../../i18n";
import {
  pullRequestLinkProject,
  resolveLinkPullRequestInput,
} from "@t3tools/client-runtime/pull-request-link-input";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import {
  canStartThreadPullRequestWatch,
  planThreadPullRequestMutation,
} from "@t3tools/client-runtime/thread-pull-request-compatibility";
import {
  capitalizeTerm,
  sourceControlClients,
} from "@t3tools/client-runtime/source-control-clients";
import { AuthOrchestrationOperateScope, type ThreadPullRequestLink } from "@t3tools/contracts";
import * as Clipboard from "expo-clipboard";

import * as Dialog from "../../components/ui/Dialog";
import { tryOpenExternalUrl } from "../../lib/openExternalUrl";
import type { MenuProps } from "../../components/ui/Menu.types";
import type { EnvironmentRuntimeState } from "../../state/remote-runtime-types";
import { useEnvironmentScope } from "../../state/session";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";

type MenuAction = MenuProps["actions"][number];

export function useLinkedPullRequestActions(input: {
  readonly thread: EnvironmentThreadShell | null;
  readonly project: EnvironmentProject | null;
  readonly runtime: EnvironmentRuntimeState | null;
}) {
  const { t: uiT } = useUiLanguage();
  const { thread, project, runtime } = input;
  const terminology = sourceControlClients.get(project?.repositoryIdentity?.provider).changeRequest;
  const capabilities = runtime?.serverConfig?.environment.capabilities;
  const canOperate = useEnvironmentScope(
    thread?.environmentId ?? null,
    AuthOrchestrationOperateScope,
  );
  const canEdit = canOperate && capabilities !== undefined;
  const canWatch = canOperate && capabilities?.threadPullRequestWatch === true;
  const canStartWatch = canWatch && thread !== null && canStartThreadPullRequestWatch(thread);
  const link = useAtomCommand(threadEnvironment.linkPullRequest, { reportFailure: false });
  const unlink = useAtomCommand(threadEnvironment.unlinkPullRequest, { reportFailure: false });
  const watch = useAtomCommand(threadEnvironment.watchPullRequest, { reportFailure: false });

  const run = async (
    failureTitle: string,
    pending: Promise<AtomCommandResult<unknown, unknown>>,
  ) => {
    const result = await pending;
    if (result._tag === "Success" || isAtomCommandInterrupted(result)) return;
    const cause = squashAtomCommandFailure(result);
    Dialog.alert(failureTitle, cause instanceof Error ? cause.message : "Try again.");
  };

  const setLinked = (
    reference: { host: string; repository: string; number: number; url: string },
    linked: boolean,
  ) => {
    if (thread === null) return;
    const mutation = planThreadPullRequestMutation({
      capabilities,
      threadId: thread.id,
      reference,
      linked,
    });
    if (mutation === null) return;
    const environmentId = thread.environmentId;
    void run(
      linked
        ? `Couldn't link this ${terminology.singular}`
        : `Couldn't unlink this ${terminology.singular}`,
      mutation.type === "thread.pull-request.link"
        ? link({ environmentId, input: mutation.input })
        : unlink({ environmentId, input: mutation.input }),
    );
  };

  const promptLink = () => {
    const { singular } = terminology;
    Dialog.prompt({
      title: uiT("Link {0}", { "0": singular }),
      message: uiT("Paste a {0} URL, or enter 123 / #123 for this thread's repository.", {
        "0": singular,
      }),
      placeholder: uiT("{0} URL or #42", { "0": capitalizeTerm(singular) }),
      initialValue: "",
      confirmText: uiT("Link"),
      onConfirm: (reference) => {
        const resolved = resolveLinkPullRequestInput({
          reference,
          project: pullRequestLinkProject(project?.repositoryIdentity),
          hasProject: () => true,
        });
        if (resolved === null) {
          Dialog.alert(`Couldn't link this ${singular}`, `Use a ${singular} URL, 123, or #123.`);
          return;
        }
        if ("error" in resolved) {
          Dialog.alert(`Couldn't link this ${singular}`, resolved.error);
          return;
        }
        setLinked(resolved.link, true);
      },
    });
  };

  const menuActions = (link: ThreadPullRequestLink): MenuAction[] => {
    const open = link.snapshot === null || link.snapshot.state === "open";
    const watching = link.watch !== undefined;
    return [
      { id: "copy", title: uiT("Copy link"), image: "link" },
      { id: "browser", title: uiT("Open in browser"), image: "safari" },
      ...((watching ? canWatch : canStartWatch) && open
        ? [
            {
              id: "watch",
              title: watching ? uiT("Stop watching") : uiT("Watch for changes"),
              image: watching ? "eye.slash" : "eye",
            },
          ]
        : []),
      ...(canEdit
        ? [
            {
              id: "unlink",
              title:
                link.source === "stack" ? uiT("Dismiss from thread") : uiT("Unlink from thread"),
              image: "xmark",
              attributes: { destructive: true },
            },
          ]
        : []),
    ];
  };

  const onMenuAction = (link: ThreadPullRequestLink, action: string) => {
    if (action === "copy") void Clipboard.setStringAsync(link.url);
    else if (action === "browser")
      void tryOpenExternalUrl(link.url, "pull-request").then((opened) => {
        if (!opened) {
          const { shortLabel, singular } = (
            sourceControlClients.findByChangeRequestUrl(link.url) ??
            sourceControlClients.get(undefined)
          ).changeRequest;
          Dialog.alert(`Unable to open ${shortLabel}`, `The ${singular} could not be opened.`);
        }
      });
    else if (action === "watch" && thread !== null)
      void run(
        "Couldn't change watching",
        watch({
          environmentId: thread.environmentId,
          input: {
            threadId: thread.id,
            host: link.host,
            repository: link.repository,
            number: link.number,
            watching: link.watch === undefined,
          },
        }),
      );
    else if (action === "unlink") setLinked(link, false);
  };

  return { canLink: canEdit, terminology, promptLink, menuActions, onMenuAction };
}

export type LinkedPullRequestActions = ReturnType<typeof useLinkedPullRequestActions>;
