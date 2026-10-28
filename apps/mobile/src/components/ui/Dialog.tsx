import { readUiTranslator } from "../../state/ui-language";
import { Alert } from "react-native";
import type { ConfirmDialogRequest, TextInputDialogRequest } from "./Dialog.types";

export type { ConfirmDialogRequest, TextInputDialogRequest } from "./Dialog.types";

/** Informational and multi-action alerts share the same platform presenter. */
export function alert(...args: Parameters<typeof Alert.alert>): void {
  Alert.alert(...args);
}

export function confirm(request: ConfirmDialogRequest): void {
  const translateAction = readUiTranslator();
  Alert.alert(request.title, request.message, [
    {
      text: translateAction(request.cancelText ?? "Cancel"),
      style: "cancel",
      onPress: request.onCancel,
    },
    {
      text: translateAction(request.confirmText),
      style: request.destructive ? "destructive" : "default",
      onPress: request.onConfirm,
    },
  ]);
}

export function prompt(request: TextInputDialogRequest): void {
  const translateAction = readUiTranslator();
  Alert.prompt(
    request.title,
    request.message,
    [
      {
        text: translateAction(request.cancelText ?? "Cancel"),
        style: "cancel",
        onPress: request.onCancel,
      },
      {
        text: translateAction(request.confirmText),
        onPress: (value) => request.onConfirm(value ?? ""),
      },
    ],
    "plain-text",
    request.initialValue,
  );
}

export function Host() {
  return null;
}
