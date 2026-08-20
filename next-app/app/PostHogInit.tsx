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

/**
 * „Nu număra device-ul ăsta" — echivalentul vechiului `?elitedata_ignore=1`.
 * Deschide o dată `?ph_off=1` pe fiecare browser de-al tău (telefon, laptop de
 * la cafenea) și marcajul rămâne: e ținut și în localStorage, și într-un cookie
 * pe domeniul părinte, deci dacă unul se șterge, celălalt îl rescrie.
 * `?ph_off=0` anulează.
 */
const FLAG = "ph_off"

function comutaDupaUrl(): void {
  const val = new URLSearchParams(location.search).get(FLAG)
  if (val !== "1" && val !== "0") return
  const parti = location.hostname.split(".")
  const domeniu =
    parti.length < 2 || location.hostname.endsWith("localhost")
      ? ""
      : `; domain=.${parti.slice(-2).join(".")}`
  try {
    if (val === "1") localStorage.setItem(FLAG, "1")
    else localStorage.removeItem(FLAG)
  } catch {
    /* localStorage blocat (mod privat) — cookie-ul de mai jos e suficient */
  }
  document.cookie =
    val === "1"
      ? `${FLAG}=1; max-age=63072000; path=/${domeniu}; SameSite=Lax`
      : `${FLAG}=; max-age=0; path=/${domeniu}`
}

function nuNumara(): boolean {
  try {
    if (localStorage.getItem(FLAG) === "1") return true
  } catch {
    /* vezi mai sus */
  }
  return document.cookie.split("; ").some((c) => c.trim() === `${FLAG}=1`)
}

export function PostHogInit() {
  useEffect(() => {
    if (!KEY) return
    comutaDupaUrl()
    if (nuNumara()) return
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

      // Afișarea INIȚIALĂ, capturată explicit.
      //
      // Verificat pe 21 aug 2026: blogul trimitea `$pageleave` dar niciun
      // `$pageview`, deci în dashboard apărea cu zero vizite deși PostHog rula.
      // `defaults: "2025-05-24"` cere `capture_pageview: "history_change"`, care
      // ascultă schimbările de istoric — dar componenta se montează într-un
      // useEffect, cu documentul deja încărcat, deci prima afișare trecuse.
      // Celelalte site-uri, cu aceeași versiune, nu pățesc asta: depinde de cât
      // de târziu ajunge componenta să se monteze în arborele paginii.
      //
      // Navigările următoare rămân în grija lui `history_change`, deci nu se
      // dublează nimic: aici se capturează o singură dată, la montare.
      posthog.capture("$pageview")
    })()
  }, [])

  return null
}
