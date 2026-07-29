import {
  LocationAutocomplete,
  type LocationAutocompleteProps,
} from "@/components/common/LocationAutocomplete";

export type PlaceSearchProps = LocationAutocompleteProps;

/**
 * Backwards-compatible alias for the location field.
 * `LocationAutocomplete` is the canonical component — prefer it in new code.
 */
export function PlaceSearch(props: PlaceSearchProps) {
  return <LocationAutocomplete {...props} />;
}
