import { AppBar } from "../../components/ui/AppBar";
import type { AppBarAction, AppBarMenu } from "../../components/ui/AppBar.types";
import { ContentText } from "../../components/ui/AppText";
import { ScreenHeaderButton } from "../../components/ui/ScreenHeaderButton";
import { useUiLanguage } from "../../i18n";
import { useAdaptiveWorkspaceLayout } from "../layout/AdaptiveWorkspaceLayout";
import { useWorkspaceBackNavigation } from "../layout/workspace/useAndroidWorkspaceNavigation";
import type { ThreadInspectorMode } from "./thread-inspector-navigation";
import {
  threadTerminalMenu,
  useThreadGitMenuDefinition,
  type ThreadGitControlsProps,
} from "./ThreadGitControls";

export function ThreadHeader(props: {
  readonly title: string;
  readonly subtitle: string;
  readonly gitControls: ThreadGitControlsProps;
  readonly onReturnToThread?: () => void;
  readonly draft?: boolean;
  readonly hasThreadCwd: boolean;
  readonly fileInspectorSupported: boolean;
  readonly inspectorMode: ThreadInspectorMode | null;
  readonly onToggleInspector: () => void;
  readonly onOpenFilesInspector: () => void;
}) {
  const { t: uiT } = useUiLanguage();

  const goBack = useWorkspaceBackNavigation("threads");
  const { panes, toggleAuxiliaryPane, composerKeyboardActive, startNewTask } =
    useAdaptiveWorkspaceLayout();
  const gitMenu = useThreadGitMenuDefinition(props.gitControls);
  const terminalMenu = threadTerminalMenu(props.gitControls);
  const filesVisible = props.inspectorMode === "files" && panes.auxiliaryPaneVisible;
  const inspectorVisible = props.inspectorMode !== null && panes.auxiliaryPaneVisible;
  const actions: AppBarAction[] = props.hasThreadCwd
    ? [
        {
          accessibilityLabel: filesVisible ? uiT("Close files") : uiT("Open files"),
          icon: "folder",
          selected: filesVisible,
          disabled: !props.gitControls.canOpenFiles,
          separateBackground: false,
          onPress: filesVisible ? toggleAuxiliaryPane : props.onOpenFilesInspector,
        },
      ]
    : [];
  const menus = [gitMenu, terminalMenu].filter((menu): menu is AppBarMenu => menu !== null);

  return (
    <AppBar
      title={props.title}
      titleContent={
        <ContentText numberOfLines={1} className="font-t3-semibold text-lg text-header-foreground">
          {props.title}
        </ContentText>
      }
      subtitle={props.subtitle}
      onBackToList={goBack}
      onCompose={props.draft ? undefined : startNewTask}
      backInSplitView={
        props.onReturnToThread
          ? {
              accessibilityLabel: uiT("Return to chat"),
              icon: "chevron.left",
              onPress: props.onReturnToThread,
            }
          : undefined
      }
      actions={actions}
      menus={menus}
      trailing={
        props.fileInspectorSupported && props.hasThreadCwd ? (
          <ScreenHeaderButton
            accessibilityLabel={inspectorVisible ? uiT("Hide inspector") : uiT("Show inspector")}
            icon="sidebar.right"
            selected={inspectorVisible}
            onPress={props.onToggleInspector}
          />
        ) : null
      }
      hideBottomBorder
      compact={composerKeyboardActive}
    />
  );
}
