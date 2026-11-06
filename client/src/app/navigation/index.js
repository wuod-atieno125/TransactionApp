export const defaultPage = 'dashboard'

export function defaultPageFor() {
  return defaultPage
}

export function resolvePage(page) {
  return page || defaultPage
}
