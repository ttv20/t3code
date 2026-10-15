import { useUiLanguage } from "../../i18n";
import type { ComponentProps } from "react";
import { OpenAI } from "../Icons";
import { Button } from "../ui/button";

export function ChatGptConnectionButton({ children, ...props }: ComponentProps<typeof Button>) {
  const { t: uiT } = useUiLanguage();
  return (
    <Button {...props}>
      <OpenAI className="size-4 shrink-0" aria-hidden="true" />
      {children ?? uiT("Continue with ChatGPT")}
    </Button>
  );
}
