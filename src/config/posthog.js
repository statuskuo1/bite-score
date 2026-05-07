// posthog-node is a server-side SDK and cannot run in a browser (no `process`).
// Stub until a browser-compatible SDK (posthog-js) is wired up.
const posthog = {
  identify: () => {},
  capture: () => {},
  captureException: () => {},
};

export default posthog;
