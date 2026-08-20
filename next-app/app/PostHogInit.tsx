"use client"

import { useEffect } from "react"
import type { PostHog } from "posthog-js"

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

/**
 * PostHog (EU) — sursa de adevăr pentru analytics de la 20 aug 2026, când am
 * scos tracking-ul propriu. Planul gratuit dă un singur proiect, deci toate
 * site-urile intră în același team și se separă la interogare după `$host`.
 *
 * Modulul (~80KB gzip) se importă abia după gărzi, nu în bundle-ul inițial.
 */
let posthogPromise: Promise<PostHog> | null = null

function loadPosthog(): Promise<PostHog> {
  posthogPromise ??= import("posthog-js").then((m) => m.default)
  return posthogPromise
}

/** Sesiunile mele nu intră în statistici: cookie-ul de indiciu citit și de AdminBarClient. */
function eAdmin(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith("ericcosulea_admin_hint="))
}

export function PostHogInit() {
  useEffect(() => {
    if (!KEY) return
    if (eAdmin()) return

    void (async () => {
      const posthog = await loadPosthog()
      if (posthog.__loaded) return

      posthog.init(KEY, {
        // Proxy same-origin (vezi rewrites din next.config), ca adblockerele
        // să nu taie telemetria.
        api_host: "/ingest",
        ui_host: "https://eu.posthog.com",
        // Pageview pe navigația SPA + pageleave, din care PostHog derivă
        // timpul pe pagină.
        defaults: "2025-05-24",
      })
    })()
  }, [])

  return null
}
