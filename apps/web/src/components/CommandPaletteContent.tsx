import { useUiLanguage } from "../i18n";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";

import { Command, CommandFooter, CommandInput, CommandPanel } from "./ui/command";
import { Kbd, KbdGroup } from "./ui/kbd";

type CommandPaletteContentProps = Omit<ComponentProps<typeof Command>, "children"> & {
  readonly children: ReactNode;
  readonly escapeLabel?: ReactNode;
  readonly footerActionLabel?: ReactNode;
  readonly footerTrailing?: ReactNode;
  readonly inputAccessory?: ReactNode;
  readonly inputProps: ComponentProps<typeof CommandInput>;
  readonly panelSize?: "list" | "tall-list" | "fill";
  readonly showBackHint?: boolean;
  readonly testId?: string;
};

export function CommandPaletteContent({
  children,
  escapeLabel = "Close",
  footerActionLabel,
  footerTrailing,
  inputAccessory,
  inputProps,
  panelSize = "list",
  showBackHint,
  testId,
  ...commandProps
}: CommandPaletteContentProps) {
  const { t: uiT } = useUiLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  // Wait until the dialog records restoration focus before focusing a replaced input.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="contents" data-testid={testId}>
      <Command {...commandProps}>
        <div className="relative">
          <CommandInput autoFocus={false} {...inputProps} ref={inputRef} />
          {inputAccessory}
        </div>
        <CommandPanel
          className={
            panelSize === "fill"
              ? "flex min-h-0 flex-1 flex-col"
              : panelSize === "tall-list"
                ? "max-h-[min(34rem,76vh)]"
                : "flex max-h-[min(28rem,70vh)] min-h-0 flex-col"
          }
        >
          {children}
        </CommandPanel>
        <CommandFooter className="max-sm:flex-col max-sm:items-start">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1">
              <KbdGroup>
                <Kbd>
                  <ArrowUpIcon />
                </Kbd>
                <Kbd>
                  <ArrowDownIcon />
                </Kbd>
              </KbdGroup>
              <span>{uiT("Navigate")}</span>
            </span>
            {footerActionLabel !== undefined ? (
              <span className="inline-flex items-center gap-1">
                <Kbd>{uiT("Enter")}</Kbd>
                <span>{uiT(footerActionLabel)}</span>
              </span>
            ) : null}
            {showBackHint ? (
              <span className="inline-flex items-center gap-1">
                <Kbd>{uiT("Backspace")}</Kbd>
                <span>{uiT("Back")}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Kbd>{uiT("Esc")}</Kbd>
              <span>{uiT(escapeLabel)}</span>
            </span>
          </div>
          {footerTrailing}
        </CommandFooter>
      </Command>
    </div>
  );
}
