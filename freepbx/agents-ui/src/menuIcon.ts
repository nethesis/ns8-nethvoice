import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { NeDropdownItem } from "@nethesis/vue-components";

export function menuIcon(icon: IconDefinition): NeDropdownItem["icon"] {
  return icon as unknown as NeDropdownItem["icon"];
}
