import { useUiLanguage, UiText } from "../../i18n";
import { MenuGroupLabel } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function PullRequestStackHeader({
  number,
  notice,
  stale = false,
}: {
  number: number;
  notice?: string | null | undefined;
  stale?: boolean;
}) {
  const { t: uiT } = useUiLanguage();

  return (
    <MenuGroupLabel>
      <div className="flex items-center justify-between gap-2">
        <span>
          <UiText message={"Stack #{0}"} values={{ "0": number }} />
        </span>
        {notice ? (
          <Tooltip>
            <TooltipTrigger render={<span role="status" className="text-xs font-normal" />}>
              {stale ? uiT("May be stale") : uiT("Refreshing…")}
            </TooltipTrigger>
            <TooltipPopup>{notice}</TooltipPopup>
          </Tooltip>
        ) : null}
      </div>
    </MenuGroupLabel>
  );
}
