export const APP_NAME = "MC Tracker"

export function pageTitle(segment?: string) {
  return segment ? `${segment} · ${APP_NAME}` : APP_NAME
}
