import * as Schema from "effect/Schema";
import { useLocalStorage } from "./useLocalStorage";

export function useStickyWorkingShelf() {
  return useLocalStorage("t3code:sticky-working-shelf:v1", false, Schema.Boolean);
}
