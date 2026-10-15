import { createUiTranslator } from "@t3tools/client-runtime/i18n";
import { useUiLanguage } from "../i18n";
import { useEffect, useRef } from "react";

import { type SlowRpcAckRequest, useSlowRpcAckRequests } from "../rpc/requestLatencyState";
import { toastManager } from "./ui/toast";

function describeSlowRequests(
  requests: ReadonlyArray<SlowRpcAckRequest>,
  t: ReturnType<typeof createUiTranslator>,
): string {
  const count = requests.length;
  // Thresholds vary per method, so report the smallest one the batch has passed.
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

export function SlowRpcRequestToastCoordinator() {
  const { t: uiT } = useUiLanguage();
  const slowRequests = useSlowRpcAckRequests();
  const toastIdRef = useRef<ReturnType<typeof toastManager.add> | null>(null);

  useEffect(() => {
    if (slowRequests.length === 0) {
      if (toastIdRef.current !== null) {
        toastManager.close(toastIdRef.current);
        toastIdRef.current = null;
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

    if (toastIdRef.current === null) {
      toastIdRef.current = toastManager.add(nextToast);
    } else {
      toastManager.update(toastIdRef.current, nextToast);
    }
  }, [slowRequests, uiT]);

  useEffect(
    () => () => {
      if (toastIdRef.current !== null) {
        toastManager.close(toastIdRef.current);
      }
    },
    [],
  );

  return null;
}
