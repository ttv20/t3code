import { useUiLanguage } from "../i18n";
import { parseSemver } from "@t3tools/shared/semver";
import { useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { SmartphoneIcon } from "lucide-react";
import { useEffect } from "react";

import { APP_VERSION, HOSTED_APP_CHANNEL } from "../branding";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { getLocalStorageItem, setLocalStorageItem } from "../hooks/useLocalStorage";
import { AndroidIcon, AppleIcon } from "./Icons";
import { SettingsRow } from "./settings/settingsLayout";
import { Button } from "./ui/button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "./ui/popover";
import { QRCodeSvg } from "./ui/qr-code";
import { toastManager } from "./ui/toast";

// Orchestrator V2 ships to Nightly first. The App Store and Google Play apps are
// still V1 and cannot connect to a V2 server, so Nightly users need the V2 beta
// app. Delete this file when the store apps move to V2. See #14871.

/** True on Nightly desktop, `npx t3@nightly`, and the hosted Nightly app. */
export const IS_NIGHTLY_BUILD =
  parseSemver(APP_VERSION)?.prerelease[0] === "nightly" || HOSTED_APP_CHANNEL === "nightly";

const IOS_TESTFLIGHT_URL = "https://testflight.apple.com/join/XgaxaRtd";
// Google banned the Play testing group, so new testers can't join it. CI mirrors
// the Play-signed beta APK to this release instead (mobile-android-apk.yml).
const ANDROID_APK_RELEASE_URL = "https://github.com/pingdotgg/t3code/releases/tag/android-nightly";

const ROW_ID = "nightly-mobile-beta";
const NOTICE_DISMISSED_STORAGE_KEY = "t3code:nightly-mobile-beta-notice-dismissed:v1";

// Guards against a second toast from a remount or a Strict Mode effect replay.
let noticeShown = false;

function isNoticeDismissed(): boolean {
  try {
    return getLocalStorageItem(NOTICE_DISMISSED_STORAGE_KEY, Schema.Boolean) === true;
  } catch {
    return false;
  }
}

function dismissNotice() {
  try {
    setLocalStorageItem(NOTICE_DISMISSED_STORAGE_KEY, true, Schema.Boolean);
  } catch {
    // Storage is unavailable. The notice shows again on the next launch.
  }
}

/**
 * One-time Nightly toast that points to the beta mobile app. Any close (the
 * corner button, swipe, Dismiss, or the action) hides it for good on this client.
 */
export function NightlyMobileBetaNotice() {
  const { t: uiT } = useUiLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!IS_NIGHTLY_BUILD || noticeShown || isNoticeDismissed()) return;
    noticeShown = true;
    const toastId = toastManager.add({
      title: uiT("Nightly needs the beta mobile app"),
      description: uiT(
        "Nightly uses the new orchestrator. The App Store and Google Play versions of T3 Code cannot connect to it.",
      ),
      timeout: 0,
      onClose: dismissNotice,
      actionProps: {
        children: "Get the beta app",
        onClick: () => {
          toastManager.close(toastId);
          void navigate({ to: "/settings/general", hash: ROW_ID });
        },
      },
      data: {
        leadingIcon: <SmartphoneIcon className="size-4" />,
        actionLayout: "stacked-end",
        secondaryActionProps: {
          children: "Dismiss",
          onClick: () => toastManager.close(toastId),
        },
        secondaryActionVariant: "ghost",
      },
    });
  }, [navigate, uiT]);

  return null;
}

/** QR code plus a copy button for one beta link. */
function BetaLinkQr({ url, label }: { url: string; label: string }) {
  const { t: uiT } = useUiLanguage();
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-lg bg-white p-1.5">
        <QRCodeSvg value={url} size={128} level="M" marginSize={1} title={uiT(label)} />
      </div>
      <Button size="xs" variant="outline" onClick={() => copyToClipboard(url)}>
        {isCopied ? uiT("Copied") : uiT("Copy link")}
      </Button>
    </div>
  );
}

/** Settings → General → About row with the beta app links. Render it only for Nightly. */
export function NightlyMobileBetaRow() {
  const { t: uiT } = useUiLanguage();
  return (
    <SettingsRow
      id={ROW_ID}
      title={uiT("Mobile app")}
      description={uiT(
        "Nightly needs the beta app. The App Store and Google Play versions cannot connect.",
      )}
      control={
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger render={<Button size="sm" variant="outline" />}>
              <AppleIcon />
              {uiT("iPhone")}
            </PopoverTrigger>
            <PopoverPopup align="end">
              <div className="flex flex-col gap-3">
                <div className="space-y-1">
                  <PopoverTitle>{uiT("TestFlight beta")}</PopoverTitle>
                  <p className="text-xs text-muted-foreground">
                    {uiT("Scan with your iPhone camera.")}
                  </p>
                </div>
                <BetaLinkQr url={IOS_TESTFLIGHT_URL} label={uiT("TestFlight beta link")} />
              </div>
            </PopoverPopup>
          </Popover>
          <Popover>
            <PopoverTrigger render={<Button size="sm" variant="outline" />}>
              <AndroidIcon />
              {uiT("Android")}
            </PopoverTrigger>
            <PopoverPopup align="end">
              <div className="flex flex-col gap-3">
                <div className="space-y-1">
                  <PopoverTitle>{uiT("Android beta APK")}</PopoverTitle>
                  <p className="max-w-56 text-xs text-muted-foreground">
                    {uiT("Scan with your phone, then download and install the APK.")}
                  </p>
                </div>
                <BetaLinkQr url={ANDROID_APK_RELEASE_URL} label={uiT("Android beta APK link")} />
              </div>
            </PopoverPopup>
          </Popover>
        </div>
      }
    />
  );
}
