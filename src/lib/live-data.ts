export const requireLiveData = () => process.env.REQUIRE_LIVE_DATA?.trim().toLowerCase() === "true";

export const allowLabelledDemoHotels = () =>
  process.env.ALLOW_LABELLED_DEMO_HOTELS?.trim().toLowerCase() === "true";

export const developmentDiagnostics = () =>
  process.env.NODE_ENV !== "production" || requireLiveData();
