const normaliseDestination = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Match a displayed final stop against the geocoder's canonical city. */
export function destinationMatchesResolvedCity(
  finalStop: string,
  requestedDestination: string | null,
  resolvedDestination?: string | null,
) {
  if (!requestedDestination) return true;
  return normaliseDestination(finalStop) === normaliseDestination(resolvedDestination || requestedDestination);
}
