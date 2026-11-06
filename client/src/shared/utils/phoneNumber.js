const KENYAN_MOBILE_PHONE_RE = /^(?:\+?254|0)(?:7|1)[0-9]{8}$/

export function isKenyanMobilePhone(value) {
  return typeof value === 'string' &&
    KENYAN_MOBILE_PHONE_RE.test(value.trim().replace(/[\s().-]/g, ''))
}
