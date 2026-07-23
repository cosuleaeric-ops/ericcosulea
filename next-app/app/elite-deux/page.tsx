import Script from "next/script";

export default function EliteDeuxPage() {
  return (
    <>
      <Script id="elite-deux-config" strategy="beforeInteractive">{`
window.ELITE_DEUX_CONFIG = { stateUrl: "/api/elite-deux/state", csrfToken: "" };
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
            <button class="tiny-btn pin-btn" title="Trimite în topbar-ul macOS">📌</button>
            <button class="tiny-btn edit-btn" title="Editează">✎</button>
          </div>
        </li>
      ` }} />

      <div id="trashZone" className="trash-zone" aria-hidden="true">
        <span className="trash-icon">🗑</span>
        <span className="trash-label">Trage aici pentru a șterge</span>
      </div>

      <Script src="/elite-deux/app.js" strategy="afterInteractive" />
    </>
  );
}
