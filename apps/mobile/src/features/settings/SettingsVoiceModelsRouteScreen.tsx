import { useAtomValue } from "@effect/atom-react";
import type { StaticScreenProps } from "@react-navigation/native";
import type { EnvironmentId } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";
import { FlatList, Platform, View } from "react-native";
import { useUiLanguage } from "../../i18n";

import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { AppText as Text } from "../../components/ui/AppText";
import { EmptyState } from "../../components/ui/EmptyState";
import { cn } from "../../lib/cn";
import { useEnvironments } from "../../state/environments";
import { PullRequestSearchSheet } from "../pull-requests/PullRequestSearchSheet";
import { voiceSpeechBenchmarksAtom } from "../voice-input/voiceDestination";
import { useVoiceModels, VoiceModelRow } from "./VoiceModelSection";

export function SettingsVoiceModelsRouteScreen({
  route,
}: StaticScreenProps<{ readonly environmentId: EnvironmentId }>) {
  const { t: uiT } = useUiLanguage();

  const { environments } = useEnvironments();
  const label =
    environments.find((environment) => environment.environmentId === route.params.environmentId)
      ?.label ?? "This environment";
  const voice = useVoiceModels(route.params.environmentId, label);
  const benchmarks = new Map(
    (
      AsyncResult.getOrElse(
        useAtomValue(voiceSpeechBenchmarksAtom(route.params.environmentId)),
        () => null,
      )?.models ?? []
    ).map((model) => [model.id, model.benchmark]),
  );
  const language = new Intl.DateTimeFormat().resolvedOptions().locale.split("-")[0]!.toLowerCase();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  // Catalog order, not state order: re-sorting when a download finishes would move rows under a tap.
  const models = voice.models
    .map((model) => {
      const benchmark = benchmarks.get(model.id);
      return benchmark ? { ...model, benchmark } : model;
    })
    .filter((model) =>
      `${model.name} ${model.description} ${model.languages.join(" ")}`
        .toLowerCase()
        .includes(needle),
    );
  return (
    <PullRequestSearchSheet
      title={uiT("Transcription models")}
      placeholder={uiT("Search models or languages")}
      closeAccessibilityLabel={uiT("Close transcription models")}
      clearAccessibilityLabel={uiT("Clear model search")}
      query={query}
      onQueryChange={setQuery}
    >
      {({ paddingBottom }) => (
        <FlatList
          data={models}
          keyExtractor={(model) => model.id}
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom }}
          ListHeaderComponent={
            voice.canManage ? undefined : (
              <Text className="pb-3 text-xs text-foreground-muted">
                {uiT("This connection can’t change settings on {0}.", { "0": label })}
              </Text>
            )
          }
          renderItem={({ item, index }) => (
            <View
              className={cn(
                "overflow-hidden",
                index === 0 && "rounded-t-2xl",
                index === models.length - 1 && "rounded-b-2xl",
              )}
            >
              <VoiceModelRow model={item} voice={voice} separated={index > 0} language={language} />
            </View>
          )}
          ListEmptyComponent={
            voice.loading ? (
              <AppActivityIndicator className="my-8" />
            ) : (
              <EmptyState
                title={needle ? uiT("No models match") : uiT("No transcription models")}
                detail={
                  needle
                    ? uiT("Try another name or language.")
                    : uiT("{0} has no models to list.", { "0": label })
                }
                variant="plain"
              />
            )
          }
        />
      )}
    </PullRequestSearchSheet>
  );
}
