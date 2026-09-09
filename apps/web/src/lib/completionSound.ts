export interface CompletionSoundTurn {
  readonly turnId: string;
  readonly state: "running" | "interrupted" | "completed" | "error";
  readonly completedAt: string | null;
}

export interface CompletionSoundThread {
  readonly key: string;
  readonly latestTurn: CompletionSoundTurn | null;
}

export type CompletionSoundSnapshot = ReadonlyMap<string, CompletionSoundTurn | null>;

export function advanceCompletionSoundSnapshot(
  previous: CompletionSoundSnapshot | null,
  threads: ReadonlyArray<CompletionSoundThread>,
): {
  readonly snapshot: CompletionSoundSnapshot;
  readonly completed: boolean;
} {
  const snapshot = new Map(threads.map((thread) => [thread.key, thread.latestTurn] as const));
  if (previous === null) return { snapshot, completed: false };

  const completed = threads.some((thread) => {
    const current = thread.latestTurn;
    const prior = previous.get(thread.key);
    return (
      current?.state === "completed" &&
      current.completedAt !== null &&
      prior?.turnId === current.turnId &&
      prior.state !== "completed"
    );
  });
  return { snapshot, completed };
}

let completionAudioContext: AudioContext | null = null;

function getCompletionAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (completionAudioContext?.state === "closed") completionAudioContext = null;
  try {
    completionAudioContext ??= new AudioContext();
  } catch {
    return null;
  }
  return completionAudioContext;
}

export function primeCompletionSound(): void {
  const context = getCompletionAudioContext();
  if (context?.state === "suspended") void context.resume().catch(() => undefined);
}

function scheduleBellTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peak: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
  oscillator.addEventListener("ended", () => {
    oscillator.disconnect();
    gain.disconnect();
  });
}

function scheduleCompletionChime(context: AudioContext): void {
  const startAt = context.currentTime + 0.015;
  scheduleBellTone(context, 659.25, startAt, 0.24, 0.065);
  scheduleBellTone(context, 987.77, startAt + 0.105, 0.34, 0.055);
}

export function playCompletionSound(): void {
  const context = getCompletionAudioContext();
  if (context === null) return;
  if (context.state === "running") {
    scheduleCompletionChime(context);
    return;
  }
  if (context.state === "suspended") {
    void context
      .resume()
      .then(() => scheduleCompletionChime(context))
      .catch(() => undefined);
  }
}
