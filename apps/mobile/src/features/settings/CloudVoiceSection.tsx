import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import {
  configuredSecretSources,
  secretRequestReference,
} from "@t3tools/client-runtime/secret-request";
import { setCloudSpeechKey } from "@t3tools/client-runtime/voice-input";
import {
  AuthSettingsWriteScope,
  CLOUD_SPEECH_LABELS,
  CLOUD_SPEECH_PROVIDER_NAMES,
  CloudSpeechApiKey,
  CloudSpeechModelId,
  CloudSpeechProvider,
  isSecretReference,
  type CloudSpeechModel,
  type SecretProviderId,
  type SettingsSecretValue,
  type VoiceTranscriptionDestination,
} from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import * as Schema from "effect/Schema";
import Constants from "expo-constants";
import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { ProviderIcon } from "../../components/ProviderIcon";
import { AppText as Text } from "../../components/ui/AppText";
import { Chip } from "../../components/ui/Chip";
import * as Dialog from "../../components/ui/Dialog";
import { ListActionRow } from "../../components/ui/ListActionRow";
import { ListChoiceRow } from "../../components/ui/ListChoiceRow";
import { Sheet } from "../../components/ui/Sheet";
import { useUiLanguage } from "../../i18n";
import type { EnvironmentPresentation } from "../../state/environments";
import { useEnvironmentScope } from "../../state/session";
import {
  chooseVoiceDestination,
  cloudVoiceConnectionAtom,
  cloudVoiceKeysAtom,
  cloudVoiceModelsAtom,
  pendingCloudVoiceChoice,
  runSpeech,
} from "../voice-input/voiceDestination";
import { SettingsSection } from "./components/SettingsSection";

type CloudDestination = Extract<VoiceTranscriptionDestination, { kind: "cloud" }>;
type Props = { environment: EnvironmentPresentation; active: CloudDestination | null };
const isApiKey = Schema.is(CloudSpeechApiKey);
const isModelId = Schema.is(CloudSpeechModelId);
const MODEL_ROWS = 6;

export function CloudVoiceSection({ environment, active }: Props) {
  const { t: uiT } = useUiLanguage();

  const [open, setOpen] = useState(false);
  return (
    <SettingsSection title={uiT("Cloud via {0}", { "0": environment.label })}>
      <ListActionRow
        label={uiT("Cloud providers")}
        description={
          active
            ? uiT("Using {0}", { "0": CLOUD_SPEECH_LABELS[active.provider] })
            : uiT("Optional · use your own API key")
        }
        onPress={() => setOpen(true)}
      />
      {open && (
        <CloudChoices environment={environment} active={active} onClose={() => setOpen(false)} />
      )}
    </SettingsSection>
  );
}

function ModelPicker({
  models,
  value,
  current,
  disabled,
  onChange,
}: {
  models: ReadonlyArray<CloudSpeechModel>;
  value: string;
  /** The grant's model, flagged when the catalog no longer lists it. */
  current: string | undefined;
  disabled: boolean;
  onChange: (model: CloudSpeechModelId) => void;
}) {
  const { t: uiT } = useUiLanguage();

  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const needle = query.trim().toLowerCase();
  const selected = models.find((model) => model.id === value);
  const matches = models.filter((model) =>
    `${model.name} ${model.id}`.toLowerCase().includes(needle),
  );
  const shown = showAll ? matches : matches.slice(0, MODEL_ROWS);
  const delisted = current !== undefined && !models.some((model) => model.id === current);
  return (
    <>
      <TextInput
        accessibilityLabel={uiT("Search OpenRouter models")}
        placeholder={uiT("Search transcription models")}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
        value={query}
        onChangeText={setQuery}
        className="mx-4 rounded-lg bg-background px-3 py-2 text-foreground"
      />
      {delisted ? (
        <Text className="mx-4 text-sm text-destructive">
          {uiT(
            "OpenRouter no longer lists {0}. Dictation stays off until you choose another model.",
            { "0": current },
          )}
        </Text>
      ) : null}
      {selected && !shown.some((model) => model.id === selected.id) ? (
        <ListChoiceRow
          label={selected.name}
          description={selected.id}
          selected
          disabled={disabled}
          onPress={() => {}}
        />
      ) : null}
      {shown.map((model, index) => (
        <ListChoiceRow
          key={model.id}
          label={model.name}
          description={model.id}
          selected={model.id === value}
          separated={index > 0}
          disabled={disabled}
          onPress={() => onChange(model.id)}
        />
      ))}
      {matches.length === 0 ? (
        <Text className="mx-4 text-sm text-foreground-muted">
          {uiT("No transcription model matches.")}
        </Text>
      ) : matches.length > shown.length ? (
        <ListActionRow
          label={uiT("Show all {0} models", { "0": matches.length })}
          onPress={() => setShowAll(true)}
        />
      ) : null}
    </>
  );
}

