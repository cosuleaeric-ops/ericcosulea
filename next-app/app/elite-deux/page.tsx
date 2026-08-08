import Script from "next/script";

// Amprenta deploy-ului care a servit HTML-ul acestui tab. Clientul o compară cu
// cea întoarsă de API la fiecare poll: dacă diferă, tabul rulează cod vechi și se
// reîncarcă singur. Fără asta, un tab lăsat deschis luni de zile nu află niciodată
// de un fix (vezi egress-ul ars de două ori pe Supabase, iul + aug 2026).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

export default function EliteDeuxPage() {
  return (
    <>
      <Script id="elite-deux-config" strategy="beforeInteractive">{`
window.ELITE_DEUX_CONFIG = { stateUrl: "/api/elite-deux/state", wipUrl: "/api/elite-deux/wip", csrfToken: "", buildId: ${JSON.stringify(BUILD_ID)} };
      `}</Script>

      <div className="app-shell">
        <header className="topbar">
          <div className="brand-wrap">
            <span className="brand-mark"></span>
            <h1>EliteDeux</h1>
          </div>

          <div className="week-controls">
            <button id="prevWeek" className="ghost-btn" aria-label="Ziua anterioară">‹</button>
            <button id="todayBtn" className="ghost-btn today-btn" aria-label="Sari la ziua de azi">Azi</button>
            <button id="nextWeek" className="ghost-btn" aria-label="Ziua următoare">›</button>
          </div>

          <div className="header-spacer" aria-hidden="true"></div>
        </header>

        <main>
          <div id="weekGrid" className="week-grid" aria-live="polite"></div>

          <section id="listsSection" className="lists-section" aria-label="Liste permanente">
            <div
              id="listsResize"
              className="lists-resize"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Trage pentru a schimba înălțimea secțiunii de liste"
              tabIndex={0}
              title="Trage în sus sau în jos ca să schimbi înălțimea secțiunii"
            >
              <span className="lists-resize-grip" aria-hidden="true"></span>
            </div>
            <div className="lists-bar">
              <div id="listsTabs" className="lists-tabs" role="tablist"></div>
              <button id="addListBtn" className="ghost-btn ghost-btn--small add-list-btn" type="button" aria-label="Listă nouă" title="Listă nouă">+</button>
              <button
                id="listsToggle"
                className="lists-toggle"
                type="button"
                aria-expanded="true"
                aria-controls="listsBody"
                aria-label="Pliază sau desfășoară listele"
              >
                <span className="lists-chevron" aria-hidden="true">⌄</span>
              </button>
            </div>
            <div id="listsBody" className="lists-body">
              <div id="listsGrid" className="lists-grid" aria-live="polite"></div>
            </div>
          </section>
        </main>
      </div>

      <button id="prefsToggle" className="prefs-fab" aria-label="Deschide setări" aria-expanded="false">⚙</button>

      <div id="prefsOverlay" className="prefs-overlay" hidden></div>

      <aside id="prefsPanel" className="prefs-panel" aria-hidden="true">
        <div className="prefs-head">
          <h2>Preferences</h2>
          <button id="prefsClose" className="ghost-btn ghost-btn--small" aria-label="Închide meniul">✕</button>
        </div>

        <section className="prefs-section">
          <p className="prefs-label">Theme</p>
          <div className="swatches" id="themeSwatches">
            <button data-theme="pink" className="swatch swatch-pink" title="Roz"></button>
            <button data-theme="red" className="swatch swatch-red" title="Roșu"></button>
            <button data-theme="green" className="swatch swatch-green" title="Verde"></button>
            <button data-theme="blue" className="swatch swatch-blue" title="Albastru"></button>
            <button data-theme="black" className="swatch swatch-black" title="Negru"></button>
          </div>
        </section>

        <section className="prefs-section">
          <div className="prefs-row">
            <span>Columns</span>
            <div className="segmented" data-setting="columns">
              <button data-value="1">1</button>
              <button data-value="3">3</button>
              <button data-value="5">5</button>
              <button data-value="7">7</button>
            </div>
          </div>

          <div className="prefs-row">
            <span>Text size</span>
            <div className="segmented" data-setting="textSize">
              <button data-value="s">S</button>
              <button data-value="m">M</button>
              <button data-value="l">L</button>
            </div>
          </div>

          <div className="prefs-row">
            <span>Spacing</span>
            <div className="segmented" data-setting="spacing">
              <button data-value="s">S</button>
              <button data-value="m">M</button>
              <button data-value="l">L</button>
            </div>
          </div>
        </section>

        <section className="prefs-section">
          <div className="prefs-row">
            <span>Completed to-do&apos;s</span>
            <label className="switch"><input id="hideCompleted" type="checkbox" /><span className="slider"></span></label>
          </div>

          <div className="prefs-row">
            <span>Bullet style</span>
            <div className="segmented" data-setting="bulletStyle">
              <button data-value="circle">○</button>
              <button data-value="square">□</button>
              <button data-value="none">∅</button>
            </div>
          </div>

          <div className="prefs-row">
            <span>Start on</span>
            <div className="segmented" data-setting="startOn">
              <button data-value="today">Today</button>
              <button data-value="yesterday">Yesterday</button>
            </div>
          </div>

          <div className="prefs-row">
            <span>Lines</span>
            <label className="switch"><input id="showLines" type="checkbox" /><span className="slider"></span></label>
          </div>

          <div className="prefs-row">
            <span>Display</span>
            <div className="segmented" data-setting="display">
              <button data-value="light">Light</button>
              <button data-value="dark">Dark</button>
            </div>
          </div>

          <div className="prefs-row">
            <span>Celebrations (confetti)</span>
            <label className="switch"><input id="celebrations" type="checkbox" /><span className="slider"></span></label>
          </div>
        </section>

        <section className="prefs-section">
          <p className="prefs-label">Task-uri recurente</p>
          <div id="recurringList" className="recurring-list"></div>
          <div className="recurring-form">
            <input id="recurringText" type="text" placeholder="Ex: Curățenie" autoComplete="off" />
            <div className="recurring-interval">
              <span>La fiecare</span>
              <input id="recurringEvery" type="number" min="1" max="365" defaultValue="1" />
              <select id="recurringUnit" defaultValue="day">
                <option value="day">zile</option>
                <option value="week">săptămâni</option>
                <option value="month">luni</option>
              </select>
            </div>
            <button id="recurringAdd" className="ghost-btn" type="button">Adaugă</button>
          </div>
        </section>

        <section className="prefs-section">
          <p className="prefs-label">Data</p>
          <p id="storageStatus" className="prefs-note">Connecting to server...</p>
          <div className="prefs-actions">
            <button id="exportData" className="ghost-btn" type="button">Export</button>
            <button id="importData" className="ghost-btn" type="button">Import</button>
          </div>
          <input id="importFile" className="visually-hidden" type="file" accept="application/json,.json" />
        </section>
      </aside>

      <template id="taskTemplate" dangerouslySetInnerHTML={{ __html: `
        <li class="task-item" draggable="true">
          <button class="check-btn" aria-label="Marchează completat"></button>
          <div class="task-content"></div>
          <div class="task-actions">
            <button class="tiny-btn edit-btn" title="Editează">✎</button>
          </div>
        </li>
      ` }} />

      <div id="trashZone" className="trash-zone" aria-hidden="true">
        <span className="trash-icon">🗑</span>
        <span className="trash-label">Trage aici pentru a șterge</span>
      </div>

      <Script src="/elite-deux/app.js?v=29" strategy="afterInteractive" />
    </>
  );
}
