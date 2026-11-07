import { useState } from "react";
import { View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
import { useUiLanguage } from "../../i18n";
import { withKnownPullRequestSummary } from "../../state/use-thread-pr";
import { useOpenWorkspaceDetail } from "../layout/useOpenWorkspaceDetail";
import { PullRequestCardGroup, PullRequestCardRow } from "./PullRequestControls";
import { PullRequestGlyph } from "./pullRequestGlyphs";
import { pullRequestLayerParams } from "./pullRequestStack";
import { pullRequestStatus } from "./pullRequestStatus";
import type { PullRequestParams } from "./usePullRequestDiff";
import type { PullRequestStackState } from "./usePullRequestStack";

export function PullRequestStackCard(props: {
  readonly params: PullRequestParams;
  readonly state: PullRequestStackState;
}) {
  const { t: uiT } = useUiLanguage();

  const openDetail = useOpenWorkspaceDetail();
  const [expanded, setExpanded] = useState(false);
  const stack = props.state.stack;
  if (!stack) {
    const summary =
      props.params.initialSummary?.number === props.params.number
        ? props.params.initialSummary.stack
        : undefined;
    if (!summary) return null;
    return (
      <PullRequestCardGroup>
        <PullRequestCardRow
          title={uiT("Stack")}
          icon={PullRequestGlyph.stack}
          value={`${summary.position} of ${summary.size}`}
          last
        />
      </PullRequestCardGroup>
    );
  }
  const position = stack.layers.findIndex((layer) => layer.number === props.params.number) + 1;
  return (
    <PullRequestCardGroup>
      <PullRequestCardRow
        title={uiT("Stack")}
        icon={PullRequestGlyph.stack}
        value={`${position} of ${stack.layers.length}`}
        accessibilityLabel={uiT("Stack, {0} of {1}{2}", {
          "0": position,
          "1": stack.layers.length,
          "2": props.state.isFresh ? "" : ", showing saved stack",
        })}
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        last={!expanded}
      />
      {expanded ? (
        <View>
          {stack.layers.map((layer, index) => {
            const selected = layer.number === props.params.number;
            const status = pullRequestStatus({
              state: layer.state,
              isDraft: layer.isDraft === true,
            });
            return (
              <View key={layer.number} className={selected ? "bg-thread-selected" : undefined}>
                <PullRequestCardRow
                  title={layer.title ?? layer.headBranch}
                  icon={status.icon}
                  tint={status.tint}
                  value={selected ? "Current" : status.label}
                  detail={uiT("#{0} · {1} of {2}", {
                    "0": layer.number,
                    "1": index + 1,
                    "2": stack.layers.length,
                  })}
                  onPress={
                    selected
                      ? undefined
                      : () =>
                          openDetail({
                            name: "PullRequest",
                            params: withKnownPullRequestSummary(
                              pullRequestLayerParams(props.params, layer.number),
                            ),
                          })
                  }
                  last={index === stack.layers.length - 1}
                />
              </View>
            );
          })}
          <Text className="px-4 py-3 text-xs text-foreground-muted">
            {uiT("Base:")} {stack.base}
            {uiT(". Open a layer to review it or merge the stack through that layer.")}
          </Text>
        </View>
      ) : null}
    </PullRequestCardGroup>
  );
}
