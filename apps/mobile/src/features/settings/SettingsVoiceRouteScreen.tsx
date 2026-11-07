import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { useState } from "react";
import { Linking, Platform, useWindowDimensions, View } from "react-native";
import Reanimated, { ReduceMotion, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { useUiLanguage } from "../../i18n";
import { readUiTranslator } from "../../state/ui-language";

import type { EnvironmentId } from "@t3tools/contracts";
import { type AppSymbolName } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import * as Dialog from "../../components/ui/Dialog";
import { ListActionRow as SettingsActionRow } from "../../components/ui/ListActionRow";
import { ListChoiceRow } from "../../components/ui/ListChoiceRow";
import { ListRowLayout } from "../../components/ui/ListRowLayout";
import { cn } from "../../lib/cn";
import {
  isMicrophoneDevice,
  microphoneEntryKey,
  type MicrophoneEntry,
  type MicrophoneKind,
} from "../../lib/microphonePriority";
import { makePermissionStatusAtom } from "../../lib/permissionStatusAtom";
import { useEnvironments, type EnvironmentPresentation } from "../../state/environments";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { ThreadSwipeable } from "../home/thread-swipe-actions";
import {
  chooseVoiceDestination,
  hasEnvironmentVoiceCapture,
  voiceConnectionAtom,
  voiceGrantAtom,
  voiceSpeechStatusAtom,
} from "../voice-input/voiceDestination";
import {
  deviceMicrophoneOrder,
  localVoiceTranscriberAtom,
} from "../voice-input/VoiceInputProvider";
import { CloudVoiceSection } from "./CloudVoiceSection";
import { SettingsDragHandle } from "./components/SettingsDragHandle";
import { SettingsScreen } from "./components/SettingsScreen";
import { SettingsSection } from "./components/SettingsSection";
import { VoiceModelSection } from "./VoiceModelSection";

type MicrophonePermission = "checking" | "granted" | "ask" | "denied";

function toMicrophonePermission(response: {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}): MicrophonePermission {
  return response.granted ? "granted" : response.canAskAgain ? "ask" : "denied";
}

const readMicrophonePermission = () =>
  getRecordingPermissionsAsync().then(toMicrophonePermission, (): MicrophonePermission => "ask");

const microphonePermissionAtom = makePermissionStatusAtom<MicrophonePermission>({
  label: "mobile:microphone-permission",
  initial: "checking",
  read: readMicrophonePermission,
});

function useMicrophonePermission() {
  const permission = useAtomValue(microphonePermissionAtom);
  const setPermission = useAtomSet(microphonePermissionAtom);
  const request = () =>
    void requestRecordingPermissionsAsync()
      .then(toMicrophonePermission, readMicrophonePermission)
      .then(setPermission);
  return { permission, request };
}

const KINDS: Record<
  MicrophoneKind,
  {
    readonly label: string;
    readonly row: string;
    readonly rowDescription: string;
    readonly icon: AppSymbolName;
  }
> = {
  wired: {
    label: "Wired",
    row: "Other wired",
    rowDescription: "Headsets and USB microphones not listed here",
    icon: "cable.connector",
  },
  bluetooth: {
    label: "Bluetooth",
    row: "Other Bluetooth",
    rowDescription:
      Platform.OS === "android"
        ? "Earbuds, headsets, and cars, including Android Auto, not listed here"
        : "AirPods, headsets, and cars not listed here",
    icon: "headphones",
  },
  builtIn: {
    label: "Built-in",
    row: "Built-in microphone",
    rowDescription: "The microphone on this device",
    icon: "iphone",
  },
  carPlay: {
    label: "CarPlay",
    row: "CarPlay",
    rowDescription: "The car’s microphone",
    icon: "car",
  },
};

const UNAVAILABLE_EXPLANATION =
  Platform.OS === "android"
    ? "Dictation on this device needs Android 12 or later and Google speech services that support your language. Your keyboard’s voice typing is separate."
    : "Dictation on this device needs iOS 26 or later, a supported device, and a supported language. Your keyboard’s dictation is separate.";

function saveDestination(id: EnvironmentId | null) {
  const uiT = readUiTranslator();

  try {
    chooseVoiceDestination(id);
  } catch {
    Dialog.alert(
      uiT("Could not save transcription choice"),
      uiT(
        "Dictation on an environment is off for this session. Save again before closing the app, or your previous choice may return when it restarts.",
      ),
    );
  }
}

function EnvironmentChoice({
  environment,
  selected,
}: {
  environment: EnvironmentPresentation;
  selected: boolean;
}) {
  const { t: uiT } = useUiLanguage();

  const usable = useAtomValue(voiceConnectionAtom(environment.environmentId)) !== null;
  const status = AsyncResult.getOrElse(
    useAtomValue(voiceSpeechStatusAtom(environment.environmentId)),
    () => null,
  );
  return (
    <ListChoiceRow
      label={environment.label}
      selected={selected}
      disabled={!usable}
      description={
        !usable
          ? environment.connection.phase !== "connected"
            ? uiT("Not connected")
            : uiT("Transcription unavailable")
          : status?.supported === false
            ? status.reason
            : status?.state === "missing-model"
              ? uiT("No transcription model installed")
              : (environment.displayUrl ?? uiT("Send finished recordings to this environment."))
      }
      separated
      onPress={() => {
        if (!selected)
          Dialog.confirm({
            title: uiT("Send microphone audio to {0}?", { "0": environment.label }),
            message: uiT(
              "Finished recordings will be sent to {0} for transcription. You can switch back to This device at any time.",
              { "0": environment.displayUrl ?? environment.label },
            ),
            confirmText: uiT("Use environment"),
            onConfirm: () => saveDestination(environment.environmentId),
          });
      }}
    />
  );
}

export function SettingsVoiceRouteScreen() {
  const { t: uiT } = useUiLanguage();

  const transcriber = useAtomValue(localVoiceTranscriberAtom);
  const grant = useAtomValue(voiceGrantAtom);
  const { environments, isReady } = useEnvironments();
  const grantEnvironment = grant
    ? environments.find(
        (environment) => environment.environmentId === grant.destination.environmentId,
      )
    : undefined;
  const insets = useSafeAreaInsets();
  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const ready = AsyncResult.isSuccess(preferencesResult) && !preferencesResult.waiting;
  const entries = deviceMicrophoneOrder(
    AsyncResult.isSuccess(preferencesResult) ? preferencesResult.value.microphones : undefined,
  );
  const { permission, request: requestPermission } = useMicrophonePermission();
  const [drag, setDrag] = useState<{ readonly key: string; readonly translation: number } | null>(
    null,
  );
  const [rowHeight, setRowHeight] = useState(0);
  // Each drop remounts the rows so the new order and the cleared offsets land in one frame.
  const [drops, setDrops] = useState(0);

  // Transforms apply to the stored order, so a device recorded meanwhile is kept.
  const move = (key: string, steps: number) =>
    savePreferences({
      transform: (current) => {
        const next = [...deviceMicrophoneOrder(current.microphones)];
        const from = next.findIndex((entry) => microphoneEntryKey(entry) === key);
        const to = Math.min(next.length - 1, Math.max(0, from + steps));
        if (from === -1 || from === to) return {};
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        return { microphones: next };
      },
    });
  const forget = (key: string) =>
    savePreferences({
      transform: (current) => ({
        microphones: deviceMicrophoneOrder(current.microphones).filter(
          (entry) => microphoneEntryKey(entry) !== key,
        ),
      }),
    });
  const dropSteps = (from: number, translation: number) =>
    rowHeight === 0
      ? 0
      : Math.min(entries.length - 1, Math.max(0, from + Math.round(translation / rowHeight))) -
        from;

  const dragFrom =
    drag === null ? -1 : entries.findIndex((entry) => microphoneEntryKey(entry) === drag.key);
  const dragTo = drag === null ? -1 : dragFrom + dropSteps(dragFrom, drag.translation);

  return (
    <SettingsScreen title={uiT("Voice")}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
      >
        <SettingsSection title={uiT("Transcribe on")}>
          <ListChoiceRow
            label={uiT("This device")}
            description={uiT("Audio stays on this device and is transcribed here.")}
            selected={!grant}
            onPress={() => saveDestination(null)}
          />
          {hasEnvironmentVoiceCapture &&
            environments.map((environment) => (
              <EnvironmentChoice
                key={environment.environmentId}
                environment={environment}
                selected={
                  grant?.destination.kind === "environment" &&
                  grant.destination.environmentId === environment.environmentId
                }
              />
            ))}
          {isReady && grant && !grantEnvironment ? (
            <ListChoiceRow
              label={uiT("Previously selected environment")}
              description={uiT("No longer paired")}
              separated
              selected
              disabled
              onPress={() => {}}
            />
          ) : null}
        </SettingsSection>
        {hasEnvironmentVoiceCapture &&
          environments
            .filter(
              (env) =>
                env.serverConfig?.environment.capabilities.cloudVoiceTranscription ||
                (grant?.destination.kind === "cloud" &&
                  grant.destination.environmentId === env.environmentId),
            )
            .map((environment) => (
              <CloudVoiceSection
                key={environment.environmentId}
                environment={environment}
                active={
                  grant?.destination.kind === "cloud" &&
                  grant.destination.environmentId === environment.environmentId
                    ? grant.destination
                    : null
                }
              />
            ))}
        {grantEnvironment && grant?.destination.kind === "environment" ? (
          <VoiceModelSection
            environmentId={grantEnvironment.environmentId}
            label={grantEnvironment.label}
          />
        ) : null}
        {!grant && transcriber === null ? (
          <Text className="px-2 text-sm text-foreground-muted">{uiT(UNAVAILABLE_EXPLANATION)}</Text>
        ) : null}
        {permission === "ask" || permission === "denied" ? (
          <>
            <SettingsSection title={uiT("Microphone access")}>
              <SettingsActionRow
                icon="mic"
                label={permission === "ask" ? uiT("Allow microphone access") : uiT("Open Settings")}
                onPress={
                  permission === "ask" ? requestPermission : () => void Linking.openSettings()
                }
              />
            </SettingsSection>
            <Text className="px-2 text-sm text-foreground-muted">
              {permission === "ask"
                ? uiT("Allow microphone access to record and to see your microphones.")
                : uiT("Turn on microphone access for T3 Code in Settings to use voice input.")}
            </Text>
          </>
        ) : null}
        <SettingsSection title={uiT("Preferred order")}>
          {entries.map((entry, index) => {
            const key = microphoneEntryKey(entry);
            const shift =
              dragFrom === -1 || index === dragFrom
                ? 0
                : dragFrom < dragTo && index > dragFrom && index <= dragTo
                  ? -rowHeight
                  : dragFrom > dragTo && index < dragFrom && index >= dragTo
                    ? rowHeight
                    : 0;
            return (
              <MicrophoneRow
                key={`${key}:${drops}`}
                entry={entry}
                position={index + 1}
                count={entries.length}
                reorderable={ready}
                offset={index === dragFrom ? (drag?.translation ?? 0) : shift}
                lifted={index === dragFrom}
                onHeight={setRowHeight}
                onDragStart={() => setDrag({ key, translation: 0 })}
                onDragMove={(translation) => setDrag({ key, translation })}
                onDragEnd={(translation, cancelled) => {
                  setDrag(null);
                  setDrops((count) => count + 1);
                  if (!cancelled) move(key, dropSteps(index, translation));
                }}
                onStep={(direction) => move(key, direction === "up" ? -1 : 1)}
                onForget={isMicrophoneDevice(entry) ? () => forget(key) : undefined}
              />
            );
          })}
        </SettingsSection>
        <Text className="px-2 text-sm text-foreground-muted">
          {uiT(
            "Voice input uses the first connected microphone in this list. A wired or Bluetooth microphone is added by name the first time you dictate with it connected; until then it falls under Other. Swipe left on a named microphone to forget it. {0}",
            {
              "0":
                Platform.OS === "android"
                  ? uiT(
                      "Android may still use a different microphone if the preferred one can’t be routed.",
                    )
                  : "",
            },
          )}
        </Text>
      </ScrollView>
    </SettingsScreen>
  );
}

function MicrophoneRow(props: {
  readonly entry: MicrophoneEntry;
  readonly position: number;
  readonly count: number;
  readonly reorderable: boolean;
  readonly offset: number;
  readonly lifted: boolean;
  readonly onHeight: (height: number) => void;
  readonly onDragStart: () => void;
  readonly onDragMove: (translation: number) => void;
  readonly onDragEnd: (translation: number, cancelled: boolean) => void;
  readonly onStep: (direction: "up" | "down") => void;
  readonly onForget: (() => void) | undefined;
}) {
  const { t: uiT } = useUiLanguage();

  const { lifted, offset, entry, onForget } = props;
  const kind = KINDS[entry.kind];
  const title = isMicrophoneDevice(entry) ? entry.name : uiT(kind.row);
  const { width: windowWidth } = useWindowDimensions();
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: lifted
          ? offset
          : withTiming(offset, { duration: 160, reduceMotion: ReduceMotion.System }),
      },
    ],
    zIndex: lifted ? 1 : 0,
  }));
  const row = (
    // Opaque so the swipe actions stay hidden until the row slides over them.
    <View className="flex-row items-center bg-grouped-card">
      <View
        accessible
        accessibilityLabel={uiT("{0}, {1}, {2} of {3}", {
          "0": title,
          "1": uiT(kind.label),
          "2": props.position,
          "3": props.count,
        })}
        accessibilityActions={onForget ? [{ name: "forget", label: uiT("Forget") }] : undefined}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === "forget") onForget?.();
        }}
        className="min-w-0 flex-1"
      >
        <ListRowLayout
          icon={kind.icon}
          label={title}
          description={uiT(isMicrophoneDevice(entry) ? kind.label : kind.rowDescription)}
        />
      </View>
      {props.reorderable ? (
        <SettingsDragHandle
          title={title}
          canMoveUp={props.position > 1}
          canMoveDown={props.position < props.count}
          onStart={props.onDragStart}
          onMove={props.onDragMove}
          onEnd={props.onDragEnd}
          onStep={props.onStep}
        />
      ) : null}
    </View>
  );
  return (
    <Reanimated.View
      style={style}
      onLayout={(event) => props.onHeight(event.nativeEvent.layout.height)}
      className={cn(
        props.position > 1 && !lifted && "border-t border-border-subtle",
        lifted && "bg-grouped-card shadow-md",
      )}
    >
      {onForget ? (
        <ThreadSwipeable
          backgroundColor="transparent"
          fullSwipeAction="primary"
          fullSwipeWidth={windowWidth - 40}
          onDelete={onForget}
          primaryAction={{
            accessibilityLabel: uiT("Forget {0}", { "0": title }),
            destructive: true,
            icon: "trash",
            label: uiT("Forget"),
            onPress: onForget,
          }}
          secondaryAction={null}
          threadKey={`microphone:${microphoneEntryKey(entry)}`}
          threadTitle={title}
        >
          {() => row}
        </ThreadSwipeable>
      ) : (
        row
      )}
    </Reanimated.View>
  );
}
