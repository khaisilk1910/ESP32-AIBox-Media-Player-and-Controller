export const EQ_BAND_LABELS = ["60Hz", "230Hz", "910Hz", "3.6K", "14K"];
export const CHAT_ENABLED_STATES = new Set([
  "ready", "online", "active", "available", "idle", "standby", "connecting", "listening", "thinking", "speaking",
]);
export const CHAT_DISABLED_STATES = new Set([
  "unavailable", "offline", "error", "failed", "disabled", "disconnected",
]);
export const CHAT_SESSION_STATES = new Set(["connecting", "listening", "thinking", "speaking"]);