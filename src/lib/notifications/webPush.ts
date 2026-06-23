// Web Push helper — keeps the `web-push` import lazy so missing dep / missing
// env vars don't crash the build or unrelated routes.

export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

interface WebPushModule {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void
  sendNotification: (
    subscription: PushSubscriptionJSON,
    payload?: string,
  ) => Promise<unknown>
}

let configured: WebPushModule | null = null
let configurationError: string | null = null

async function getWebPush(): Promise<WebPushModule | null> {
  if (configured) return configured
  if (configurationError) return null

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? ''
  const subject = process.env.VAPID_EMAIL ?? ''
  if (!publicKey || !privateKey || !subject) {
    configurationError = 'VAPID keys are not configured.'
    return null
  }
  try {
    // dynamic import: package is optional and may not be installed.
    // @ts-expect-error — `web-push` is declared in package.json but might not
    // be installed yet; this routes path degrades gracefully when absent.
    const mod = (await import('web-push')) as unknown as {
      default?: WebPushModule
    } & WebPushModule
    const lib = (mod.default ?? mod) as WebPushModule
    lib.setVapidDetails(subject, publicKey, privateKey)
    configured = lib
    return lib
  } catch (err) {
    configurationError =
      'web-push package not installed. Run `npm install web-push` and retry.'
    console.warn('[webPush]', configurationError, err)
    return null
  }
}

export async function isPushReady() {
  return (await getWebPush()) !== null
}

export async function pushReadinessError() {
  await getWebPush()
  return configurationError
}

export async function sendPush(
  subscription: PushSubscriptionJSON,
  payload: PushPayload,
): Promise<{ ok: boolean; error?: string }> {
  const lib = await getWebPush()
  if (!lib) {
    return { ok: false, error: configurationError ?? 'web-push unavailable' }
  }
  try {
    await lib.sendNotification(subscription, JSON.stringify(payload))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
