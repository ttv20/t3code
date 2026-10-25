import { useUiLanguage } from "../../i18n";
import { useAuth } from "@clerk/react";
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import { Link } from "@tanstack/react-router";

import { hasCloudPublicConfig } from "~/cloud/publicConfig";
import { useT3ConnectAuthPrompt } from "../clerk/useT3ConnectAuthPrompt";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { ScopedSwitch } from "./ScopedSwitch";
import {
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

/** Features that are still settling in. Each is off until turned on here. */
export function BetaSettingsPanel() {
  const { t: uiT } = useUiLanguage();

  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  return (
    <SettingsPageContainer>
      <SettingsSection id="beta" title={uiT("Beta")}>
        <SettingsRow
          {...searchableSetting("working-shelf")}
          description={uiT(
            "Fold working and monitoring threads into a Working section. They return to the top of the inbox when they need you.",
          )}
          resetAction={
            settings.sidebarWorkingShelfEnabled !==
            DEFAULT_UNIFIED_SETTINGS.sidebarWorkingShelfEnabled ? (
              <SettingResetButton
                label={uiT("working section")}
                onClick={() =>
                  updateSettings({
                    sidebarWorkingShelfEnabled: DEFAULT_UNIFIED_SETTINGS.sidebarWorkingShelfEnabled,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.sidebarWorkingShelfEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ sidebarWorkingShelfEnabled: Boolean(checked) })
              }
              aria-label={uiT("Working section")}
            />
          }
        />
        {/* Clerk is only mounted when this build has T3 Connect. */}
        {hasCloudPublicConfig() ? <GuestLinksRowWithSignIn /> : <GuestLinksRow />}
      </SettingsSection>
    </SettingsPageContainer>
  );
}

/** Signed out of T3 Connect, the row offers to sign in instead of its switch. */
function GuestLinksRowWithSignIn() {
  const { t: uiT } = useUiLanguage();

  const { isSignedIn } = useAuth();
  const { openAuthPrompt } = useT3ConnectAuthPrompt();
  // `isSignedIn` is undefined until Clerk loads.
  if (isSignedIn !== false) return <GuestLinksRow />;
  return (
    <SettingsRow
      {...searchableSetting("guest-links")}
      description={uiT(
        "Share a thread with a guest who watches it live in their browser and sends messages you approve. Sign in to T3 Connect to use guest links.",
      )}
      control={
        <Button size="sm" variant="outline" onClick={openAuthPrompt}>
          {uiT("Sign in")}
        </Button>
      }
    />
  );
}

function GuestLinksRow() {
  const { t: uiT } = useUiLanguage();

  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  return (
    <SettingsRow
      serverScoped
      {...searchableSetting("guest-links")}
      settingKeys={["guestSharingEnabled"]}
      description={
        <>
          {uiT(
            "Share a thread with a guest who watches it live in their browser and sends messages you approve. Needs T3 Connect: sign in and link this machine in",
          )}{" "}
          <Link to="/settings/connections" className="underline underline-offset-2">
            {uiT("Connections")}
          </Link>
          {uiT(". While it is off, every guest link stops working.")}
        </>
      }
      control={
        <ScopedSwitch
          settingKeys={["guestSharingEnabled"]}
          checked={settings.guestSharingEnabled}
          onCheckedChange={(checked) => updateSettings({ guestSharingEnabled: Boolean(checked) })}
          aria-label={uiT("Guest links")}
        />
      }
    />
  );
}