function CloudChoices({ environment, active, onClose }: Props & { onClose: () => void }) {
  const { t: uiT } = useUiLanguage();

  const id = environment.environmentId;
  const connection = useAtomValue(cloudVoiceConnectionAtom(id));
  const keys = useAtomValue(cloudVoiceKeysAtom(id));
  const reload = useAtomRefresh(cloudVoiceKeysAtom(id));
  const canManage = useEnvironmentScope(id, AuthSettingsWriteScope);
  const [editing, setEditing] = useState<{
    provider: CloudSpeechProvider;
    enable: boolean;
  } | null>(null);
  const catalogAtom = cloudVoiceModelsAtom(editing?.provider === "openrouter" ? id : null);
  const models = useAtomValue(catalogAtom);
  const reloadModels = useAtomRefresh(catalogAtom);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState("");
  const [sourceId, setSourceId] = useState<SecretProviderId | null>(null);
  const sources =
    Constants.expoConfig?.extra?.secretsFeatureEnabled === true &&
    environment.serverConfig?.secretReferences
      ? configuredSecretSources(environment.serverConfig.settings.secretProviders)
      : [];
  const source = sources.find((candidate) => candidate.id === sourceId);
  const credential =
    sourceId !== null
      ? source && secretRequestReference(source, draft)
      : isApiKey(draft.trim())
        ? draft.trim()
        : undefined;
  const [saving, setSaving] = useState(false);
  const activeModel = active?.provider === "openrouter" ? active.model : undefined;
  const enable = (commit: () => void) => {
    try {
      commit();
    } catch {
      Dialog.alert(
        uiT("Could not enable cloud dictation"),
        uiT("Check device storage and choose the provider again."),
      );
    }
  };
  const edit = (provider: CloudSpeechProvider, enable: boolean) => {
    const stored = environment.serverConfig?.settings.cloudSpeechCredentials?.[provider];
    const ref =
      isSecretReference(stored) && sources.some((candidate) => candidate.id === stored.provider)
        ? stored
        : null;
    setSourceId(ref?.provider ?? null);
    setDraft(ref?.reference ?? "");
    setModel(provider === "openrouter" ? (activeModel ?? "") : "");
    setEditing({ provider, enable });
  };
  const reset = () => {
    setDraft("");
    setModel("");
    setEditing(null);
  };
  const changeKey = async (
    provider: CloudSpeechProvider,
    value: SettingsSecretValue | null,
    chosen?: CloudSpeechModelId,
  ) => {
    if (!connection || !canManage || saving) return;
    const commit =
      value !== null && (editing?.enable || (chosen !== undefined && chosen !== activeModel))
        ? pendingCloudVoiceChoice(id, provider, chosen)
        : null;
    setSaving(true);
    try {
      await runSpeech(setCloudSpeechKey(connection, provider, value));
    } catch {
      setSaving(false);
      Dialog.alert(
        uiT("Could not update the API key"),
        uiT("Check the environment connection and your settings permissions."),
      );
      return;
    }
    setSaving(false);
    if (commit) enable(commit);
    reload();
    onClose();
  };
  const catalog = AsyncResult.isSuccess(models) ? (models.value?.models ?? null) : null;
  const content =
    !AsyncResult.isSuccess(keys) || !keys.value || !connection ? (
      <ListActionRow
        label={
          !connection
            ? uiT("Environment not connected")
            : keys._tag === "Failure"
              ? uiT("Could not load keys · Retry")
              : uiT("Checking API keys…")
        }
        disabled={!connection || keys._tag !== "Failure"}
        onPress={reload}
      />
    ) : (
      CloudSpeechProvider.literals.map((provider) => {
        if (editing && provider !== editing.provider) return null;
        const label = CLOUD_SPEECH_LABELS[provider];
        const company = CLOUD_SPEECH_PROVIDER_NAMES[provider];
        const routed = provider === "openrouter";
        const disclosure =
          provider === "openrouter"
            ? uiT(
                "After you stop, {0} sends the recording to OpenRouter. OpenRouter chooses who runs your model. T3 requests zero data retention; your OpenRouter account may allow safety retention.",
                { "0": environment.label },
              )
            : uiT(
                "After you stop, {0} sends your recording and vocabulary hints, including project names, to {1}.",
                { "0": environment.label, "1": CLOUD_SPEECH_PROVIDER_NAMES[provider] },
              );
        const saved = keys.value![provider];
        const isActive = active?.provider === provider;
        const isEditing = editing?.provider === provider;
        const modelChosen =
          isModelId(model) && (catalog?.some((entry) => entry.id === model) ?? false);
        const modelChanged = model !== (activeModel ?? "");
        const original = environment.serverConfig?.settings.cloudSpeechCredentials?.[provider];
        const keyChanged =
          credential !== undefined &&
          !(
            isSecretReference(credential) &&
            isSecretReference(original) &&
            original.provider === credential.provider &&
            original.reference === credential.reference
          );
        const routedReady =
          modelChosen &&
          (draft.trim() ? credential !== undefined : Boolean(saved)) &&
          (!isActive || modelChanged || keyChanged);
        const saveRouted = () => {
          if (!routedReady || !isModelId(model)) return;
          const grantChanges = !isActive || modelChanged;
          if (credential !== undefined && keyChanged)
            return void changeKey(provider, credential, model);
          // Model-only changes never write to the environment.
          if (grantChanges) enable(() => chooseVoiceDestination(id, provider, model));
          onClose();
        };
        return (
          <View key={provider}>
            {!isEditing && (
              <ListChoiceRow
                label={label}
                leading={
                  <ProviderIcon
                    provider={
                      provider === "openai" ? "codex" : provider === "xai" ? "grok" : provider
                    }
                    size={20}
                  />
                }
                selected={isActive}
                disabled={saved === undefined || (!saved && !canManage) || saving}
                description={
                  saved === undefined
                    ? uiT("Update the environment to use this provider")
                    : isActive && routed
                      ? canManage
                        ? uiT("{0} · Tap to change model or key", { "0": activeModel })
                        : uiT("{0} · Tap to change model", { "0": activeModel })
                      : isActive && saved && canManage
                        ? uiT("Tap to manage key")
                        : saved
                          ? routed
                            ? uiT("API key saved · choose a model to use it")
                            : uiT("API key saved on this environment")
                          : canManage
                            ? uiT("Add an API key to use this provider")
                            : uiT("Ask an environment administrator to add an API key")
                }
                onPress={() => {
                  if (routed) return edit(provider, !isActive);
                  if (!saved) return edit(provider, true);
                  if (isActive) {
                    if (canManage) edit(provider, false);
                    return;
                  }
                  Dialog.confirm({
                    title: uiT("Use {0} for dictation?", { "0": label }),
                    message: uiT("{0} Select This device to stop sharing.", { "0": disclosure }),
                    confirmText: uiT("Use {0}", { "0": label }),
                    onConfirm: () => enable(pendingCloudVoiceChoice(id, provider)),
                  });
                }}
              />
            )}
            {isEditing && routed && (
              <>
                <Text className="mx-4 text-sm text-foreground-muted">{disclosure}</Text>
                {catalog ? (
                  <ModelPicker
                    models={catalog}
                    value={model}
                    current={activeModel}
                    disabled={saving}
                    onChange={setModel}
                  />
                ) : (
                  <ListActionRow
                    label={
                      AsyncResult.isFailure(models)
                        ? uiT("Could not load models · Retry")
                        : uiT("Loading transcription models…")
                    }
                    disabled={!AsyncResult.isFailure(models)}
                    onPress={reloadModels}
                  />
                )}
              </>
            )}
            {isEditing && (canManage || routed) && (
              <>
                {canManage && sources.length > 0 && (
                  <View className="mx-4 flex-row flex-wrap gap-2">
                    <Chip
                      label={uiT("Value")}
                      size="small"
                      selected={sourceId === null}
                      disabled={saving}
                      onPress={() => {
                        setDraft("");
                        setSourceId(null);
                      }}
                    />
                    {sources.map((candidate) => (
                      <Chip
                        key={candidate.id}
                        label={candidate.label}
                        size="small"
                        selected={sourceId === candidate.id}
                        disabled={saving}
                        onPress={() => {
                          setDraft("");
                          setSourceId(candidate.id);
                        }}
                      />
                    ))}
                  </View>
                )}
                {canManage && (
                  <TextInput
                    key={sourceId ?? "literal"}
                    accessibilityLabel={
                      sourceId
                        ? uiT("{0} API key reference", { "0": label })
                        : uiT("{0} API key", { "0": label })
                    }
                    placeholder={
                      source?.referencePlaceholder ??
                      (routed && saved
                        ? uiT("Saved key · enter a new one to replace")
                        : uiT("API key"))
                    }
                    secureTextEntry={sourceId === null}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    maxLength={4096}
                    editable={!saving}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (routed) saveRouted();
                      else if (credential) void changeKey(provider, credential);
                    }}
                    value={draft}
                    onChangeText={setDraft}
                    className="mx-4 rounded-lg bg-background px-3 py-2 text-foreground"
                  />
                )}
                {routed && !saved && !canManage ? (
                  <ListActionRow
                    label={uiT("Ask an administrator to add an OpenRouter key")}
                    disabled
                    onPress={() => {}}
                  />
                ) : (
                  <ListActionRow
                    label={
                      routed
                        ? isActive
                          ? uiT("Save")
                          : uiT("Save and enable")
                        : editing.enable
                          ? uiT("Save and enable")
                          : uiT("Save key")
                    }
                    description={
                      draft && !credential
                        ? (source?.invalidReferenceMessage ?? uiT("Enter a valid API key."))
                        : routed
                          ? saved && !credential
                            ? uiT(
                                "Uses the API key saved on this environment. The model choice applies only to this device.",
                              )
                            : uiT("Anyone with dictation access to {0} can bill this key.", {
                                "0": environment.label,
                              })
                          : editing.enable
                            ? uiT("{0} Anyone with dictation access to {1} can bill this key.", {
                                "0": disclosure,
                                "1": environment.label,
                              })
                            : uiT(
                                "Updates the {0} key on {1}. Your dictation destination stays the same.",
                                { "0": company, "1": environment.label },
                              )
                    }
                    disabled={(routed ? !routedReady : !credential) || saving}
                    onPress={() => {
                      if (routed) saveRouted();
                      else if (credential) void changeKey(provider, credential);
                    }}
                  />
                )}
                {saved && canManage && (
                  <ListActionRow
                    tone="danger"
                    label={uiT("Remove key from environment")}
                    disabled={saving}
                    onPress={() =>
                      Dialog.confirm({
                        title: uiT("Remove the {0} key from {1}?", {
                          "0": label,
                          "1": environment.label,
                        }),
                        message: uiT("Everyone using it for dictation will lose access."),
                        confirmText: uiT("Remove key"),
                        destructive: true,
                        onConfirm: () => void changeKey(provider, null),
                      })
                    }
                  />
                )}
                <ListActionRow label={uiT("Back to providers")} disabled={saving} onPress={reset} />
              </>
            )}
          </View>
        );
      })
    );
  return (
    <Sheet
      title={editing ? CLOUD_SPEECH_LABELS[editing.provider] : uiT("Cloud providers")}
      onClose={onClose}
      dismissDisabled={saving}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-2 pb-8"
      >
        {content}
      </ScrollView>
    </Sheet>
  );
}
