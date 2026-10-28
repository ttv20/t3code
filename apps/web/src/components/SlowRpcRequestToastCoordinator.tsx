import { useUiLanguage } from "../i18n";
import { currentUiTranslator } from "../currentUiTranslator";
import { createUiTranslator } from "@t3tools/client-runtime/i18n";
import { type SlowRpcAckRequest, subscribeSlowRpcAckRequests } from "../rpc/requestLatencyState";
import { toastManager } from "./ui/toast";

function describeSlowRequests(
  requests: ReadonlyArray<SlowRpcAckRequest>,
  t: ReturnType<typeof createUiTranslator>,
): string {
  const count = requests.length;
  const thresholdSeconds = Math.round(
    Math.min(...requests.map((request) => request.thresholdMs)) / 1000,
  );

  return t(
    count === 1
      ? "{0} request waiting longer than {1}s."
      : "{0} requests waiting longer than {1}s.",
    { "0": count, "1": thresholdSeconds },
  );
}

function SlowRequestDetails({ requests }: { requests: ReadonlyArray<SlowRpcAckRequest> }) {
  const { t: uiT } = useUiLanguage();
  return (
    <ul className="space-y-2.5 text-xs text-muted-foreground">
      {requests.map((request) => (
        <li
          className="min-w-0 border-border/50 border-b pb-2 last:border-b-0 last:pb-0"
          key={request.requestId}
        >
          <div className="wrap-break-word font-medium text-foreground">{request.tag}</div>
          <div className="mt-0.5 text-3xs opacity-75">
            {uiT("Started")} {new Date(request.startedAt).toLocaleTimeString()}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One warning toast that tracks the set of slow requests while any are outstanding. */
export function startSlowRpcRequestToasts(): () => void {
  let toastId: ReturnType<typeof toastManager.add> | null = null;

  const unsubscribe = subscribeSlowRpcAckRequests((slowRequests) => {
    const uiT = currentUiTranslator();
    if (slowRequests.length === 0) {
      if (toastId !== null) {
        toastManager.close(toastId);
        toastId = null;
      }
      return;
    }

    const nextToast = {
      data: {
        expandableContent: <SlowRequestDetails requests={slowRequests} />,
        expandableDescriptionTrigger: true,
        expandableLabels: { collapse: "Hide requests", expand: "Show requests" },
      },
      description: describeSlowRequests(slowRequests, uiT),
      timeout: 0,
      title: uiT("Some requests are slow"),
      type: "warning" as const,
    };

    if (toastId === null) {
      toastId = toastManager.add(nextToast);
    } else {
      toastManager.update(toastId, nextToast);
    }
  });

  return () => {
    unsubscribe();
    if (toastId !== null) toastManager.close(toastId);
  };
}
