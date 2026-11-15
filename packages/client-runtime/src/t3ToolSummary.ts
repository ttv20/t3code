import { createUiTranslator, type UiLocale, type UiMessageValues } from "./i18n.ts";
import type { T3McpToolSummaryAction } from "@t3tools/shared/t3McpToolPresentation";

export interface T3ToolSummaryCall {
  readonly input: unknown;
  readonly output: unknown;
  readonly outcome: "completed" | "failed" | "unfinished";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function id(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

interface ToolResult {
  readonly data?: Record<string, unknown>;
  readonly failed: boolean;
}

function readResult(value: unknown, depth = 0): ToolResult {
  if (depth > 4) return { failed: false };
  if (typeof value === "string") {
    try {
      return readResult(JSON.parse(value), depth + 1);
    } catch {
      return { failed: false };
    }
  }
  if (Array.isArray(value)) {
    let data: ToolResult["data"];
    let failed = false;
    for (const block of value) {
      const record = asRecord(block);
      const text = record?.text ?? asRecord(record?.content)?.text;
      const result = readResult(asRecord(text)?.text ?? text, depth + 1);
      data ??= result.data;
      failed ||= result.failed;
    }
    return { ...(data ? { data } : {}), failed };
  }
  const record = asRecord(value);
  if (!record) return { failed: false };
  const failed =
    record.isError === true ||
    record.is_error === true ||
    (typeof record._tag === "string" && /(?:Error|Failure)$/.test(record._tag)) ||
    record.error != null;
  const content = record.structuredContent ?? record.content;
  if (content !== undefined) {
    const result = readResult(content, depth + 1);
    return { ...(result.data ? { data: result.data } : {}), failed: failed || result.failed };
  }
  return { data: record, failed };
}

function readInput(value: unknown): Record<string, unknown> | undefined {
  const input = readResult(value).data;
  // Historical Cursor items retain the MCP args envelope.
  return input && typeof input.toolName === "string" ? asRecord(input.args) : input;
}

/** MCP errors can be returned as data even when the provider completed the tool call. */
export function t3ToolResultIndicatesFailure(output: unknown): boolean {
  return readResult(output).failed;
}

function countEntities(ids: ReadonlyArray<string | undefined>): number {
  return (
    new Set(ids.filter((value) => value !== undefined)).size +
    ids.filter((value) => value === undefined).length
  );
}

/** One PR per single call; a batch counts what its result reports. */
function pullRequestCount(
  calls: ReadonlyArray<{
    readonly input: Record<string, unknown> | undefined;
    readonly output: Record<string, unknown> | undefined;
  }>,
  countKey: "linkedCount" | "unlinkedCount",
): number | null {
  let count = 0;
  for (const call of calls) {
    const reported = call.output?.[countKey];
    if (typeof reported === "number") count += reported;
    else if (call.input?.url !== undefined || call.input?.number !== undefined) count += 1;
    // A batch result too large to compact loses its count, so the label drops the number.
    else return null;
  }
  return count;
}

export function summarizeT3ToolCalls(
  action: T3McpToolSummaryAction,
  calls: ReadonlyArray<T3ToolSummaryCall>,
  locale: UiLocale = "en",
): { label: string; failedCount: number } {
  const results = calls.map((call) => {
    const result = readResult(call.output);
    return {
      input: readInput(call.input),
      output: result.data,
      outcome: result.failed ? ("failed" as const) : call.outcome,
    };
  });
  const completed = results.filter((call) => call.outcome === "completed");
  let failedCount = results.filter((call) => call.outcome === "failed").length;
  const selected = completed.length > 0 ? completed : results;
  const translate = createUiTranslator(locale);
  const phrase = (past: string, attempted: string, values?: UiMessageValues) =>
    translate(completed.length > 0 ? past : attempted, values);
  const entityIds = (key: string) =>
    selected.map((call) => id(call.output?.[key]) ?? id(call.input?.[key]));
  const projectIds = selected.map(
    (call) => id(call.output?.id) ?? id(call.output?.projectId) ?? id(call.input?.projectId),
  );
  const threadIds = selected.map(
    (call) =>
      id(call.output?.threadId) ??
      id(asRecord(call.output?.thread)?.threadId) ??
      id(call.input?.threadId),
  );
  let label: string;
  switch (action) {
    case "thread-send": {
      const messages = countEntities(selected.map((call) => id(call.output?.messageId)));
      const targetsKnown = threadIds.every((value) => value !== undefined);
      const threads = new Set(threadIds).size;
      if (!targetsKnown) {
        label = phrase(
          messages === 1 ? "Sent {0} message" : "Sent {0} messages",
          messages === 1 ? "Tried to send {0} message" : "Tried to send {0} messages",
          { "0": messages },
        );
      } else if (messages === threads && messages > 1) {
        label = phrase("Sent messages to {0} threads", "Tried to send messages to {0} threads", {
          "0": threads,
        });
      } else {
        label = phrase(
          messages === 1
            ? threads === 1
              ? "Sent {0} message to {1} thread"
              : "Sent {0} message to {1} threads"
            : threads === 1
              ? "Sent {0} messages to {1} thread"
              : "Sent {0} messages to {1} threads",
          messages === 1
            ? threads === 1
              ? "Tried to send {0} message to {1} thread"
              : "Tried to send {0} message to {1} threads"
            : threads === 1
              ? "Tried to send {0} messages to {1} thread"
              : "Tried to send {0} messages to {1} threads",
          { "0": messages, "1": threads },
        );
      }
      break;
    }
    case "thread-create": {
      const createdIds: string[] = [];
      const resultsKnown =
        completed.length > 0 &&
        completed.every((call) => {
          const threads = Array.isArray(call.output?.threads) ? call.output.threads : [call.output];
          return threads.every((thread) => {
            const record = asRecord(thread);
            if (record?.status === "rolled_back") return true;
            const threadId = id(record?.threadId);
            if (!threadId) return false;
            createdIds.push(threadId);
            return true;
          });
        });
      label = resultsKnown
        ? translate(new Set(createdIds).size === 1 ? "Created {0} thread" : "Created {0} threads", {
            "0": new Set(createdIds).size,
          })
        : translate(
            selected.length === 1
              ? "Requested thread creation {0} time"
              : "Requested thread creation {0} times",
            { "0": selected.length },
          );
      break;
    }
    case "delegate": {
      const count = countEntities(entityIds("taskId"));
      label = phrase(
        count === 1 ? "Delegated {0} task" : "Delegated {0} tasks",
        count === 1 ? "Tried to delegate {0} task" : "Tried to delegate {0} tasks",
        { "0": count },
      );
      break;
    }
    case "thread-interrupt": {
      const count = countEntities(threadIds);
      label = phrase(
        count === 1
          ? "Requested interrupts for {0} thread"
          : "Requested interrupts for {0} threads",
        count === 1 ? "Tried to interrupt {0} thread" : "Tried to interrupt {0} threads",
        { "0": count },
      );
      break;
    }
    case "workflow-stop": {
      const count = countEntities(entityIds("subagentId"));
      label = phrase(
        count === 1 ? "Requested stops for {0} workflow" : "Requested stops for {0} workflows",
        count === 1 ? "Tried to stop {0} workflow" : "Tried to stop {0} workflows",
        { "0": count },
      );
      break;
    }
    case "task-cancel": {
      const count = countEntities(entityIds("taskId"));
      label = phrase(
        count === 1 ? "Requested cancellation of {0} task" : "Requested cancellation of {0} tasks",
        count === 1 ? "Tried to cancel {0} task" : "Tried to cancel {0} tasks",
        { "0": count },
      );
      break;
    }
    case "schedule-create": {
      const count = countEntities(entityIds("scheduledTaskId"));
      label = phrase(
        count === 1 ? "Scheduled {0} task" : "Scheduled {0} tasks",
        count === 1 ? "Tried to schedule {0} task" : "Tried to schedule {0} tasks",
        { "0": count },
      );
      break;
    }
    case "schedule-update": {
      const count = countEntities(entityIds("scheduledTaskId"));
      label = phrase(
        count === 1 ? "Updated {0} scheduled task" : "Updated {0} scheduled tasks",
        count === 1 ? "Tried to update {0} scheduled task" : "Tried to update {0} scheduled tasks",
        { "0": count },
      );
      break;
    }
    case "schedule-delete": {
      const count = countEntities(entityIds("scheduledTaskId"));
      label = phrase(
        count === 1
          ? "Requested deletion of {0} scheduled task"
          : "Requested deletion of {0} scheduled tasks",
        count === 1 ? "Tried to delete {0} scheduled task" : "Tried to delete {0} scheduled tasks",
        { "0": count },
      );
      break;
    }
    case "schedule-run":
      label = phrase(
        selected.length === 1
          ? "Requested {0} scheduled task run"
          : "Requested {0} scheduled task runs",
        selected.length === 1
          ? "Tried to request {0} scheduled task run"
          : "Tried to request {0} scheduled task runs",
        { "0": selected.length },
      );
      break;
    case "thread-fork":
      label = phrase(
        selected.length === 1 ? "Requested {0} thread fork" : "Requested {0} thread forks",
        selected.length === 1
          ? "Tried to request {0} thread fork"
          : "Tried to request {0} thread forks",
        { "0": selected.length },
      );
      break;
    case "thread-merge":
      label = phrase(
        selected.length === 1 ? "Requested {0} context merge" : "Requested {0} context merges",
        selected.length === 1
          ? "Tried to request {0} context merge"
          : "Tried to request {0} context merges",
        { "0": selected.length },
      );
      break;
    case "thread-update": {
      const count = countEntities(threadIds);
      label = phrase(
        count === 1 ? "Updated {0} thread" : "Updated {0} threads",
        count === 1 ? "Tried to update {0} thread" : "Tried to update {0} threads",
        { "0": count },
      );
      break;
    }
    case "queue-read": {
      const count = countEntities(entityIds("queuedRunId"));
      label = phrase(
        count === 1 ? "Read {0} queued message" : "Read {0} queued messages",
        count === 1 ? "Tried to read {0} queued message" : "Tried to read {0} queued messages",
        { "0": count },
      );
      break;
    }
    case "queue-edit": {
      const count = countEntities(entityIds("queuedRunId"));
      label = phrase(
        count === 1 ? "Edited {0} queued message" : "Edited {0} queued messages",
        count === 1 ? "Tried to edit {0} queued message" : "Tried to edit {0} queued messages",
        { "0": count },
      );
      break;
    }
    case "queue-cancel": {
      const count = countEntities(entityIds("queuedRunId"));
      label = phrase(
        count === 1
          ? "Requested cancellation of {0} queued run"
          : "Requested cancellation of {0} queued runs",
        count === 1 ? "Tried to cancel {0} queued run" : "Tried to cancel {0} queued runs",
        { "0": count },
      );
      break;
    }
    case "queue-reorder": {
      const count = countEntities(entityIds("queuedRunId"));
      label = phrase(
        count === 1 ? "Reordered {0} queued run" : "Reordered {0} queued runs",
        count === 1 ? "Tried to reorder {0} queued run" : "Tried to reorder {0} queued runs",
        { "0": count },
      );
      break;
    }
    case "queue-steer": {
      const count = countEntities(entityIds("queuedRunId"));
      label = phrase(
        count === 1
          ? "Requested steering with {0} queued message"
          : "Requested steering with {0} queued messages",
        count === 1
          ? "Tried to steer with {0} queued message"
          : "Tried to steer with {0} queued messages",
        { "0": count },
      );
      break;
    }
    case "question-read": {
      const count = countEntities(entityIds("requestId"));
      label = phrase(
        count === 1 ? "Read {0} pending question request" : "Read {0} pending question requests",
        count === 1
          ? "Tried to read {0} pending question request"
          : "Tried to read {0} pending question requests",
        { "0": count },
      );
      break;
    }
    case "question-respond": {
      const count = countEntities(entityIds("requestId"));
      label = phrase(
        count === 1
          ? "Answered {0} pending question request"
          : "Answered {0} pending question requests",
        count === 1
          ? "Tried to answer {0} pending question request"
          : "Tried to answer {0} pending question requests",
        { "0": count },
      );
      break;
    }
    case "secret-request":
      label = phrase(
        selected.length === 1 ? "Asked for {0} secret" : "Asked for {0} secrets",
        selected.length === 1 ? "Tried to ask for {0} secret" : "Tried to ask for {0} secrets",
        { "0": selected.length },
      );
      break;
    case "worktree-handoff": {
      const count = countEntities(entityIds("worktreePath"));
      label = phrase(
        count === 1 ? "Handed off to {0} worktree" : "Handed off to {0} worktrees",
        count === 1 ? "Tried to hand off to {0} worktree" : "Tried to hand off to {0} worktrees",
        { "0": count },
      );
      break;
    }
    case "project-read": {
      const count = countEntities(projectIds);
      label = phrase(
        count === 1 ? "Read {0} project" : "Read {0} projects",
        count === 1 ? "Tried to read {0} project" : "Tried to read {0} projects",
        { "0": count },
      );
      break;
    }
    case "project-create": {
      const count = countEntities(projectIds);
      label = phrase(
        count === 1 ? "Registered {0} project" : "Registered {0} projects",
        count === 1 ? "Tried to register {0} project" : "Tried to register {0} projects",
        { "0": count },
      );
      break;
    }
    case "project-update": {
      const count = countEntities(projectIds);
      label = phrase(
        count === 1 ? "Updated {0} project" : "Updated {0} projects",
        count === 1 ? "Tried to update {0} project" : "Tried to update {0} projects",
        { "0": count },
      );
      break;
    }
    case "project-delete": {
      const count = countEntities(projectIds);
      label = phrase(
        count === 1 ? "Deleted {0} project" : "Deleted {0} projects",
        count === 1 ? "Tried to delete {0} project" : "Tried to delete {0} projects",
        { "0": count },
      );
      break;
    }
    case "project-clone": {
      const count = countEntities(entityIds("cwd"));
      label = phrase(
        count === 1 ? "Cloned {0} repository" : "Cloned {0} repositories",
        count === 1 ? "Tried to clone {0} repository" : "Tried to clone {0} repositories",
        { "0": count },
      );
      break;
    }
    case "environment-link":
      label = phrase(
        selected.length === 1 ? "Asked to link {0} environment" : "Asked to link {0} environments",
        selected.length === 1
          ? "Tried to ask to link {0} environment"
          : "Tried to ask to link {0} environments",
        { "0": selected.length },
      );
      break;
    case "environment-unlink": {
      const count = countEntities(entityIds("environmentId"));
      label = phrase(
        count === 1 ? "Forgot {0} linked environment" : "Forgot {0} linked environments",
        count === 1
          ? "Tried to forget {0} linked environment"
          : "Tried to forget {0} linked environments",
        { "0": count },
      );
      break;
    }
    case "attachment-prepare": {
      const count = countEntities(entityIds("attachmentId"));
      label = phrase(
        count === 1 ? "Prepared {0} attachment upload" : "Prepared {0} attachment uploads",
        count === 1
          ? "Tried to prepare {0} attachment upload"
          : "Tried to prepare {0} attachment uploads",
        { "0": count },
      );
      break;
    }
    case "attachment-discard": {
      const count = countEntities(entityIds("attachmentId"));
      label = phrase(
        count === 1 ? "Discarded {0} pending attachment" : "Discarded {0} pending attachments",
        count === 1
          ? "Tried to discard {0} pending attachment"
          : "Tried to discard {0} pending attachments",
        { "0": count },
      );
      break;
    }
    case "watch-pr":
      label = phrase(
        selected.length === 1 ? "Watching {0} pull request" : "Watching {0} pull requests",
        selected.length === 1
          ? "Tried to watch {0} pull request"
          : "Tried to watch {0} pull requests",
        { "0": selected.length },
      );
      break;
    case "unwatch-pr":
      label = phrase(
        selected.length === 1
          ? "Stopped watching {0} pull request"
          : "Stopped watching {0} pull requests",
        selected.length === 1
          ? "Tried to stop watching {0} pull request"
          : "Tried to stop watching {0} pull requests",
        { "0": selected.length },
      );
      break;
    case "read-pr-guide":
      label = phrase(
        selected.length === 1 ? "Read {0} review guide" : "Read {0} review guides",
        selected.length === 1
          ? "Tried to read {0} review guide"
          : "Tried to read {0} review guides",
        { "0": selected.length },
      );
      break;
    case "html-preview":
      label = phrase(
        selected.length === 1 ? "Previewed {0} HTML page" : "Previewed {0} HTML pages",
        selected.length === 1
          ? "Tried to preview {0} HTML page"
          : "Tried to preview {0} HTML pages",
        { "0": selected.length },
      );
      break;
    case "html-render":
      label = phrase(
        selected.length === 1 ? "Rendered {0} HTML page" : "Rendered {0} HTML pages",
        selected.length === 1 ? "Tried to render {0} HTML page" : "Tried to render {0} HTML pages",
        { "0": selected.length },
      );
      break;
    case "send-to-user":
      label = phrase(
        selected.length === 1 ? "Sent {0} message" : "Sent {0} messages",
        selected.length === 1 ? "Tried to send {0} message" : "Tried to send {0} messages",
        { "0": selected.length },
      );
      break;
    case "thread-list":
      label = phrase(
        selected.length === 1 ? "Listed threads {0} time" : "Listed threads {0} times",
        selected.length === 1
          ? "Tried to list threads {0} time"
          : "Tried to list threads {0} times",
        { "0": selected.length },
      );
      break;
    case "task-status":
      label = phrase(
        selected.length === 1 ? "Checked task status {0} time" : "Checked task status {0} times",
        selected.length === 1
          ? "Tried to check task status {0} time"
          : "Tried to check task status {0} times",
        { "0": selected.length },
      );
      break;
    case "background-wait":
      label = phrase(
        selected.length === 1
          ? "Updated background waits {0} time"
          : "Updated background waits {0} times",
        selected.length === 1
          ? "Tried to update background waits {0} time"
          : "Tried to update background waits {0} times",
        { "0": selected.length },
      );
      break;
    case "schedule-list":
      label = phrase(
        selected.length === 1
          ? "Listed scheduled tasks {0} time"
          : "Listed scheduled tasks {0} times",
        selected.length === 1
          ? "Tried to list scheduled tasks {0} time"
          : "Tried to list scheduled tasks {0} times",
        { "0": selected.length },
      );
      break;
    case "thread-configuration":
      label = phrase(
        selected.length === 1
          ? "Checked thread configuration {0} time"
          : "Checked thread configuration {0} times",
        selected.length === 1
          ? "Tried to check thread configuration {0} time"
          : "Tried to check thread configuration {0} times",
        { "0": selected.length },
      );
      break;
    case "thread-configure":
      label = phrase(
        selected.length === 1 ? "Set thread model {0} time" : "Set thread model {0} times",
        selected.length === 1
          ? "Tried to set thread model {0} time"
          : "Tried to set thread model {0} times",
        { "0": selected.length },
      );
      break;
    case "thread-search":
      label = phrase(
        selected.length === 1 ? "Searched threads {0} time" : "Searched threads {0} times",
        selected.length === 1
          ? "Tried to search threads {0} time"
          : "Tried to search threads {0} times",
        { "0": selected.length },
      );
      break;
    case "thread-transfers":
      label = phrase(
        selected.length === 1
          ? "Checked thread transfers {0} time"
          : "Checked thread transfers {0} times",
        selected.length === 1
          ? "Tried to check thread transfers {0} time"
          : "Tried to check thread transfers {0} times",
        { "0": selected.length },
      );
      break;
    case "thread-organize":
      label = phrase(
        selected.length === 1 ? "Organized threads {0} time" : "Organized threads {0} times",
        selected.length === 1
          ? "Tried to organize threads {0} time"
          : "Tried to organize threads {0} times",
        { "0": selected.length },
      );
      break;
    case "queue-list":
      label = phrase(
        selected.length === 1
          ? "Listed queued messages {0} time"
          : "Listed queued messages {0} times",
        selected.length === 1
          ? "Tried to list queued messages {0} time"
          : "Tried to list queued messages {0} times",
        { "0": selected.length },
      );
      break;
    case "question-list":
      label = phrase(
        selected.length === 1
          ? "Listed pending questions {0} time"
          : "Listed pending questions {0} times",
        selected.length === 1
          ? "Tried to list pending questions {0} time"
          : "Tried to list pending questions {0} times",
        { "0": selected.length },
      );
      break;
    case "worktree-list":
      label = phrase(
        selected.length === 1
          ? "Listed workspace branches {0} time"
          : "Listed workspace branches {0} times",
        selected.length === 1
          ? "Tried to list workspace branches {0} time"
          : "Tried to list workspace branches {0} times",
        { "0": selected.length },
      );
      break;
    case "worktree-status":
      label = phrase(
        selected.length === 1
          ? "Checked worktree status {0} time"
          : "Checked worktree status {0} times",
        selected.length === 1
          ? "Tried to check worktree status {0} time"
          : "Tried to check worktree status {0} times",
        { "0": selected.length },
      );
      break;
    case "project-list":
      label = phrase(
        selected.length === 1 ? "Listed projects {0} time" : "Listed projects {0} times",
        selected.length === 1
          ? "Tried to list projects {0} time"
          : "Tried to list projects {0} times",
        { "0": selected.length },
      );
      break;
    case "environment-read":
      label = phrase(
        selected.length === 1
          ? "Checked environment preferences {0} time"
          : "Checked environment preferences {0} times",
        selected.length === 1
          ? "Tried to check environment preferences {0} time"
          : "Tried to check environment preferences {0} times",
        { "0": selected.length },
      );
      break;
    case "environment-update":
      label = phrase(
        selected.length === 1
          ? "Updated environment preferences {0} time"
          : "Updated environment preferences {0} times",
        selected.length === 1
          ? "Tried to update environment preferences {0} time"
          : "Tried to update environment preferences {0} times",
        { "0": selected.length },
      );
      break;
    case "theme-read":
      label = phrase(
        selected.length === 1 ? "Checked themes {0} time" : "Checked themes {0} times",
        selected.length === 1
          ? "Tried to check themes {0} time"
          : "Tried to check themes {0} times",
        { "0": selected.length },
      );
      break;
    case "theme-set":
      label = phrase(
        selected.length === 1 ? "Set the theme {0} time" : "Set the theme {0} times",
        selected.length === 1
          ? "Tried to set the theme {0} time"
          : "Tried to set the theme {0} times",
        { "0": selected.length },
      );
      break;
    case "environment-links":
      label = phrase(
        selected.length === 1
          ? "Listed linked environments {0} time"
          : "Listed linked environments {0} times",
        selected.length === 1
          ? "Tried to list linked environments {0} time"
          : "Tried to list linked environments {0} times",
        { "0": selected.length },
      );
      break;
    case "browser":
      label = phrase(
        selected.length === 1 ? "Used browser {0} time" : "Used browser {0} times",
        selected.length === 1 ? "Tried to use browser {0} time" : "Tried to use browser {0} times",
        { "0": selected.length },
      );
      break;
    case "device":
      label = phrase(
        selected.length === 1 ? "Used device controls {0} time" : "Used device controls {0} times",
        selected.length === 1
          ? "Tried to use device controls {0} time"
          : "Tried to use device controls {0} times",
        { "0": selected.length },
      );
      break;
    case "capabilities":
      label = phrase(
        selected.length === 1
          ? "Checked orchestration capabilities {0} time"
          : "Checked orchestration capabilities {0} times",
        selected.length === 1
          ? "Tried to check orchestration capabilities {0} time"
          : "Tried to check orchestration capabilities {0} times",
        { "0": selected.length },
      );
      break;
    case "thread-read": {
      label = threadIds.every((value) => value !== undefined)
        ? phrase(
            new Set(threadIds).size === 1 ? "Read {0} thread" : "Read {0} threads",
            new Set(threadIds).size === 1
              ? "Tried to read {0} thread"
              : "Tried to read {0} threads",
            { "0": new Set(threadIds).size },
          )
        : phrase(
            selected.length === 1 ? "Read threads {0} time" : "Read threads {0} times",
            selected.length === 1
              ? "Tried to read threads {0} time"
              : "Tried to read threads {0} times",
            { "0": selected.length },
          );
      break;
    }
    case "thread-wait": {
      label = threadIds.every((value) => value !== undefined)
        ? phrase(
            new Set(threadIds).size === 1 ? "Waited on {0} thread" : "Waited on {0} threads",
            new Set(threadIds).size === 1
              ? "Tried to wait on {0} thread"
              : "Tried to wait on {0} threads",
            { "0": new Set(threadIds).size },
          )
        : phrase(
            selected.length === 1 ? "Waited on threads {0} time" : "Waited on threads {0} times",
            selected.length === 1
              ? "Tried to wait on threads {0} time"
              : "Tried to wait on threads {0} times",
            { "0": selected.length },
          );
      break;
    }
    case "link-pr": {
      const count = pullRequestCount(selected, "linkedCount");
      label =
        count === null
          ? phrase("Linked pull requests", "Tried to link pull requests")
          : phrase(
              count === 1 ? "Linked {0} pull request" : "Linked {0} pull requests",
              count === 1 ? "Tried to link {0} pull request" : "Tried to link {0} pull requests",
              { "0": count },
            );
      break;
    }
    case "unlink-pr": {
      const count = pullRequestCount(selected, "unlinkedCount");
      label =
        count === null
          ? phrase("Unlinked pull requests", "Tried to unlink pull requests")
          : phrase(
              count === 1 ? "Unlinked {0} pull request" : "Unlinked {0} pull requests",
              count === 1
                ? "Tried to unlink {0} pull request"
                : "Tried to unlink {0} pull requests",
              { "0": count },
            );
      break;
    }
    case "list-prs":
      label =
        selected.length === 1
          ? phrase("Checked linked pull requests", "Tried to check linked pull requests")
          : phrase(
              selected.length === 1
                ? "Checked linked pull requests {0} time"
                : "Checked linked pull requests {0} times",
              selected.length === 1
                ? "Tried to check linked pull requests {0} time"
                : "Tried to check linked pull requests {0} times",
              { "0": selected.length },
            );
      break;
    case "attachment-send": {
      const messages = new Map<string, (typeof selected)[number]>();
      selected.forEach((call, index) =>
        messages.set(id(call.output?.messageId) ?? `call-${index}`, call),
      );
      const attachmentCount = [...messages.values()].reduce(
        (count, call) =>
          count + (Array.isArray(call.input?.attachments) ? call.input.attachments.length : 0),
        0,
      );
      const countsKnown = [...messages.values()].every(
        (call) => Array.isArray(call.input?.attachments) && call.input.attachments.length > 0,
      );
      const targetsKnown = threadIds.every((value) => value !== undefined);
      const threads = new Set(threadIds).size;
      if (countsKnown) {
        if (!targetsKnown) {
          label = phrase(
            attachmentCount === 1 ? "Sent {0} attachment" : "Sent {0} attachments",
            attachmentCount === 1
              ? "Tried to send {0} attachment"
              : "Tried to send {0} attachments",
            { "0": attachmentCount },
          );
        } else {
          label = phrase(
            attachmentCount === 1
              ? threads === 1
                ? "Sent {0} attachment to {1} thread"
                : "Sent {0} attachment to {1} threads"
              : threads === 1
                ? "Sent {0} attachments to {1} thread"
                : "Sent {0} attachments to {1} threads",
            attachmentCount === 1
              ? threads === 1
                ? "Tried to send {0} attachment to {1} thread"
                : "Tried to send {0} attachment to {1} threads"
              : threads === 1
                ? "Tried to send {0} attachments to {1} thread"
                : "Tried to send {0} attachments to {1} threads",
            { "0": attachmentCount, "1": threads },
          );
        }
      } else if (!targetsKnown) {
        label = phrase(
          selected.length === 1 ? "Sent attachments {0} time" : "Sent attachments {0} times",
          selected.length === 1
            ? "Tried to send attachments {0} time"
            : "Tried to send attachments {0} times",
          { "0": selected.length },
        );
      } else {
        label = phrase(
          threads === 1
            ? selected.length === 1
              ? "Sent attachments to {0} thread {1} time"
              : "Sent attachments to {0} thread {1} times"
            : selected.length === 1
              ? "Sent attachments to {0} threads {1} time"
              : "Sent attachments to {0} threads {1} times",
          threads === 1
            ? selected.length === 1
              ? "Tried to send attachments to {0} thread {1} time"
              : "Tried to send attachments to {0} thread {1} times"
            : selected.length === 1
              ? "Tried to send attachments to {0} threads {1} time"
              : "Tried to send attachments to {0} threads {1} times",
          { "0": threads, "1": selected.length },
        );
      }
      break;
    }
    case "write-pr-guides": {
      // One call writes many guides, and reports a refusal per guide rather than failing.
      const outcomes = selected.flatMap((call) =>
        Array.isArray(call.output?.guides)
          ? call.output.guides.map((guide) => asRecord(guide)?.outcome)
          : [],
      );
      const started = outcomes.filter((outcome) => outcome !== "failed").length;
      const failed = outcomes.length - started;
      failedCount += failed;
      if (outcomes.length === 0) {
        label =
          selected.length === 1
            ? phrase("Started writing review guides", "Tried to start writing review guides")
            : phrase(
                selected.length === 1
                  ? "Started writing review guides {0} time"
                  : "Started writing review guides {0} times",
                selected.length === 1
                  ? "Tried to start writing review guides {0} time"
                  : "Tried to start writing review guides {0} times",
                { "0": selected.length },
              );
      } else if (started === 0) {
        label = translate(
          failed === 1 ? "Could not start {0} review guide" : "Could not start {0} review guides",
          { "0": failed },
        );
      } else if (failed > 0) {
        label = phrase(
          started === 1
            ? "Started {0} review guide, {1} failed"
            : "Started {0} review guides, {1} failed",
          started === 1
            ? "Tried to start {0} review guide, {1} failed"
            : "Tried to start {0} review guides, {1} failed",
          { "0": started, "1": failed },
        );
      } else {
        label = phrase(
          started === 1 ? "Started {0} review guide" : "Started {0} review guides",
          started === 1 ? "Tried to start {0} review guide" : "Tried to start {0} review guides",
          { "0": started },
        );
      }
      break;
    }
  }
  return { label, failedCount };
}
