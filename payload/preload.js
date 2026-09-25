'use strict'
/*
 * Exodus Wallet-Seitenleiste – Oberfläche
 * ----------------------------------------
 * Läuft als zusätzliches Preload-Skript in der Exodus-Oberfläche, in einer eigenen isolierten
 * JavaScript-Welt (kein Zugriff auf Exodus-Interna, kein Node). Setzt links oben vor dem
 * Exodus-Logo einen Knopf, der die Wallet-Seitenleiste öffnet. Alle Aktionen laufen über main.js.
 */
{
  const { ipcRenderer } = require('electron')

  // Debug via IPC an main.js senden
  const debug = (msg) => {
    try { ipcRenderer.send('exodus-wallets:debug', msg) } catch (e) {}
  }

  debug(`preload.js geladen, URL: ${location.href}`)
  debug(`protocol: ${location.protocol}, pathname: ${decodeURIComponent(location.pathname)}`)

  const isExodusUi = () => {
    try {
      const result = window.top === window && location.protocol === 'file:' &&
        /\/src\/static\/exodus-prod\.html$/i.test(decodeURIComponent(location.pathname))
      debug(`isExodusUi() = ${result}`)
      return result
    } catch (e) {
      debug(`isExodusUi() Fehler: ${e.message}`)
      return false
    }
  }

  const call = (name, ...args) => ipcRenderer.invoke('exodus-wallets:' + name, ...args).then((res) => {
    if (!res || !res.ok) throw new Error((res && res.error) || T.unknownError)
    return res.result
  })

  const svg = (paths) => (size = 18) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

  const ICON = {
    wallet: svg('<path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v3.5"/><path d="M3 6v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3.5"/><path d="M21 12h-3.5a2 2 0 0 0 0 4H21z"/>'),
    close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="m3 3 18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    swap: svg('<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>'),
    edit: svg('<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>'),
    folder: svg('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>'),
    desktop: svg('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'),
    plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    restore: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    import: svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'),
    more: svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
    open: svg('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
    power: svg('<path d="M12 3v9"/><path d="M6.4 6.4a8 8 0 1 0 11.2 0"/>'),
    copy: svg('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>'),
    key: svg('<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3"/><path d="m16 7 3 3"/><path d="m18 5 2 2"/>'),
    star: svg('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'),
    check: svg('<path d="m5 12 5 5 9-10"/>'),
    back: svg('<path d="M15 5 8 12l7 7"/>'),
    image: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
    reset: svg('<path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/>'),
    trash: svg('<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>'),
    list: svg('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>'),
    alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><path d="M12 16.2h.01"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.8h.01"/>'),
  }

  // Kopier-Icon, das sich beim Kopieren in ein Häkchen verwandelt (Handoff @xw:morph): Vorder- und
  // Rückseite von ICON.copy plus ein Häkchen, das per stroke-dashoffset gezeichnet wird
  const MORPH = (size = 16) =>
    `<svg class="xw-morph" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    '<rect class="xw-m-front" x="8" y="8" width="13" height="13" rx="2"/><path class="xw-m-back" d="M4 16V5a1 1 0 0 1 1-1h11"/>' +
    '<path class="xw-m-check" d="m5 12 5 5 9-10" pathLength="1"/></svg>'

  // Farben kommen aus Exodus' eigenen Theme-Variablen (exodus.css, :root/.exodus-theme-*), damit die
  // Seitenleiste jedes Exodus-Theme mitmacht. Die Fallbacks sind die Werte des Standard-Themes "origin".
  // Akzent und Verlauf entsprechen .ex-button--default-color und dem aktiven Nav-Strich (#00bfff).
  const CSS = `
.global-navigation__wrapper{padding-left:78px!important}
#xw-root{
  --xw-bg:var(--exodus-theme-base-color-darken,#131518);
  --xw-deep:var(--exodus-theme-base-color-darken-more,#0e1012);
  --xw-surface:var(--exodus-theme-base-color,#1e2226);
  --xw-hover:var(--exodus-theme-base-color-lighten,#23272c);
  --xw-raised:var(--exodus-theme-base-color-lighten-more,#30363d);
  --xw-text:var(--exodus-theme-text-color,#fafafa);
  --xw-muted:rgba(255,255,255,.55);
  --xw-faint:rgba(255,255,255,.3);
  --xw-line:rgba(255,255,255,.06);
  --xw-cyan:#00bfff;
  --xw-violet:#6619ff;
  --xw-grad:linear-gradient(-90deg,#6619ff 0%,#00bfff 100%);
  --xw-grad-soft:linear-gradient(-90deg,rgba(102,25,255,.6) 0%,rgba(0,191,255,.6) 100%);
  --xw-green:#3ad29f;
  --xw-red:var(--color-error,#ff8181);
  --xw-font:var(--font-family-primary,Roboto,"Helvetica Neue",Helvetica,Arial,sans-serif);
  --xw-font-cond:var(--font-family-condensed,"Roboto Condensed","Helvetica Neue",Helvetica,Arial,sans-serif);
  --xw-ease:cubic-bezier(.22,1,.36,1);
  font-family:var(--xw-font);font-size:14px;font-weight:400;color:var(--xw-text);-webkit-font-smoothing:antialiased}
#xw-root,#xw-root *{box-sizing:border-box;margin:0;padding:0;border:0;font-family:inherit;letter-spacing:normal;text-transform:none;line-height:1.35;-webkit-app-region:no-drag}
#xw-root button,#xw-root input{all:unset;box-sizing:border-box;font-family:inherit}
#xw-root .xw-hide{display:none!important}
#xw-root svg{display:block;flex:none}

#xw-toggle{position:fixed!important;left:24px!important;top:26px!important;z-index:2147483647!important;width:36px!important;height:36px!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;color:#fff!important;background:transparent!important;transition:background .2s!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important}
#xw-toggle svg{opacity:.4;transition:opacity .1s,color .2s}
#xw-toggle:hover{background:rgba(255,255,255,.05)!important}
#xw-toggle:hover svg,#xw-root.xw-open #xw-toggle svg{opacity:1}
#xw-toggle:focus-visible{outline:1px solid var(--xw-cyan);outline-offset:2px}
#xw-toggle .xw-count{position:absolute;top:1px;right:-1px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--xw-grad);font-family:var(--xw-font-cond);font-size:10px;font-weight:700;line-height:16px;text-align:center;box-shadow:0 0 0 2px #0c0e0f}

#xw-backdrop{position:fixed!important;inset:0!important;z-index:2147483646!important;background:rgba(8,9,10,.6)!important;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#xw-panel{position:fixed!important;top:0!important;left:0!important;bottom:0!important;z-index:2147483647!important;width:380px!important;max-width:94vw!important;display:flex!important;flex-direction:column!important;background-color:var(--xw-bg)!important;background-image:radial-gradient(120% 50% at 0 0,rgba(102,25,255,.10),transparent 60%),radial-gradient(90% 35% at 100% 100%,rgba(0,191,255,.06),transparent 70%)!important;border-right:1px solid var(--xw-line)!important;box-shadow:none;outline:none!important;user-select:none!important}

#xw-root .xw-head{position:relative;display:flex;align-items:center;gap:6px;height:80px;flex:none;padding:0 16px 0 24px}
#xw-root .xw-head:after{content:"";position:absolute;left:24px;right:24px;bottom:0;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,0))}
#xw-root .xw-head-text{flex:1;min-width:0}
#xw-root .xw-kicker{font-family:var(--xw-font-cond);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--xw-faint)}
#xw-root .xw-title{margin-top:2px;font-size:20px;font-weight:400}
#xw-root .xw-icon{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;opacity:.4;transition:opacity .1s,background .2s,color .2s}
#xw-root .xw-icon:hover{opacity:1;background:rgba(255,255,255,.06)}
#xw-root .xw-icon:focus-visible,#xw-root .xw-btn:focus-visible,#xw-root .xw-item:focus-visible{outline:1px solid var(--xw-cyan);outline-offset:1px;opacity:1}

#xw-root .xw-intro{padding:14px 24px 0;font-size:12.5px;color:var(--xw-muted)}
#xw-root .xw-sum{padding:18px 24px 6px}
#xw-root .xw-label{font-family:var(--xw-font-cond);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--xw-faint)}
#xw-root .xw-sum-value{margin-top:4px;font-size:32px;font-weight:300;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
#xw-root .xw-sum-note{margin-top:2px;font-size:11.5px;color:var(--xw-faint)}
#xw-root .xw-section{padding:18px 24px 8px}

#xw-root .xw-list{flex:1;overflow-y:auto;padding:0 12px 12px}
#xw-root .xw-list::-webkit-scrollbar{width:6px}
#xw-root .xw-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
#xw-root .xw-list::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.2)}
#xw-root .xw-item{position:relative;display:flex;gap:14px;align-items:flex-start;padding:14px 12px;margin-bottom:2px;border-radius:10px;cursor:pointer;transition:background .2s}
#xw-root .xw-item:hover{background:var(--xw-hover)}
#xw-root .xw-item.is-current{background:var(--xw-surface);cursor:default}
#xw-root .xw-avatar{position:relative;width:36px;height:36px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-family:var(--xw-font-cond);font-weight:700;font-size:14px;letter-spacing:.02em;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
#xw-root .xw-item.is-running .xw-avatar:after,#xw-root .xw-item.is-current .xw-avatar:after{content:"";position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:var(--xw-green);box-shadow:0 0 0 2px var(--xw-bg)}
#xw-root .xw-item.is-current .xw-avatar:after{background:var(--xw-cyan);box-shadow:0 0 0 2px var(--xw-surface)}
#xw-root .xw-body{flex:1;min-width:0}
#xw-root .xw-name{display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px}
#xw-root .xw-name-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#xw-root .xw-badge{flex:none;font-family:var(--xw-font-cond);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:10px;background:rgba(0,191,255,.12);color:var(--xw-cyan)}
#xw-root .xw-badge.is-running{background:rgba(58,210,159,.12);color:var(--xw-green)}
#xw-root .xw-bal{margin-top:4px;font-size:18px;font-weight:300;font-variant-numeric:tabular-nums}
#xw-root .xw-bal.is-muted{font-size:12.5px;font-weight:400;color:var(--xw-muted)}
#xw-root .xw-meta{margin-top:2px;font-size:11.5px;color:var(--xw-faint)}
#xw-root .xw-ports{margin-top:8px;display:flex;flex-wrap:wrap;gap:4px}
#xw-root .xw-port{font-size:11px;padding:3px 9px;border-radius:12px;background:rgba(255,255,255,.04);color:var(--xw-muted);font-variant-numeric:tabular-nums}
#xw-root .xw-tools{position:absolute;top:10px;right:8px;display:flex;gap:0;padding-left:18px;border-radius:0 10px 10px 0;background:linear-gradient(90deg,transparent,var(--xw-hover) 18px);opacity:0;transform:translateX(4px);pointer-events:none;transition:opacity .2s,transform .2s var(--xw-ease)}
#xw-root .xw-item.is-current .xw-tools{background:linear-gradient(90deg,transparent,var(--xw-surface) 18px)}
#xw-root .xw-item:hover .xw-tools,#xw-root .xw-item:focus-within .xw-tools{opacity:1;transform:none;pointer-events:auto}
#xw-root .xw-tools .xw-icon{width:28px;height:28px}
#xw-root .xw-tools .xw-icon:hover{color:var(--xw-cyan)}

#xw-root .xw-bottom{position:relative;flex:none;padding:16px 24px 6px}
#xw-root .xw-bottom:before{content:"";position:absolute;left:24px;right:24px;top:0;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,0))}
#xw-root .xw-btn{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:44px;padding:0 20px;margin-bottom:8px;border-radius:30px;cursor:pointer;font-size:13.5px;font-weight:500;color:rgba(255,255,255,.6);background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);transition:color .2s,background .2s,border-color .2s}
#xw-root .xw-btn:hover{color:#fff;background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.14)}
#xw-root .xw-btn.is-primary{height:48px;color:#fff;border:1px solid transparent;background:linear-gradient(var(--xw-bg),var(--xw-bg)) padding-box,var(--xw-grad-soft) border-box}
#xw-root .xw-btn.is-primary:hover{background:linear-gradient(var(--xw-deep),var(--xw-deep)) padding-box,var(--xw-grad) border-box}
#xw-root .xw-btn.is-primary svg{color:var(--xw-cyan)}
#xw-root .xw-btn.is-danger{color:#fff;border:1px solid transparent;background:linear-gradient(var(--xw-bg),var(--xw-bg)) padding-box,linear-gradient(-90deg,rgba(255,77,106,.75),rgba(255,129,129,.55)) border-box}
#xw-root .xw-btn.is-danger:hover{background:linear-gradient(rgba(255,77,106,.12),rgba(255,77,106,.12)) padding-box,linear-gradient(-90deg,#ff4d6a,#ff8181) border-box}
#xw-root .xw-input::placeholder{color:rgba(255,255,255,.25)}
#xw-root .xw-btn[disabled]{opacity:.5;cursor:not-allowed;pointer-events:none}
#xw-root .xw-form-title{font-size:16px;font-weight:500}
#xw-root .xw-form-hint{margin-top:6px;font-size:12.5px;color:var(--xw-muted)}
#xw-root .xw-input{display:block;width:100%;height:46px;margin-top:14px;padding:0 16px;border-radius:8px;background:var(--xw-deep);border:1px solid rgba(255,255,255,.08);color:var(--xw-text);font-size:14px;user-select:text;cursor:text;transition:border-color .2s,box-shadow .2s}
#xw-root .xw-input:focus{border-color:rgba(0,191,255,.6);box-shadow:0 0 0 3px rgba(0,191,255,.12)}
#xw-root .xw-form-error{min-height:18px;margin:6px 0 6px;font-size:12.5px;color:var(--xw-red)}
#xw-root .xw-row{display:flex;gap:8px}
#xw-root .xw-row .xw-btn{flex:1;width:auto;height:46px;padding:0 14px;white-space:nowrap}
#xw-root .xw-row .xw-btn.is-primary{flex:1.5}
#xw-root .xw-foot{flex:none;padding:6px 24px 18px;font-size:11px;color:var(--xw-faint)}
#xw-root .xw-empty{padding:18px 12px;color:var(--xw-muted);font-size:13px}

#xw-root .xw-sum{padding:4px 24px 14px}
#xw-root .xw-sum-value.is-multi{font-size:22px;line-height:1.25}
#xw-root .xw-sum-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
#xw-root .xw-sum-count{flex:none;font-size:11.5px;color:var(--xw-faint)}
#xw-root .xw-intro{padding:0 24px}
#xw-root .xw-badge.is-start{background:rgba(102,25,255,.2);color:#b99bff}
#xw-root .xw-more{flex:none;width:30px;height:30px;margin:-4px -4px 0 0;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;opacity:.35;cursor:pointer;transition:opacity .1s,background .2s}
#xw-root .xw-item:hover .xw-more{opacity:.7}
#xw-root .xw-more:hover,#xw-root .xw-more.is-active{opacity:1;background:rgba(255,255,255,.07)}
#xw-root .xw-more:focus-visible{outline:1px solid var(--xw-cyan);opacity:1}

/* Die Zeile darf unter den ⋯-Knopf reichen (Knopf 30px + Abstand) – dort ist Platz */
#xw-root .xw-ports{flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;gap:4px;margin-right:-40px}
#xw-root .xw-ports::-webkit-scrollbar{display:none}
#xw-root .xw-ports.is-overflow{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent)}
#xw-root .xw-ports.is-overflow.is-end{-webkit-mask-image:none;mask-image:none}
#xw-root .xw-port{flex:none;padding:3px 8px;font-size:10.5px;white-space:nowrap}
#xw-root .xw-fast{position:absolute;right:12px;top:40px;display:flex;align-items:center;gap:6px;height:28px;padding:0 12px 0 10px;border-radius:14px;font-size:12px;font-weight:500;color:#fff;border:1px solid transparent;background:linear-gradient(var(--xw-hover),var(--xw-hover)) padding-box,var(--xw-grad-soft) border-box;opacity:0;transform:translateY(3px);pointer-events:none;cursor:pointer;transition:opacity .15s,transform .2s var(--xw-ease),background .2s}
#xw-root .xw-fast svg{color:var(--xw-cyan)}
#xw-root .xw-item:hover .xw-fast,#xw-root .xw-item:focus-within .xw-fast{opacity:1;transform:none;pointer-events:auto}
#xw-root .xw-fast:hover{background:linear-gradient(var(--xw-deep),var(--xw-deep)) padding-box,var(--xw-grad) border-box}
#xw-root .xw-fast:focus-visible{outline:1px solid var(--xw-cyan);outline-offset:2px}
#xw-root .xw-menu-item:focus-visible{background:var(--xw-hover);color:#fff}
#xw-root .xw-menu-item.is-checked{color:var(--xw-cyan);cursor:default}
#xw-root .xw-menu-item.is-checked svg{opacity:1}
#xw-root .xw-menu-item.is-checked:hover{background:transparent}

#xw-root .xw-form-buttons{display:flex;flex-direction:column}
#xw-root .xw-form-buttons .xw-btn{height:44px}

#xw-root .xw-sheet-head{display:flex;align-items:center;gap:6px;padding:12px 24px 2px 14px}
#xw-root .xw-sheet-title{flex:1;min-width:0;font-size:16px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#xw-root .xw-sheet-sub{padding:0 24px 0 52px;font-size:11.5px;color:var(--xw-faint)}
#xw-root .xw-sheet .xw-input{width:auto;margin:14px 24px 8px}
#xw-root .xw-addr-list{flex:1;overflow-y:auto;padding:4px 12px 12px}
#xw-root .xw-addr-list::-webkit-scrollbar{width:6px}
#xw-root .xw-addr-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
#xw-root .xw-addr{position:relative;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .15s}
#xw-root .xw-addr:hover{background:var(--xw-hover)}
#xw-root .xw-addr-icon{width:34px;height:34px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-family:var(--xw-font-cond);font-size:11px;font-weight:700;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
#xw-root .xw-avatar.is-exodus{background:var(--xw-deep) url("svg/brand/exodus-logomark.svg") center/20px 20px no-repeat;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
#xw-root .xw-avatar.has-image{background:var(--xw-deep)}
#xw-root .xw-avatar img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover}
#xw-root .xw-chips{display:flex;flex-wrap:wrap;gap:6px;padding:2px 24px 8px}
#xw-root .xw-chip:focus-visible{outline:1px solid var(--xw-cyan);outline-offset:1px}
#xw-root .xw-addr-group{padding:14px 12px 6px}
#xw-root .xw-addr-group:first-child{padding-top:4px}
#xw-root .xw-addr-img{width:34px;height:34px;flex:none;display:block;object-fit:contain}
#xw-root .xw-addr-body{flex:1;min-width:0}
#xw-root .xw-addr-name{display:flex;align-items:baseline;gap:6px;font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden}
#xw-root .xw-addr-ticker{font-family:var(--xw-font-cond);font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--xw-faint)}
#xw-root .xw-addr-port{margin-left:auto;font-size:11px;font-weight:400;color:var(--xw-faint);overflow:hidden;text-overflow:ellipsis}
#xw-root .xw-addr-text{font-family:Consolas,"Roboto Mono",monospace;font-size:11.5px;color:var(--xw-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#xw-root .xw-addr-copy{flex:none;color:#fff;opacity:.35;transition:opacity .15s,color .15s}
#xw-root .xw-addr:hover .xw-addr-copy{opacity:1;color:var(--xw-cyan)}
#xw-root .xw-sheet-note{flex:none;padding:10px 24px 18px;font-size:11px;color:var(--xw-faint)}
#xw-root .xw-sheet-bar{flex:none;padding:10px 24px 16px}
#xw-root .xw-sheet-bar .xw-btn{margin:0}
#xw-root form:not(.xw-hide),#xw-root .xw-actions:not(.xw-hide){animation:xw-fade .25s ease both}
#xw-root form:not(.xw-hide){animation:xw-rise .26s var(--xw-ease) both}
#xw-root .xw-icon{transition:opacity .1s,background .2s,color .2s,transform .1s}
#xw-root .xw-more{transition:opacity .1s,background .2s,transform .1s}
#xw-root .xw-icon:active,#xw-root .xw-more:active{transform:scale(.93)}
#xw-root .xw-item .xw-avatar{transition:transform .25s var(--xw-ease)}
#xw-root .xw-item:hover .xw-avatar{transform:scale(1.05)}

/* Weniger Bewegung (Systemeinstellung). Panel, Sheet, Menü usw. regeln die neuen .xw-reduce-Varianten
   unten (Klasse per syncReduce); hier bleiben nur die übrigen Druck-/Hover-Transforms. */
@media (prefers-reduced-motion:reduce){
  #xw-root .xw-icon:active,#xw-root .xw-more:active,#xw-toggle:active,
  #xw-root .xw-item:hover .xw-avatar,#xw-root .xw-fast{transform:none!important}
}

/* Exodus Multi Wallet – Motion (production). Variante 1A gewählt. Aus design_handoff_sidebar_motion/
   xw-motion.prod.css übernommen; Reihenfolge beibehalten, Panel-Selektoren auf preload.js umgeschrieben. */

/* ===== @xw:tokens ===== */
/* Motion-Tokens – einmal in #xw-root ergänzen */
#xw-root{
  --xw-ease-out:cubic-bezier(.22,1,.36,1);     /* Standard: schnell rein, weich aus (= --xw-ease) */
  --xw-ease-in:cubic-bezier(.4,0,1,1);         /* Ausblenden / Schließen */
  --xw-ease-io:cubic-bezier(.65,0,.35,1);      /* Wege mit Start und Ziel (Sweep, Schweif) */
  --xw-ease-back:cubic-bezier(.34,1.56,.64,1); /* kleiner Überschwinger (Häkchen, Punkt) */
  --xw-d-fast:150ms;--xw-d-mid:220ms;--xw-d-slow:320ms;
  --xw-hold:1800ms;                            /* Copied-Zustand ab Klick */
}
/* Gemeinsame Button-Mechanik: Pressed federt zurück */
#xw-root .xw-btn{transition:color .2s,background .2s,border-color .2s,transform 240ms var(--xw-ease-back)}
#xw-root .xw-btn:is(:active,.is-pressed){transform:scale(.98);transition-duration:.2s,.2s,.2s,90ms;transition-timing-function:ease,ease,ease,var(--xw-ease-out)}
#xw-root .xw-cp{isolation:isolate}
#xw-root .xw-cp-stack{display:grid;align-items:center;justify-items:center}
#xw-root .xw-cp-a,#xw-root .xw-cp-b{grid-area:1/1;display:inline-flex;align-items:center;gap:10px;white-space:nowrap}
#xw-root .xw-cp .xw-cp-b svg{color:var(--xw-green)}
/* Ring-Ebene (1,5px, per Maske auf den Rand beschränkt) */
#xw-root .xw-cp-fx{position:absolute;inset:-1px;border-radius:inherit;padding:1.5px;pointer-events:none;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
#xw-root .xw-cp-ring{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(-90deg,rgba(58,210,159,.95),rgba(58,210,159,.6));opacity:0;transition:opacity 300ms var(--xw-ease-out)}
#xw-root .xw-cp.is-copied .xw-cp-ring{opacity:1}

/* ===== @xw:trail ===== */
/* Variante A – Lichtschweif (gewählt) */
#xw-root .xw-cp--trail .xw-cp-a,#xw-root .xw-cp--trail .xw-cp-b{transition:opacity 220ms var(--xw-ease-out),transform 320ms var(--xw-ease-out)}
#xw-root .xw-cp--trail .xw-cp-b{opacity:0;transform:translateY(9px)}
#xw-root .xw-cp--trail.is-copied .xw-cp-a{opacity:0;transform:translateY(-9px)}
#xw-root .xw-cp--trail.is-copied .xw-cp-b{opacity:1;transform:none}
#xw-root .xw-cp--trail.is-copied .xw-cp-b svg{animation:xw-check-pop 360ms var(--xw-ease-back) 80ms both}
#xw-root .xw-cp--trail.is-copied .xw-cp-ring{transition-delay:560ms}
#xw-root .xw-cp-halo{position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;filter:blur(7px);opacity:.55}
#xw-root .xw-cp-comet{position:absolute;left:0;top:0;width:110px;height:8px;border-radius:4px;background:linear-gradient(90deg,transparent,rgba(58,210,159,.45) 55%,#9dffd6 88%,#fff);offset-path:inset(0 round 30px);offset-rotate:auto;offset-anchor:100% 50%;offset-distance:0%;opacity:0}
#xw-root .xw-cp--trail.is-copied .xw-cp-comet{animation:xw-trail 900ms var(--xw-ease-io) both}
@keyframes xw-trail{0%{offset-distance:0%;opacity:0}12%{opacity:1}78%{opacity:1}100%{offset-distance:100%;opacity:0}}
@keyframes xw-check-pop{from{transform:scale(.5);opacity:0}to{transform:none;opacity:1}}
#xw-root.xw-reduce .xw-cp--trail .xw-cp-comet{animation:none!important;opacity:0}
#xw-root.xw-reduce .xw-cp--trail .xw-cp-a,#xw-root.xw-reduce .xw-cp--trail .xw-cp-b{transform:none!important}
#xw-root.xw-reduce .xw-cp--trail.is-copied .xw-cp-b svg{animation:xw-fade 200ms ease both}
#xw-root.xw-reduce .xw-cp--trail.is-copied .xw-cp-ring{transition-delay:0ms}

/* ===== @xw:morph ===== */
/* Icon→Häkchen-Morph (hier für die Adresszeile genutzt) */
#xw-root .xw-morph{flex:none;overflow:visible}
#xw-root .xw-morph>*{transform-box:fill-box;transform-origin:center}
#xw-root .xw-m-front,#xw-root .xw-m-back{transition:opacity 180ms var(--xw-ease-out) 120ms,transform 280ms var(--xw-ease-out) 120ms}
#xw-root .xw-m-check{stroke:var(--xw-green);stroke-dasharray:1;stroke-dashoffset:1;opacity:0;transition:stroke-dashoffset 160ms var(--xw-ease-in),opacity 100ms linear 80ms}
#xw-root .is-copied .xw-m-back{opacity:0;transform:translate(3px,3px);transition:opacity 140ms var(--xw-ease-in),transform 200ms var(--xw-ease-in)}
#xw-root .is-copied .xw-m-front{opacity:0;transform:translate(-2.5px,-2.5px) scale(.5);transition:opacity 160ms var(--xw-ease-in) 40ms,transform 220ms var(--xw-ease-in)}
#xw-root .is-copied .xw-m-check{stroke-dashoffset:0;opacity:1;transition:stroke-dashoffset 300ms var(--xw-ease-out) 150ms,opacity 60ms linear 150ms}
#xw-root .xw-cp--morph .xw-cp-a,#xw-root .xw-cp--morph .xw-cp-b{transition:opacity 240ms var(--xw-ease-out),filter 240ms var(--xw-ease-out)}
#xw-root .xw-cp--morph .xw-cp-b{opacity:0;filter:blur(3px)}
#xw-root .xw-cp--morph.is-copied .xw-cp-a{opacity:0;filter:blur(3px)}
#xw-root .xw-cp--morph.is-copied .xw-cp-b{opacity:1;filter:none;transition-delay:60ms}
#xw-root .xw-cp--morph .xw-cp-ring{transition:opacity 280ms var(--xw-ease-out)}
#xw-root.xw-reduce .xw-m-front,#xw-root.xw-reduce .xw-m-back{transform:none!important}
#xw-root.xw-reduce .xw-m-check{stroke-dashoffset:0!important}
#xw-root.xw-reduce .xw-cp--morph .xw-cp-a,#xw-root.xw-reduce .xw-cp--morph .xw-cp-b{filter:none!important}

/* ===== @xw:row ===== */
/* Adresszeile: Tönung, Adresse → „Address copied“, Icon-Morph */
#xw-root .xw-addr--cp:before{content:"";position:absolute;inset:0;border-radius:inherit;background:rgba(58,210,159,.07);box-shadow:inset 0 0 0 1px rgba(58,210,159,.14);opacity:0;pointer-events:none;transition:opacity 450ms var(--xw-ease-out)}
#xw-root .xw-addr--cp.is-copied:before{opacity:1;transition-duration:150ms}
#xw-root .xw-addr-sub{display:grid;margin-top:2px;overflow:hidden}
#xw-root .xw-addr-sub>*{grid-area:1/1;min-width:0}
#xw-root .xw-addr--cp .xw-addr-text{margin-top:0;transition:opacity 200ms var(--xw-ease-out),transform 260ms var(--xw-ease-out)}
#xw-root .xw-addr-ok{font-size:11.5px;line-height:1.35;font-weight:500;color:var(--xw-green);opacity:0;transform:translateY(8px);transition:opacity 200ms var(--xw-ease-out),transform 260ms var(--xw-ease-out)}
#xw-root .xw-addr--cp.is-copied .xw-addr-text{opacity:0;transform:translateY(-8px)}
#xw-root .xw-addr--cp.is-copied .xw-addr-ok{opacity:1;transform:none;transition-delay:40ms}
#xw-root .xw-addr--cp.is-copied .xw-addr-copy{opacity:1;color:var(--xw-green)}
#xw-root .xw-addr--cp:active .xw-addr-copy{transform:scale(.9)}
#xw-root .xw-addr-copy{transition:opacity .15s,color .15s,transform 200ms var(--xw-ease-back)}
#xw-root.xw-reduce .xw-addr--cp .xw-addr-text,#xw-root.xw-reduce .xw-addr-ok{transform:none!important}

/* ===== @xw:menu ===== */
/* ⋯-Menü: .is-open schaltet. Items bekommen style="--xw-i:0..n" */
#xw-root .xw-menu{position:absolute;z-index:6;top:40px;right:8px;width:250px;padding:6px;border-radius:10px;background:var(--xw-surface);border:1px solid rgba(255,255,255,.08);box-shadow:0 14px 40px rgba(0,0,0,.55);transform-origin:top right;opacity:0;visibility:hidden;transform:scale(.97) translateY(-4px);pointer-events:none;transition:opacity 120ms var(--xw-ease-in),transform 120ms var(--xw-ease-in),visibility 0s 120ms}
#xw-root .xw-menu.is-open{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity 160ms var(--xw-ease-out),transform 200ms var(--xw-ease-out),visibility 0s}
#xw-root .xw-menu-item{display:flex;align-items:center;gap:11px;width:100%;padding:9px 10px;border-radius:6px;font-size:13px;text-align:left;color:rgba(255,255,255,.82);cursor:pointer;opacity:0;transform:translateY(-3px);transition:background .12s,color .12s,opacity 100ms,transform 100ms}
#xw-root .xw-menu.is-open .xw-menu-item{opacity:1;transform:none;transition:background .12s,color .12s,opacity 160ms var(--xw-ease-out),transform 200ms var(--xw-ease-out);transition-delay:0s,0s,calc(min(var(--xw-i,0),8) * 14ms + 30ms),calc(min(var(--xw-i,0),8) * 14ms + 30ms)}
#xw-root .xw-menu-item svg{opacity:.55;transition:opacity .12s,color .12s}
#xw-root .xw-menu-item:hover{background:var(--xw-hover);color:#fff}
#xw-root .xw-menu-item:hover svg{opacity:1;color:var(--xw-cyan)}
#xw-root .xw-menu-item.is-danger:hover,#xw-root .xw-menu-item.is-danger:hover svg{color:var(--xw-red)}
#xw-root .xw-menu-sep{height:1px;margin:5px 6px;background:rgba(255,255,255,.07)}
#xw-root .xw-more svg{transition:transform 200ms var(--xw-ease-out)}
#xw-root .xw-more.is-active svg{transform:rotate(90deg)}
#xw-root.xw-reduce .xw-menu,#xw-root.xw-reduce .xw-menu-item,#xw-root.xw-reduce .xw-more svg{transform:none!important;transition-delay:0s!important}

/* ===== @xw:sheet ===== */
/* Ansicht von rechts: .xw-view (Hauptliste) + .xw-sheet; Klasse .is-sheet auf dem Panel */
#xw-root .xw-view{flex:1;display:flex;flex-direction:column;min-height:0;transition:transform 260ms var(--xw-ease-io),opacity 260ms var(--xw-ease-io)}
#xw-root .is-sheet>.xw-view{transform:translateX(-28px);opacity:.4;transition:transform 320ms var(--xw-ease-out),opacity 320ms var(--xw-ease-out)}
#xw-root .xw-sheet{position:absolute;top:80px;left:0;right:0;bottom:0;z-index:4;display:flex;flex-direction:column;background:var(--xw-bg);box-shadow:-18px 0 40px rgba(0,0,0,0);transform:translateX(100%);visibility:hidden;transition:transform 260ms var(--xw-ease-io),box-shadow 260ms,visibility 0s 260ms}
#xw-root .is-sheet>.xw-sheet{transform:none;visibility:visible;box-shadow:-18px 0 40px rgba(0,0,0,.35);transition:transform 320ms var(--xw-ease-out),box-shadow 320ms,visibility 0s}
#xw-root .is-sheet>.xw-sheet .xw-addr,#xw-root .is-sheet>.xw-sheet .xw-addr-group{animation:xw-rise 260ms var(--xw-ease-out) both;animation-delay:calc(min(var(--xw-i,0),10) * 28ms + 140ms)}
@keyframes xw-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
#xw-root.xw-reduce .xw-view,#xw-root.xw-reduce .xw-sheet{transform:none!important}
#xw-root.xw-reduce .xw-sheet{opacity:0;transition:opacity 200ms ease,visibility 0s 200ms}
#xw-root.xw-reduce .is-sheet>.xw-sheet{opacity:1;transition:opacity 200ms ease,visibility 0s}
#xw-root.xw-reduce .is-sheet>.xw-sheet .xw-addr,#xw-root.xw-reduce .is-sheet>.xw-sheet .xw-addr-group{animation-name:xw-fade}

/* ===== @xw:stagger ===== */
/* Gestaffeltes Einblenden. Zeilen bekommen style="--xw-i:n"; Klasse .xw-anim auf dem Container neu setzen */
#xw-root .xw-anim>.xw-item,#xw-root .xw-anim>.xw-stag{animation:xw-in 280ms var(--xw-ease-out) both;animation-delay:calc(min(var(--xw-i,0),10) * 30ms + 90ms)}
@keyframes xw-in{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
@keyframes xw-fade{from{opacity:0}to{opacity:1}}
#xw-root.xw-reduce .xw-anim>.xw-item,#xw-root.xw-reduce .xw-anim>.xw-stag{animation-name:xw-fade;animation-delay:0ms}

/* ===== @xw:toast ===== */
/* Hinweis-Toast: absolut im Panel, .is-show schaltet; .is-ok / .is-error wie früher .xw-notice */
#xw-root .xw-toast{position:absolute;left:24px;right:24px;bottom:84px;z-index:8;display:flex;align-items:center;gap:10px;padding:11px 14px 11px 16px;border-radius:8px;font-size:12.5px;color:var(--xw-text);background:var(--xw-surface);border:1px solid rgba(255,255,255,.08);box-shadow:0 12px 32px rgba(0,0,0,.5);overflow:hidden;opacity:0;visibility:hidden;transform:translateY(10px) scale(.98);pointer-events:none;transition:opacity 160ms var(--xw-ease-in),transform 160ms var(--xw-ease-in),visibility 0s 160ms}
#xw-root .xw-toast:before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--xw-grad)}
#xw-root .xw-toast.is-ok:before{background:var(--xw-green)}
#xw-root .xw-toast.is-error:before{background:var(--xw-red)}
#xw-root .xw-toast.is-ok svg{color:var(--xw-green)}
#xw-root .xw-toast.is-error svg{color:var(--xw-red)}
#xw-root .xw-toast:after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:rgba(255,255,255,.18);transform-origin:left;transform:scaleX(0)}
#xw-root .xw-toast.is-show{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity 200ms var(--xw-ease-out),transform 240ms var(--xw-ease-out),visibility 0s}
#xw-root .xw-toast.is-show:after{animation:xw-toast-time var(--xw-toast,2400ms) linear both}
@keyframes xw-toast-time{from{transform:scaleX(1)}to{transform:scaleX(0)}}
#xw-root.xw-reduce .xw-toast{transform:none!important}
#xw-root.xw-reduce .xw-toast:after{display:none}

/* ===== @xw:chip ===== */
/* Chip an/aus (Mehrfachauswahl) – Verlaufsrand als Pseudo-Ebene, damit er überblenden kann */
#xw-root .xw-chip{position:relative;max-width:100%;padding:5px 13px;border-radius:15px;font-size:12px;font-weight:500;color:var(--xw-muted);background:rgba(255,255,255,.04);border:1px solid transparent;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color 150ms,background 150ms,transform 220ms var(--xw-ease-back)}
#xw-root .xw-chip:before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:var(--xw-grad-soft);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity 150ms var(--xw-ease-in)}
#xw-root .xw-chip:hover{color:#fff;background:rgba(255,255,255,.07)}
#xw-root .xw-chip:active{transform:scale(.96);transition-duration:150ms,150ms,90ms}
#xw-root .xw-chip.is-active{color:#fff;background:var(--xw-bg)}
#xw-root .xw-chip.is-active:before{opacity:1;transition:opacity 200ms var(--xw-ease-out)}
#xw-root .xw-chip.is-on{animation:xw-chip-on 260ms var(--xw-ease-back)}
@keyframes xw-chip-on{from{transform:scale(.94)}to{transform:none}}
#xw-root.xw-reduce .xw-chip,#xw-root.xw-reduce .xw-chip.is-on{transform:none!important;animation:none!important}

/* ===== @xw:panel ===== */
/* Panel öffnen. Mapping Prototyp → preload.js: .xw-open → #xw-root.xw-open, .xw-slide → #xw-panel,
   .xw-backdrop → #xw-backdrop, .xw-toggle → #xw-toggle. Die !important-Abschirmung von preload.js bleibt. */
#xw-backdrop{opacity:0;pointer-events:none;transition:opacity 220ms var(--xw-ease-in)!important}
#xw-root.xw-open #xw-backdrop{opacity:1;pointer-events:auto;transition:opacity 300ms var(--xw-ease-out)!important}
#xw-panel{transform:translateX(-100%);visibility:hidden;transition:transform 220ms var(--xw-ease-in),box-shadow 220ms,visibility 0s 220ms!important}
#xw-root.xw-open #xw-panel{transform:none;visibility:visible;box-shadow:24px 0 64px rgba(0,0,0,.5);transition:transform 340ms var(--xw-ease-out),box-shadow 340ms,visibility 0s!important}
#xw-panel .xw-stag{opacity:0;transform:translateX(-10px);transition:opacity 120ms,transform 120ms}
#xw-root.xw-open #xw-panel .xw-stag{opacity:1;transform:none;transition:opacity 280ms var(--xw-ease-out),transform 280ms var(--xw-ease-out);transition-delay:calc(min(var(--xw-i,0),10) * 30ms + 120ms)}
#xw-toggle{transition:opacity .15s,background .2s,transform 240ms var(--xw-ease-back)!important}
#xw-toggle:hover{background:rgba(255,255,255,.06)!important}
#xw-toggle:active{transform:scale(.92);transition-duration:.15s,.2s,90ms!important}
#xw-root.xw-reduce #xw-panel,#xw-root.xw-reduce #xw-panel .xw-stag{transform:none!important}
#xw-root.xw-reduce #xw-panel{opacity:0;transition:opacity 200ms ease,visibility 0s 200ms!important}
#xw-root.xw-reduce.xw-open #xw-panel{opacity:1;transition:opacity 200ms ease,visibility 0s!important}

/* ===== @xw:roll ===== */
/* Saldo-Update: alter Wert rollt raus, neuer rein; kurze Tönung nach oben/unten. Container .xw-roll */
#xw-root .xw-roll{display:inline-grid;overflow:hidden;vertical-align:bottom}
#xw-root .xw-roll>span{grid-area:1/1;white-space:nowrap}
#xw-root .xw-roll-out{animation:xw-roll-out 220ms var(--xw-ease-in) both}
#xw-root .xw-roll-in{animation:xw-roll-in 320ms var(--xw-ease-out) 60ms both}
#xw-root .xw-roll-in.is-up{animation:xw-roll-in 320ms var(--xw-ease-out) 60ms both,xw-tint-up 1200ms ease-out 60ms both}
#xw-root .xw-roll-in.is-down{animation:xw-roll-in 320ms var(--xw-ease-out) 60ms both,xw-tint-down 1200ms ease-out 60ms both}
@keyframes xw-roll-out{to{opacity:0;transform:translateY(-45%)}}
@keyframes xw-roll-in{from{opacity:0;transform:translateY(45%);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}
@keyframes xw-tint-up{from{color:var(--xw-green)}to{color:var(--xw-text)}}
@keyframes xw-tint-down{from{color:var(--xw-red)}to{color:var(--xw-text)}}
#xw-root.xw-reduce .xw-roll-out{animation:xw-fade-out 160ms ease both}
#xw-root.xw-reduce .xw-roll-in{animation-name:xw-fade!important}
#xw-root.xw-reduce .xw-roll-in.is-up{animation:xw-fade 200ms ease both,xw-tint-up 1200ms ease-out both!important}
#xw-root.xw-reduce .xw-roll-in.is-down{animation:xw-fade 200ms ease both,xw-tint-down 1200ms ease-out both!important}
@keyframes xw-fade-out{to{opacity:0}}

/* ===== @xw:switch ===== */
/* Wallet-Wechsel: Markierungsbalken, Status-Punkt springt mit einem Puls ein */
#xw-root .xw-item:before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:2px;border-radius:2px;background:linear-gradient(180deg,var(--xw-cyan),var(--xw-violet));opacity:0;transform:scaleY(.2);transition:opacity 150ms var(--xw-ease-in),transform 150ms var(--xw-ease-in)}
#xw-root .xw-item.is-current:before{opacity:1;transform:none;transition:opacity 200ms var(--xw-ease-out),transform 260ms var(--xw-ease-out)}
#xw-root .xw-item.is-live .xw-avatar:after{animation:xw-dot 320ms var(--xw-ease-back) both}
#xw-root .xw-avatar:before{content:"";position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:var(--xw-green);opacity:0;pointer-events:none}
#xw-root .xw-item.is-current .xw-avatar:before{background:var(--xw-cyan)}
#xw-root .xw-item.is-live .xw-avatar:before{animation:xw-dot-pulse 700ms var(--xw-ease-out) 120ms both}
#xw-root .xw-item.is-live .xw-badge{animation:xw-fade 200ms var(--xw-ease-out) both}
@keyframes xw-dot{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}
@keyframes xw-dot-pulse{from{transform:scale(1);opacity:.5}to{transform:scale(2.6);opacity:0}}
#xw-root.xw-reduce .xw-item:before{transform:none!important}
#xw-root.xw-reduce .xw-item.is-live .xw-avatar:after{animation-name:xw-fade}
#xw-root.xw-reduce .xw-item.is-live .xw-avatar:before{animation:none}

/* ===== @xw:delete ===== */
/* Löschen bestätigen: Name tippen → Button „scharf“; falsche Eingabe → kurzes Schütteln + roter Rand */
#xw-root .xw-btn.is-danger[aria-disabled="true"]{opacity:.5;cursor:not-allowed}
#xw-root .xw-btn.is-danger{transition:opacity 200ms var(--xw-ease-out),transform 240ms var(--xw-ease-back)}
#xw-root .xw-btn.is-danger:before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(-90deg,#ff4d6a,#ff8181);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity 200ms var(--xw-ease-out)}
#xw-root .xw-btn.is-danger:not([aria-disabled="true"]):before{opacity:1}
#xw-root .xw-btn.is-danger.is-armed{animation:xw-arm 260ms var(--xw-ease-back)}
@keyframes xw-arm{from{transform:scale(.97)}to{transform:none}}
#xw-root .xw-input.is-error{border-color:rgba(255,129,129,.7);box-shadow:0 0 0 3px rgba(255,129,129,.12)}
#xw-root .xw-shake{animation:xw-shake 320ms cubic-bezier(.36,.07,.19,.97) both}
@keyframes xw-shake{15%{transform:translateX(-4px)}35%{transform:translateX(4px)}55%{transform:translateX(-2.5px)}75%{transform:translateX(1.5px)}100%{transform:none}}
#xw-root.xw-reduce .xw-shake,#xw-root.xw-reduce .xw-btn.is-danger.is-armed{animation:none}

/* ----- Ergänzungen für preload.js (nicht Teil des Handoffs) ----- */
/* Symbol im Toast wechselt je nach Art (ok/Fehler/neutral) */
#xw-root .xw-toast-ico{display:flex;flex:none}
/* Formular-Einblendung ohne Versatz bei weniger Bewegung */
#xw-root.xw-reduce form:not(.xw-hide){animation-name:xw-fade}
`

  // -------------------------------------------------------------------------------------------
  // Texte. Die Sprache folgt Exodus' Einstellung (selectors.locale.language, von main.js geliefert);
  // Exodus-Desktop ist derzeit nur Englisch. Unbekannte Sprachen fallen auf Englisch zurück, Zahlen
  // und Daten werden trotzdem im Format der Exodus-Sprache angezeigt (Intl kann jede Sprache).
  // -------------------------------------------------------------------------------------------
  const TEXTS = {
    en: {
      q: (s) => `“${s}”`,
      standard: 'Default',
      toggleTitle: 'Wallets: view, switch or create wallets',
      toggleAria: 'Open wallet sidebar',
      intro: 'Each wallet has its own 12-word phrase and up to 3 portfolios.',
      close: 'Close',
      yourWallets: 'Your wallets',
      sumLabel: 'Total of all wallets',
      sumMissing: (n) => `excluding ${n} wallet${n > 1 ? 's' : ''} with unknown balance`,
      foot: 'Balances: last known value from Exodus (saved, not live). Click a wallet to open it in a new window.',
      loading: 'Loading wallets …',
      create: 'Create new wallet',
      restore: 'Restore wallet with 12 words',
      importOld: (name) => `Import old folder ${TEXTS.en.q(name)}`,
      cancel: 'Cancel',
      showBalances: 'Show balances',
      hideBalances: 'Hide balances',
      badgeHere: 'This window',
      badgeOpen: 'Open',
      balWaitRestore: 'Waiting for the 12 words',
      balNew: 'New – set up when opened',
      balUnknown: 'Balance unknown – open it once',
      updated: (when) => `Updated ${when}`,
      justNow: 'just now',
      minAgo: (n) => `${n} min ago`,
      hrsAgo: (n) => `${n} h ago`,
      onDate: (date, time) => `on ${date}, ${time}`,
      itemCurrent: 'This wallet is open in this window',
      itemRunning: 'Switch to this wallet’s window',
      itemOpen: 'Open in a new window',
      toolSwitch: 'Switch: open this wallet and close this window',
      toolRename: 'Rename',
      toolShortcut: 'Create desktop shortcut',
      toolFolder: 'Show data folder',
      alreadyHere: 'This wallet is already open in this window.',
      switching: (n) => `Switching to ${n} …`,
      broughtFront: (n) => `${n} is already open – bringing its window to the front.`,
      opening: (n) => `Opening ${n} in a new window …`,
      shortcutDone: (file) => `Shortcut ${TEXTS.en.q(file)} created on the desktop.`,
      createTitle: 'Create new wallet',
      createHint: 'Exodus opens the new wallet in its own window and creates a new 12-word phrase there. Write it down right away (Exodus: Settings → Security)!',
      createOk: 'Create and open',
      createDone: (n) => `${n} was created and opens in a new window. Back up the 12 words there right away!`,
      restoreTitle: 'Restore wallet with 12 words',
      restoreHint: 'A new Exodus window opens where you enter the 12 words. You only type them into Exodus – the sidebar never sees them.',
      restoreOk: 'Continue to entry',
      restoreDone: (n) => `${n} was created. Enter your 12 words in the new Exodus window.`,
      renameTitle: (n) => `Rename ${n}`,
      renameOk: 'Rename',
      renameDone: (n) => `Renamed to ${n}.`,
      importTitle: (n) => `Import old folder ${n}`,
      importHint: 'The folder is copied as its own wallet, the original stays untouched. Open the wallet afterwards and check that everything is correct.',
      importOk: 'Import',
      importDone: (n) => `${n} was imported. Open it once now to check it.`,
      unknownError: 'Unknown error',
      walletsCount: (n) => `${n} wallet${n === 1 ? '' : 's'}`,
      badgeStart: 'Start',
      menuLabel: 'More actions',
      mOpen: 'Open in new window',
      mFocus: 'Go to its window',
      mSwitch: 'Switch to this wallet',
      mClose: 'Close wallet',
      mCopy: 'Copy address …',
      mMultiCopy: 'Export addresses …',
      exportAll: 'All',
      exportHint: 'Pick the portfolios (and optionally a coin via search). Copies every matching address, one per line.',
      exportBtn: (n) => `Copy ${n} address${n === 1 ? '' : 'es'}`,
      exportBtnDone: (n) => `Copied ${n} address${n === 1 ? '' : 'es'}`,
      exportCopied: (n) => `${n} address${n === 1 ? '' : 'es'} copied (one per line).`,
      exportNone: 'No addresses match your selection.',
      exportAllWallets: 'Export addresses · all wallets',
      exportWalletsHint: 'Pick the wallets (and optionally a coin via search). Copies every matching address across them, one per line.',
      exportGlobalTitle: 'Export addresses across all wallets',
      mBackup: 'Show 12 words',
      mStart: 'Open when Exodus starts',
      mStartActive: 'Opens when Exodus starts',
      mRename: 'Rename',
      mShortcut: 'Desktop shortcut',
      mFolder: 'Show data folder',
      closing: (n) => `Closing ${n} …`,
      closed: (n) => `${n} was closed.`,
      startDone: (n) => `${n} now opens when you start Exodus.`,
      backupHere: 'Exodus shows the 12 words after you enter your password there.',
      backupOther: (n) => `${n} opens on its backup page – Exodus asks for the password there.`,
      renameStandardHint: 'Only the display name changes – the wallet stays where it is. Leave empty to use the default name.',
      renameRunningHint: 'This wallet is open in another window. It has to be closed to be renamed.',
      renameCurrentHint: 'This is the wallet of this window. The window closes for renaming.',
      renameClose: 'Close & rename',
      renameCloseReopen: 'Close, rename & reopen',
      renameClosing: 'The window closes and the wallet is renamed …',
      addrTitle: (n) => `Addresses · ${n}`,
      addrFilter: 'Search coin …',
      addrEmpty: 'No saved addresses yet. Open this wallet once – its addresses are remembered after that.',
      addrNoMatch: 'No coin matches your search.',
      addrSaved: (when) => `Saved ${when}`,
      addrCopied: (ticker) => `${ticker} address copied.`,
      addrNote: 'Receive addresses only. Always double-check an address after pasting it.',
      addrPortfolioEmpty: 'No addresses saved for this portfolio yet. Open this wallet once and leave it running for about 20 seconds.',
      fastSwitch: 'Switch',
      fastSwitchTitle: 'Switch to this wallet (closes this window)',
      addrAll: 'All portfolios',
      addrCopiedFrom: (ticker, portfolio) => `${ticker} address from “${portfolio}” copied.`,
      addrOk: 'Address copied',
      addrPortfolios: 'Portfolios',
      back: 'Back',
      mAvatar: 'Change picture …',
      mAvatarReset: 'Use Exodus icon',
      avatarDone: 'Picture updated.',
      avatarResetDone: 'Exodus icon restored.',
      mDelete: 'Delete wallet …',
      deleteTitle: (n) => `Delete ${n}`,
      deleteHint: (balance, running) => 'The wallet folder is moved to the Windows Recycle Bin. Once the Recycle Bin is emptied, the funds in this wallet can only be recovered with its 12-word phrase.' +
        (balance ? ` Last known balance: ${balance}.` : '') +
        (running ? ' The wallet is open and will be closed first.' : '') +
        ' Type the wallet name to confirm.',
      deleteOk: 'Move to Recycle Bin',
      deleteCloseOk: 'Close & move to Recycle Bin',
      deleteBackupFirst: 'Show 12 words first',
      deleteDone: (n) => `${n} was moved to the Recycle Bin.`,
    },
    de: {
      q: (s) => `„${s}“`,
      standard: 'Standard',
      toggleTitle: 'Wallets: alle Wallets anzeigen, wechseln oder neue erstellen',
      toggleAria: 'Wallet-Seitenleiste öffnen',
      intro: 'Jede Wallet hat ihre eigene 12-Wörter-Phrase und bis zu 3 Portfolios.',
      close: 'Schließen',
      yourWallets: 'Deine Wallets',
      sumLabel: 'Summe aller Wallets',
      sumMissing: (n) => `ohne ${n} Wallet${n > 1 ? 's' : ''} mit noch unbekanntem Kontostand`,
      foot: 'Kontostände: letzter bekannter Stand aus Exodus (gespeichert, nicht live). Klick auf eine Wallet öffnet sie in einem neuen Fenster.',
      loading: 'Wallets werden geladen …',
      create: 'Neue Wallet erstellen',
      restore: 'Wallet mit 12 Wörtern wiederherstellen',
      importOld: (name) => `Alten Ordner ${TEXTS.de.q(name)} übernehmen`,
      cancel: 'Abbrechen',
      showBalances: 'Kontostände anzeigen',
      hideBalances: 'Kontostände verbergen',
      badgeHere: 'Dieses Fenster',
      badgeOpen: 'Geöffnet',
      balWaitRestore: 'Wartet auf die 12 Wörter',
      balNew: 'Neu – wird beim Öffnen eingerichtet',
      balUnknown: 'Kontostand noch unbekannt – einmal öffnen',
      updated: (when) => `Stand ${when}`,
      justNow: 'gerade eben',
      minAgo: (n) => `vor ${n} Min.`,
      hrsAgo: (n) => `vor ${n} Std.`,
      onDate: (date, time) => `vom ${date}, ${time}`,
      itemCurrent: 'Diese Wallet ist in diesem Fenster geöffnet',
      itemRunning: 'Zum Fenster dieser Wallet wechseln',
      itemOpen: 'In einem neuen Fenster öffnen',
      toolSwitch: 'Wechseln: diese Wallet öffnen und dieses Fenster schließen',
      toolRename: 'Umbenennen',
      toolShortcut: 'Verknüpfung auf dem Desktop erstellen',
      toolFolder: 'Datenordner anzeigen',
      alreadyHere: 'Diese Wallet ist bereits in diesem Fenster geöffnet.',
      switching: (n) => `Wechsle zu ${n} …`,
      broughtFront: (n) => `${n} ist schon geöffnet – das Fenster wird nach vorne geholt.`,
      opening: (n) => `${n} wird in einem neuen Fenster geöffnet …`,
      shortcutDone: (file) => `Verknüpfung ${TEXTS.de.q(file)} auf dem Desktop erstellt.`,
      createTitle: 'Neue Wallet erstellen',
      createHint: 'Exodus öffnet die neue Wallet in einem eigenen Fenster und erstellt dort eine neue 12-Wörter-Phrase. Schreibe sie sofort auf (Exodus: Einstellungen → Sicherheit)!',
      createOk: 'Erstellen und öffnen',
      createDone: (n) => `${n} wurde angelegt und öffnet sich in einem neuen Fenster. Sichere dort sofort die 12 Wörter!`,
      restoreTitle: 'Wallet mit 12 Wörtern wiederherstellen',
      restoreHint: 'Es öffnet sich ein neues Exodus-Fenster, in dem du die 12 Wörter eingibst. Die Wörter gibst du nur dort in Exodus ein – die Seitenleiste sieht sie nie.',
      restoreOk: 'Weiter zur Eingabe',
      restoreDone: (n) => `${n} wurde angelegt. Gib im neuen Exodus-Fenster deine 12 Wörter ein.`,
      renameTitle: (n) => `${n} umbenennen`,
      renameOk: 'Umbenennen',
      renameDone: (n) => `Umbenannt in ${n}.`,
      importTitle: (n) => `Alten Ordner ${n} übernehmen`,
      importHint: 'Der Ordner wird als eigene Wallet kopiert, das Original bleibt unverändert. Öffne die Wallet danach und prüfe, ob alles stimmt.',
      importOk: 'Übernehmen',
      importDone: (n) => `${n} wurde übernommen. Öffne sie jetzt einmal zum Prüfen.`,
      unknownError: 'Unbekannter Fehler',
      walletsCount: (n) => `${n} Wallet${n === 1 ? '' : 's'}`,
      badgeStart: 'Start',
      menuLabel: 'Weitere Aktionen',
      mOpen: 'In neuem Fenster öffnen',
      mFocus: 'Zum Fenster wechseln',
      mSwitch: 'Zu dieser Wallet wechseln',
      mClose: 'Wallet schließen',
      mCopy: 'Adresse kopieren …',
      mMultiCopy: 'Adressen exportieren …',
      exportAll: 'Alle',
      exportHint: 'Wähle die Portfolios (optional per Suche einen Coin). Kopiert alle passenden Adressen, eine pro Zeile.',
      exportBtn: (n) => `${n} Adresse${n === 1 ? '' : 'n'} kopieren`,
      exportBtnDone: (n) => `${n} Adresse${n === 1 ? '' : 'n'} kopiert`,
      exportCopied: (n) => `${n} Adresse${n === 1 ? '' : 'n'} kopiert (eine pro Zeile).`,
      exportNone: 'Keine Adresse passt zur Auswahl.',
      exportAllWallets: 'Adressen exportieren · alle Wallets',
      exportWalletsHint: 'Wähle die Wallets (optional per Suche einen Coin). Kopiert alle passenden Adressen wallet-übergreifend, eine pro Zeile.',
      exportGlobalTitle: 'Adressen über alle Wallets exportieren',
      mBackup: '12 Wörter anzeigen',
      mStart: 'Beim Exodus-Start öffnen',
      mStartActive: 'Öffnet beim Exodus-Start',
      mRename: 'Umbenennen',
      mShortcut: 'Desktop-Verknüpfung',
      mFolder: 'Datenordner anzeigen',
      closing: (n) => `${n} wird geschlossen …`,
      closed: (n) => `${n} wurde geschlossen.`,
      startDone: (n) => `${n} öffnet sich jetzt beim Start von Exodus.`,
      backupHere: 'Exodus zeigt die 12 Wörter, nachdem du dort dein Passwort eingegeben hast.',
      backupOther: (n) => `${n} öffnet sich auf der Backup-Seite – Exodus fragt dort nach dem Passwort.`,
      renameStandardHint: 'Nur der Anzeigename ändert sich – die Wallet bleibt, wo sie ist. Leer lassen für den Standardnamen.',
      renameRunningHint: 'Diese Wallet ist in einem anderen Fenster geöffnet. Zum Umbenennen muss sie geschlossen werden.',
      renameCurrentHint: 'Das ist die Wallet dieses Fensters. Das Fenster schließt sich zum Umbenennen.',
      renameClose: 'Schließen & umbenennen',
      renameCloseReopen: 'Schließen, umbenennen & öffnen',
      renameClosing: 'Das Fenster schließt sich und die Wallet wird umbenannt …',
      addrTitle: (n) => `Adressen · ${n}`,
      addrFilter: 'Coin suchen …',
      addrEmpty: 'Noch keine Adressen gespeichert. Öffne diese Wallet einmal – danach sind ihre Adressen gespeichert.',
      addrNoMatch: 'Kein Coin passt zur Suche.',
      addrSaved: (when) => `Gespeichert ${when}`,
      addrCopied: (ticker) => `${ticker}-Adresse kopiert.`,
      addrNote: 'Nur Empfangsadressen. Prüfe eine Adresse nach dem Einfügen immer noch einmal.',
      addrPortfolioEmpty: 'Für dieses Portfolio sind noch keine Adressen gespeichert. Öffne die Wallet einmal und lass sie etwa 20 Sekunden laufen.',
      fastSwitch: 'Wechseln',
      fastSwitchTitle: 'Zu dieser Wallet wechseln (schließt dieses Fenster)',
      addrAll: 'Alle Portfolios',
      addrCopiedFrom: (ticker, portfolio) => `${ticker}-Adresse aus „${portfolio}“ kopiert.`,
      addrOk: 'Adresse kopiert',
      addrPortfolios: 'Portfolios',
      back: 'Zurück',
      mAvatar: 'Bild ändern …',
      mAvatarReset: 'Exodus-Symbol verwenden',
      avatarDone: 'Bild geändert.',
      avatarResetDone: 'Exodus-Symbol wiederhergestellt.',
      mDelete: 'Wallet löschen …',
      deleteTitle: (n) => `${n} löschen`,
      deleteHint: (balance, running) => 'Der Wallet-Ordner wird in den Windows-Papierkorb verschoben. Sobald der Papierkorb geleert ist, lässt sich das Guthaben dieser Wallet nur noch mit ihren 12 Wörtern wiederherstellen.' +
        (balance ? ` Letzter bekannter Kontostand: ${balance}.` : '') +
        (running ? ' Die Wallet ist geöffnet und wird vorher geschlossen.' : '') +
        ' Tippe zur Bestätigung den Namen der Wallet ein.',
      deleteOk: 'In den Papierkorb verschieben',
      deleteCloseOk: 'Schließen & in den Papierkorb',
      deleteBackupFirst: 'Zuerst 12 Wörter anzeigen',
      deleteDone: (n) => `${n} liegt jetzt im Papierkorb.`,
    },
  }

  // Exodus' Standard ist Englisch – bis main.js die echte Einstellung liefert, gilt das
  let language = 'en'
  let T = TEXTS.en
  function setLanguage (lang) {
    const raw = String(lang || 'en')
    const base = raw.toLowerCase().split(/[-_]/)[0]
    language = raw.replace('_', '-')
    T = TEXTS[base] || TEXTS.en
  }
  // Intl-Locale: "en" allein ergibt US-Format ($1,234.56); Fehler bei exotischen Codes abfangen
  const intlLocale = () => {
    try { return Intl.NumberFormat.supportedLocalesOf([language]).length ? language : 'en' } catch (e) { return 'en' }
  }

  function el (tag, props, ...children) {
    const node = document.createElement(tag)
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue
      if (k === 'class') node.className = v
      else if (k === 'text') node.textContent = v
      else if (k === 'html') node.innerHTML = v // nur für die festen SVG-Symbole oben
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
      else node.setAttribute(k, v === true ? '' : String(v))
    }
    for (const c of children.flat()) {
      if (c != null && c !== false) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
    }
    return node
  }

  // Motion-Helfer aus design_handoff_sidebar_motion/xw-motion.js – nur Klassen setzen/entfernen.
  // Im Scope dieses Skripts statt als window.XW (isolierte Welt, nichts nach außen geben).
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)')
  const XW = {
    // Reduced-Motion auf #xw-root spiegeln
    syncReduce (root) {
      const set = () => root.classList.toggle('xw-reduce', reduceQuery.matches)
      set(); reduceQuery.addEventListener('change', set)
    },
    // Kopier-Bestätigung (Button + Zeile): .is-copied setzen, nach hold entfernen. Erneuter Klick verlängert nur.
    confirm (el, hold = 1800) {
      clearTimeout(el._xwT)
      if (!el.classList.contains('is-copied')) el.classList.add('is-copied')
      el._xwT = setTimeout(() => el.classList.remove('is-copied'), hold)
    },
    // Keyframe-Animation neu starten
    replay (el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls) },
    // Einmal-Klasse, entfernt sich nach animationend selbst
    once (el, cls) {
      XW.replay(el, cls)
      el.addEventListener('animationend', function h (e) { if (e.target === el) { el.classList.remove(cls); el.removeEventListener('animationend', h) } })
    },
    // kind: 'ok' | 'error' | '' (neutral, Verlaufsbalken). Leeres kind setzt keine is-*-Klasse.
    toast (el, text, kind = 'ok', hold = 2400) {
      clearTimeout(el._xwT)
      el.querySelector('.xw-toast-text').textContent = text
      el.classList.remove('is-ok', 'is-error'); if (kind) el.classList.add('is-' + kind)
      el.style.setProperty('--xw-toast', hold + 'ms')
      XW.replay(el, 'is-show')
      el._xwT = setTimeout(() => el.classList.remove('is-show'), hold)
    },
    // Saldo rollen: host = .xw-roll, dir = 'up' | 'down' | ''
    roll (host, text, dir) {
      const old = host.querySelector('.xw-roll-cur')
      const n = document.createElement('span')
      n.className = 'xw-roll-cur xw-roll-in' + (dir ? ' is-' + dir : '')
      n.textContent = text
      host.appendChild(n)
      if (old) {
        old.className = 'xw-roll-out'
        old.addEventListener('animationend', () => old.remove(), { once: true })
      }
    },
  }

  // Währung kommt pro Wallet aus deren Exodus-Einstellung (USD, EUR, …), das Zahlenformat aus der Sprache
  function money (value, currency) {
    if (typeof value !== 'number' || !isFinite(value)) return '–'
    const locale = intlLocale()
    try {
      if (currency && /^[A-Z]{3}$/.test(currency)) return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
    } catch (e) {}
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + (currency ? ' ' + currency : '')
  }

  function ago (iso) {
    const time = Date.parse(iso)
    if (!time) return ''
    const s = Math.max(0, (Date.now() - time) / 1000)
    if (s < 90) return T.justNow
    if (s < 3600) return T.minAgo(Math.round(s / 60))
    if (s < 86400) return T.hrsAgo(Math.round(s / 3600))
    const d = new Date(time)
    const locale = intlLocale()
    return T.onDate(d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }))
  }

  // label kommt von main.js (eigener Name der Standard-Wallet); Fallback für ältere Zustände
const labelOf = (w) => w.label || (w.isStandard ? T.standard : w.name)

  function start () {
    debug('start() aufgerufen')
    if (document.getElementById('xw-root')) {
      debug('xw-root existiert bereits, abbruch')
      return
    }
    const style = el('style', { id: 'xw-style' })
    style.textContent = CSS
    ;(document.head || document.documentElement).appendChild(style)

    let state = null
    let open = false
    let refreshTimer = null
    // Vorherige Werte je Wallet: für Saldo-Roll (nur bei Änderung) und is-live (nur bei Statuswechsel)
    const prevValues = new Map()
    const prevStatus = new Map()

    // Feste Beschriftungen: [Element, Textschlüssel, Attribut oder null für den Text]. applyTexts()
    // setzt sie neu, sobald main.js eine andere Exodus-Sprache meldet.
    const labels = []
    const label = (node, key, attr = null) => { labels.push([node, key, attr]); return node }
    function applyTexts () {
      for (const [node, key, attr] of labels) {
        if (attr) node.setAttribute(attr, T[key])
        else node.textContent = T[key]
      }
      root.setAttribute('lang', language)
    }

    const count = el('span', { class: 'xw-count xw-hide' })
    const toggle = el('button', {
      id: 'xw-toggle',
      type: 'button',
      html: ICON.wallet(20),
      onclick: () => (open ? closePanel() : openPanel()),
    }, count)
    label(toggle, 'toggleTitle', 'title')
    label(toggle, 'toggleAria', 'aria-label')

    const eyeBtn = el('button', { type: 'button', class: 'xw-icon', onclick: toggleHide })
    // Summe staffelt beim Öffnen als zweites Element ein (Kopf 0, Summe 1, Wallet-Zeilen ab 2)
    const sumBox = el('div', { class: 'xw-sum xw-stag xw-hide', style: '--xw-i:1' })
    const list = el('div', { class: 'xw-list', role: 'list' })
    // Hinweis-Toast (ersetzt das frühere .xw-notice im Fußbereich – schwebt, verschiebt nichts)
    const toastIco = el('span', { class: 'xw-toast-ico', html: ICON.check(16) })
    const toastEl = el('div', { class: 'xw-toast', role: 'status', 'aria-live': 'polite' }, toastIco, el('span', { class: 'xw-toast-text' }))
    const oldBox = el('div')
    const actions = el('div', { class: 'xw-actions' },
      el('button', { type: 'button', class: 'xw-btn is-primary', onclick: startCreate, html: ICON.plus(18) }, label(el('span'), 'create')),
      el('button', { type: 'button', class: 'xw-btn', onclick: startRestore, html: ICON.restore(18) }, label(el('span'), 'restore')),
      oldBox)

    // Formular (Name eingeben) mit frei wählbaren Knöpfen – z. B. beim Umbenennen einer offenen Wallet
    // "Schließen & umbenennen" / "Schließen, umbenennen & öffnen" / "Abbrechen"
    const formTitle = el('div', { class: 'xw-form-title' })
    const formHint = el('div', { class: 'xw-form-hint' })
    const input = el('input', { class: 'xw-input', type: 'text', maxlength: 40, spellcheck: 'false', autocomplete: 'off' })
    const formError = el('div', { class: 'xw-form-error' })
    const formButtons = el('div')
    const form = el('form', { class: 'xw-hide', onsubmit: onSubmit }, formTitle, formHint, input, formError, formButtons)
    let formActions = []
    let formBusy = false

    // Adress-Ansicht: gleitet von rechts über die Liste
    const sheetTitle = el('div', { class: 'xw-sheet-title' })
    const sheetSub = el('div', { class: 'xw-sheet-sub' })
    const addrFilter = el('input', { class: 'xw-input', type: 'text', spellcheck: 'false', autocomplete: 'off', oninput: () => renderAddresses() })
    label(addrFilter, 'addrFilter', 'placeholder')
    const addrList = el('div', { class: 'xw-addr-list' })
    const addrChips = el('div', { class: 'xw-chips xw-hide', role: 'tablist' })
    label(addrChips, 'addrPortfolios', 'aria-label')
    const exportHint = label(el('div', { class: 'xw-sheet-sub xw-hide' }), 'exportHint')
    // Kopier-Knopf Variante 1A „Lichtschweif“: beide Beschriftungen liegen im selben Grid-Feld, die Breite
    // richtet sich nach der längeren – beim Wechsel springt nichts.
    const exportLabelA = el('span')
    const exportLabelB = el('span')
    const exportBtn = el('button', { type: 'button', class: 'xw-btn is-primary xw-cp xw-cp--trail', onclick: () => doExport() },
      el('span', { class: 'xw-cp-fx', 'aria-hidden': 'true' }, el('i', { class: 'xw-cp-ring' }), el('i', { class: 'xw-cp-comet' })),
      el('span', { class: 'xw-cp-halo', 'aria-hidden': 'true' }, el('i', { class: 'xw-cp-comet' })),
      el('span', { class: 'xw-cp-stack' },
        el('span', { class: 'xw-cp-a', html: ICON.copy(16) }, exportLabelA),
        el('span', { class: 'xw-cp-b', html: ICON.check(16) }, exportLabelB)))
    // Während „Copied“ bleibt die Zahl im zweiten Label stehen, auch wenn sich die Auswahl ändert
    function setExportLabels (n) {
      exportLabelA.textContent = T.exportBtn(n)
      if (!exportBtn.classList.contains('is-copied')) exportLabelB.textContent = T.exportBtnDone(n)
    }
    const exportBar = el('div', { class: 'xw-sheet-bar xw-hide' }, exportBtn)
    const sheetNote = label(el('div', { class: 'xw-sheet-note' }), 'addrNote')
    const sheet = el('div', { class: 'xw-sheet', 'aria-hidden': 'true' },
      el('div', { class: 'xw-sheet-head' },
        label(el('button', { type: 'button', class: 'xw-icon', html: ICON.back(18), onclick: () => closeSheet() }), 'back', 'title'),
        sheetTitle),
      sheetSub, addrFilter, exportHint, addrChips, addrList, exportBar, sheetNote)
    let sheetWallet = null
    let sheetAddresses = []
    let sheetPortfolioNames = []
    // Gewähltes Portfolio (account-Name wie "exodus_1") je Wallet merken – null = alle
    const sheetPortfolioByWallet = new Map()
    // Export-Modus: Mehrfachauswahl, dann alle Adressen als Liste kopieren.
    // sheetCross = wallet-übergreifend (Auswahl = Wallets); sonst pro Wallet (Auswahl = Portfolios).
    let sheetExport = false
    let sheetCross = false
    let sheetSelected = new Set()

    // Hauptansicht in .xw-view: weicht nach links, wenn die Adress-Ansicht (.xw-sheet) hereingleitet.
    // Beide sind direkte Kinder des Panels; umgeschaltet wird mit .is-sheet am Panel.
    const view = el('div', { class: 'xw-view' },
      sumBox,
      label(el('div', { class: 'xw-intro' }), 'intro'),
      el('div', { class: 'xw-section' }, label(el('div', { class: 'xw-label' }), 'yourWallets')),
      list,
      el('div', { class: 'xw-bottom' }, actions, form),
      label(el('div', { class: 'xw-foot' }), 'foot'))
    const panel = el('aside', { id: 'xw-panel', tabindex: '-1', 'aria-label': 'Wallets' },
      el('div', { class: 'xw-head xw-stag', style: '--xw-i:0' },
        el('div', { class: 'xw-head-text' },
          el('div', { class: 'xw-kicker', text: 'Exodus' }),
          el('div', { class: 'xw-title', text: 'Wallets' })),
        label(el('button', { type: 'button', class: 'xw-icon', html: ICON.list(18), onclick: () => openCrossExport() }), 'exportGlobalTitle', 'title'),
        eyeBtn,
        label(el('button', { type: 'button', class: 'xw-icon', html: ICON.close(18), onclick: () => closePanel() }), 'close', 'title')),
      view,
      sheet,
      toastEl)

    // Exodus-Tastenkürzel nicht auslösen, während in der Seitenleiste getippt wird
    for (const type of ['keydown', 'keyup', 'keypress']) panel.addEventListener(type, (e) => e.stopPropagation())
    document.addEventListener('keydown', (e) => {
      if (!open || e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (menu) closeMenu()
      else if (panel.classList.contains('is-sheet')) closeSheet()
      else if (!form.classList.contains('xw-hide')) hideForm()
      else closePanel()
    }, true)

    const root = el('div', { id: 'xw-root' }, toggle, el('div', { id: 'xw-backdrop', onclick: () => closePanel() }), panel)
    document.body.appendChild(root)
    XW.syncReduce(root) // „weniger Bewegung“ als Klasse .xw-reduce spiegeln
    applyTexts()

    // Knopf vor dem Exodus-Logo platzieren (Header-Höhe/-Sichtbarkeit ändert sich je nach Ansicht)
    function placeToggle () {
      const nav = document.getElementById('global-navigation')
      const r = nav && nav.getBoundingClientRect()
      if (!r || r.height < 30 || r.width < 300) {
        toggle.classList.add('xw-hide')
        return
      }
      toggle.classList.remove('xw-hide')
      toggle.style.top = Math.round(r.top + r.height / 2 - 18) + 'px'
      toggle.style.left = Math.round(r.left + 24) + 'px'
    }
    placeToggle()
    setInterval(placeToggle, 600)
    window.addEventListener('resize', placeToggle)

    // Exodus setzt die Theme-Klasse (.exodus-theme-*) auf ein Element innerhalb von #app-container.
    // Unser #xw-root hängt direkt am body und erbt die Variablen deshalb nicht – also kopieren wir die
    // berechneten Werte herüber, sobald sich das Theme ändert.
    const THEME_VARS = [
      '--exodus-theme-base-color', '--exodus-theme-base-color-darken', '--exodus-theme-base-color-darken-more',
      '--exodus-theme-base-color-lighten', '--exodus-theme-base-color-lighten-more', '--exodus-theme-text-color',
    ]
    let themeKey = null
    function syncTheme () {
      const themed = document.querySelector('[class*="exodus-theme-"]')
      const key = themed ? (String(themed.className).match(/exodus-theme-[\w-]+/) || [''])[0] : ''
      if (key === themeKey) return
      themeKey = key
      const computed = getComputedStyle(themed || document.documentElement)
      for (const name of THEME_VARS) {
        const value = computed.getPropertyValue(name).trim()
        if (value) root.style.setProperty(name, value)
        else root.style.removeProperty(name)
      }
      debug(`Theme übernommen: ${key || '(Standard)'}`)
    }
    syncTheme()
    setInterval(syncTheme, 2000)

    // Wallet-Zeilen gestaffelt einblenden (@xw:stagger). .xw-anim bleibt nur kurz am Container: Zeilen, die in
    // dieser Zeit eingefügt werden (erstes Laden nach dem Öffnen), laufen mit; das 15-s-Neuzeichnen nicht.
    let listAnimTimer = null
    function animateList () {
      XW.replay(list, 'xw-anim')
      clearTimeout(listAnimTimer)
      listAnimTimer = setTimeout(() => list.classList.remove('xw-anim'), 1100)
    }

    function openPanel () {
      open = true
      animateList()
      syncTheme()
      root.classList.add('xw-open')
      toggle.setAttribute('aria-expanded', 'true')
      if (!state) list.replaceChildren(el('div', { class: 'xw-empty', text: T.loading }))
      refresh()
      clearInterval(refreshTimer)
      refreshTimer = setInterval(refresh, 15000)
      setTimeout(() => panel.focus(), 60)
    }

    function closePanel () {
      open = false
      root.classList.remove('xw-open')
      toggle.setAttribute('aria-expanded', 'false')
      clearInterval(refreshTimer)
      closeMenu()
      closeSheet()
      hideForm()
    }

    async function refresh () {
      try {
        state = await call('state')
        render()
      } catch (e) {
        showNotice(e.message, 'error')
      }
    }

    // Hinweise als Toast. Kurze Bestätigungen stehen 2,4 s (Handoff-Standard); längere Texte und Fehler
    // bleiben länger, damit man sie lesen kann. Die Restzeit-Linie läuft über genau diese Dauer.
    function showNotice (text, kind) {
      const len = String(text).length
      const hold = kind === 'error'
        ? Math.min(10000, Math.max(4000, 1500 + len * 50))
        : Math.min(8000, Math.max(2400, 1100 + len * 38))
      toastIco.innerHTML = kind === 'error' ? ICON.alert(16) : kind === 'ok' ? ICON.check(16) : ICON.info(16)
      XW.toast(toastEl, text, kind || '', hold)
    }
    const fail = (e) => showNotice(e.message, 'error')

    function render () {
      if (!state) return
      const lang = (state.locale && state.locale.language) || 'en'
      if (lang !== language) {
        setLanguage(lang)
        applyTexts()
        if (!form.classList.contains('xw-hide')) hideForm() // offenes Formular trüge noch die alte Sprache
      }
      const hide = !!state.settings.hideBalances
      eyeBtn.innerHTML = hide ? ICON.eyeOff(18) : ICON.eye(18)
      eyeBtn.title = hide ? T.showBalances : T.hideBalances
      count.textContent = String(state.wallets.length)
      count.classList.toggle('xw-hide', state.wallets.length < 2)
      renderSum(hide)
      // Offenes Menü gehört zu einem Element, das gleich ersetzt wird
      closeMenu()
      list.replaceChildren(...state.wallets.map((w, i) => renderWallet(w, hide, i)))
      oldBox.replaceChildren(...state.oldFolders.map((f) =>
        el('button', { type: 'button', class: 'xw-btn', onclick: () => startImport(f), html: ICON.import(18) },
          el('span', { text: T.importOld(f.name) }))))
    }

    // Saldo in .xw-roll verpacken (@xw:roll). Hat sich der Wert seit dem letzten Zeichnen geändert, rollt der
    // alte Wert raus und der neue rein – Richtung nach der Zahl. Beim ersten Zeichnen und bei verborgenen
    // Kontoständen (••••••) steht der Wert einfach da, ohne Animation.
    function rollHost (key, text, num, rollable) {
      const host = el('span', { class: 'xw-roll' })
      const prev = prevValues.get(key)
      prevValues.set(key, rollable ? { text, num } : null)
      if (rollable && prev && prev.text !== text) {
        host.appendChild(el('span', { class: 'xw-roll-cur', text: prev.text }))
        XW.roll(host, text, num > prev.num ? 'up' : num < prev.num ? 'down' : '')
      } else {
        host.appendChild(el('span', { class: 'xw-roll-cur', text }))
      }
      return host
    }

    // Summe aller Wallets. Verschiedene Währungen (z. B. eine Wallet in USD, eine in EUR) werden nicht
    // umgerechnet – dafür bräuchte es Wechselkurse aus dem Netz –, sondern als Teilsummen angezeigt.
    function renderSum (hide) {
      const known = state.wallets.filter((w) => w.cache && typeof w.cache.total === 'number')
      if (!known.length) {
        sumBox.classList.add('xw-hide')
        return
      }
      const byCurrency = new Map()
      for (const w of known) {
        const cur = w.cache.currency || ''
        byCurrency.set(cur, (byCurrency.get(cur) || 0) + w.cache.total)
      }
      const own = state.locale && state.locale.currency
      const groups = [...byCurrency.entries()].sort((a, b) => (b[0] === own) - (a[0] === own) || b[1] - a[1])
      const missing = state.wallets.filter((w) => w.hasWallet && !known.includes(w)).length
      const text = hide ? '••••••' : groups.map(([cur, sum]) => money(sum, cur || null)).join(' + ')
      sumBox.replaceChildren(
        el('div', { class: 'xw-sum-row' },
          el('div', { class: 'xw-label', text: T.sumLabel }),
          el('div', { class: 'xw-sum-count', text: T.walletsCount(state.wallets.length) })),
        // Bei mehreren Währungen rollt der ganze String; die Richtung kommt von der Hauptwährung
        el('div', { class: 'xw-sum-value' + (groups.length > 1 && !hide ? ' is-multi' : '') }, rollHost('sum', text, groups[0][1], !hide)),
        // replaceChildren() würde null als Text "null" einfügen, daher leeres Array statt null
        ...(missing ? [el('div', { class: 'xw-sum-note', text: T.sumMissing(missing) })] : []))
      sumBox.classList.remove('xw-hide')
    }

    function renderWallet (w, hide, index) {
      const cache = w.cache && typeof w.cache.total === 'number' ? w.cache : null
      let balance
      if (cache) balance = hide ? '••••••' : money(cache.total, cache.currency)
      else if (w.restorePending) balance = T.balWaitRestore
      else if (!w.hasWallet) balance = T.balNew
      else balance = T.balUnknown

      const badges = []
      if (w.isCurrent) badges.push(el('span', { class: 'xw-badge', text: T.badgeHere }))
      else if (w.running) badges.push(el('span', { class: 'xw-badge is-running', text: T.badgeOpen }))
      if (w.isStart && state.wallets.length > 1) badges.push(el('span', { class: 'xw-badge is-start', text: T.badgeStart }))

      // Portfolios in einer Zeile; passt es nicht, blendet die Zeile rechts aus und scrollt per Mausrad seitlich
      const ports = !hide && cache && cache.portfolios && cache.portfolios.length > 1
        ? el('div', {
          class: 'xw-ports',
          title: cache.portfolios.map((p) => `${p.name}: ${money(p.value, cache.currency)}`).join('\n'),
        }, ...cache.portfolios.map((p) =>
          el('span', { class: 'xw-port', text: `${p.name}: ${money(p.value, cache.currency)}` })))
        : null
      if (ports) {
        const updateEdge = () => {
          const overflow = ports.scrollWidth > ports.clientWidth + 1
          ports.classList.toggle('is-overflow', overflow)
          ports.classList.toggle('is-end', overflow && ports.scrollLeft + ports.clientWidth >= ports.scrollWidth - 1)
        }
        ports.addEventListener('scroll', updateEdge)
        ports.addEventListener('wheel', (e) => {
          if (ports.scrollWidth <= ports.clientWidth + 1 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
          const max = ports.scrollWidth - ports.clientWidth
          const atEnd = (e.deltaY > 0 && ports.scrollLeft >= max - 1) || (e.deltaY < 0 && ports.scrollLeft <= 0)
          if (atEnd) return // am Rand normal weiter die Liste scrollen
          e.preventDefault()
          ports.scrollLeft += e.deltaY
        }, { passive: false })
        requestAnimationFrame(updateEdge)
      }

      const moreBtn = el('button', {
        type: 'button',
        class: 'xw-more',
        title: T.menuLabel,
        'aria-label': T.menuLabel,
        'aria-haspopup': 'menu',
        html: ICON.more(18),
        onclick: (e) => { e.stopPropagation(); toggleMenu(w, moreBtn) },
      })

      // Echter Statuswechsel (z. B. andere Wallet wurde gerade geöffnet)? Nicht bei jedem Neuzeichnen.
      const status = w.isCurrent ? 'current' : w.running ? 'running' : ''
      const becameLive = prevStatus.has(w.id) && prevStatus.get(w.id) !== status && !!status
      prevStatus.set(w.id, status)

      const name = labelOf(w)
      const item = el('div', {
        class: 'xw-item' + (w.isCurrent ? ' is-current' : w.running ? ' is-running' : ''),
        style: `--xw-i:${index + 2}`, // Kopf 0, Summe 1, Wallet-Zeilen ab 2
        role: 'listitem',
        tabindex: w.isCurrent ? null : '0',
        title: w.isCurrent ? T.itemCurrent : (w.running ? T.itemRunning : T.itemOpen),
      },
      // Eigenes Bild (data:-URL von main.js) oder das Exodus-Logo
      w.avatar
        ? el('div', { class: 'xw-avatar has-image' }, el('img', { src: w.avatar, alt: '', draggable: 'false' }))
        : el('div', { class: 'xw-avatar is-exodus' }),
      el('div', { class: 'xw-body' },
        el('div', { class: 'xw-name' }, el('span', { class: 'xw-name-text', text: name }), ...badges),
        el('div', { class: 'xw-bal' + (cache ? '' : ' is-muted') }, cache ? rollHost('w:' + w.id, balance, cache.total, !hide) : balance),
        cache ? el('div', { class: 'xw-meta', text: T.updated(ago(cache.updatedAt)) }) : null,
        ports),
      moreBtn)

      // Schnell wechseln: erscheint beim Drüberfahren, öffnet die Wallet und schließt dieses Fenster
      if (!w.isCurrent) {
        item.appendChild(el('button', {
          type: 'button',
          class: 'xw-fast',
          title: T.fastSwitchTitle,
          'aria-label': T.fastSwitchTitle,
          html: ICON.swap(14),
          onclick: (e) => { e.stopPropagation(); openWallet(w, true) },
        }, el('span', { text: T.fastSwitch })))
      }

      // Rechtsklick öffnet dasselbe Menü an der Mausposition
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleMenu(w, moreBtn, { x: e.clientX, y: e.clientY })
      })

      if (!w.isCurrent) {
        item.addEventListener('click', (e) => { if (!e.target.closest('.xw-more, .xw-fast')) openWallet(w, false) })
        item.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === item) openWallet(w, false) })
      }
      // Status-Punkt springt ein und pulsiert einmal (@xw:switch), danach Klasse wieder weg
      if (becameLive) {
        XW.replay(item, 'is-live')
        setTimeout(() => item.classList.remove('is-live'), 1000)
      }
      return item
    }

    // -----------------------------------------------------------------------------------------
    // 3-Punkte-Menü
    // -----------------------------------------------------------------------------------------

    let menu = null
    let menuButton = null

    function menuEntries (w) {
      const entries = []
      if (!w.isCurrent) {
        entries.push([ICON.open, w.running ? T.mFocus : T.mOpen, () => openWallet(w, false)])
        entries.push([ICON.swap, T.mSwitch, () => openWallet(w, true)])
        if (w.running) entries.push([ICON.power, T.mClose, () => closeWallet(w), 'is-danger'])
      }
      if (w.hasWallet) {
        entries.push('-')
        entries.push([ICON.copy, T.mCopy, () => openSheet(w)])
        entries.push([ICON.list, T.mMultiCopy, () => openSheet(w, true)])
        entries.push([ICON.key, T.mBackup, () => showBackup(w)])
      }
      entries.push('-')
      if (!w.external) {
        entries.push(w.isStart
          ? [ICON.check, T.mStartActive, null, 'is-checked']
          : [ICON.star, T.mStart, () => setStart(w)])
        entries.push([ICON.edit, T.mRename, () => startRename(w)])
      }
      entries.push([ICON.image, T.mAvatar, () => pickAvatar(w)])
      if (w.avatar) entries.push([ICON.reset, T.mAvatarReset, () => resetAvatar(w)])
      // Desktop-Verknüpfungen gibt es nur unter Windows (.lnk)
      if (!state || state.platform === 'win32') entries.push([ICON.desktop, T.mShortcut, () => makeShortcut(w)])
      entries.push([ICON.folder, T.mFolder, () => call('showFolder', w.id).catch(fail)])
      // Standard-Ordner gehört Exodus selbst; die eigene Wallet kann sich nicht aus dem Fenster heraus löschen
      if (!w.isStandard && !w.external && !w.isCurrent) {
        entries.push('-')
        entries.push([ICON.trash, T.mDelete, () => startDelete(w), 'is-danger'])
      }
      return entries.filter((e, i, all) => e !== '-' || (i > 0 && all[i - 1] !== '-'))
    }

    // point: Mausposition bei Rechtsklick – dann dort öffnen statt am ⋯-Knopf
    function toggleMenu (w, button, point) {
      if (menu && menuButton === button && !point) return closeMenu()
      closeMenu()
      const node = el('div', { class: 'xw-menu', role: 'menu' })
      let itemIndex = 0
      for (const entry of menuEntries(w)) {
        if (entry === '-') { node.appendChild(el('div', { class: 'xw-menu-sep' })); continue }
        const [icon, text, run, extra] = entry
        node.appendChild(el('button', {
          type: 'button',
          role: 'menuitem',
          class: 'xw-menu-item' + (extra ? ' ' + extra : ''),
          style: `--xw-i:${itemIndex++}`, // leicht gestaffeltes Einblenden
          html: icon(16),
          onclick: (e) => { e.stopPropagation(); if (!run) return; closeMenu(); run() },
        }, el('span', { text })))
      }
      panel.appendChild(node)
      // Unter dem Knopf, rechtsbündig; passt es unten nicht mehr hin, nach oben aufklappen
      const pr = panel.getBoundingClientRect()
      const br = button.getBoundingClientRect()
      const h = node.offsetHeight
      if (point) {
        // An der Maus, aber vollständig im Panel (sonst nach links/oben verschieben)
        const left = Math.min(Math.max(8, point.x - pr.left), pr.width - node.offsetWidth - 8)
        const top = Math.min(Math.max(8, point.y - pr.top), pr.height - h - 8)
        node.style.left = Math.round(left) + 'px'
        node.style.right = 'auto'
        node.style.top = Math.round(top) + 'px'
        node.style.transformOrigin = 'top left'
      } else {
        const spaceBelow = pr.bottom - br.bottom
        const spaceAbove = br.top - pr.top
        const below = spaceBelow >= h + 12 || spaceBelow >= spaceAbove
        const wanted = below ? br.bottom - pr.top + 4 : br.top - pr.top - h - 4
        // Nie über den Rand des Panels hinaus – notfalls überdeckt das Menü den eigenen Knopf
        const top = Math.min(Math.max(8, wanted), pr.height - h - 8)
        node.style.right = Math.max(8, Math.round(pr.right - br.right)) + 'px'
        node.style.top = Math.round(top) + 'px'
        // Klappt es nach oben auf, wächst es aus der unteren Ecke (früher Klasse .is-up)
        node.style.transformOrigin = below ? 'top right' : 'bottom right'
        button.setAttribute('aria-expanded', 'true')
      }
      menu = node
      menuButton = button
      button.classList.add('is-active')
      // Einen Frame später öffnen, damit die Transition vom geschlossenen Zustand aus läuft
      requestAnimationFrame(() => {
        if (menu !== node) return
        node.classList.add('is-open')
        const first = node.querySelector('.xw-menu-item:not(.is-checked)')
        if (first) first.focus()
      })
    }

    // Schließen: .is-open weg (120 ms ease-in), danach aus dem DOM
    function closeMenu () {
      if (!menu) return
      const node = menu
      node.classList.remove('is-open')
      setTimeout(() => node.remove(), 120)
      if (menuButton) {
        menuButton.classList.remove('is-active')
        menuButton.setAttribute('aria-expanded', 'false')
      }
      menu = null
      menuButton = null
    }
    panel.addEventListener('click', (e) => { if (menu && !menu.contains(e.target)) closeMenu() })
    list.addEventListener('scroll', closeMenu)

    // -----------------------------------------------------------------------------------------
    // Aktionen
    // -----------------------------------------------------------------------------------------

    async function openWallet (w, switchTo) {
      try {
        const res = await call('open', w.id, { switchTo })
        if (res.alreadyHere) return showNotice(T.alreadyHere)
        const name = T.q(labelOf(w))
        if (switchTo) showNotice(T.switching(name), 'ok')
        else if (res.wasRunning) showNotice(T.broughtFront(name), 'ok')
        else showNotice(T.opening(name), 'ok')
        setTimeout(refresh, 5000)
      } catch (e) {
        fail(e)
      }
    }

    async function closeWallet (w) {
      const name = T.q(labelOf(w))
      showNotice(T.closing(name))
      try {
        await call('close', w.id)
        showNotice(T.closed(name), 'ok')
        refresh()
      } catch (e) {
        fail(e)
      }
    }

    async function setStart (w) {
      try {
        await call('setStart', w.id)
        showNotice(T.startDone(T.q(labelOf(w))), 'ok')
        refresh()
      } catch (e) {
        fail(e)
      }
    }

    async function showBackup (w) {
      try {
        const res = await call('showBackup', w.id)
        if (res.here) {
          closePanel()
          return
        }
        showNotice(T.backupOther(T.q(labelOf(w))), 'ok')
        setTimeout(refresh, 5000)
      } catch (e) {
        fail(e)
      }
    }

    async function pickAvatar (w) {
      try {
        const res = await call('pickAvatar', w.id)
        if (res.canceled) return
        showNotice(T.avatarDone, 'ok')
        refresh()
      } catch (e) {
        fail(e)
      }
    }

    async function resetAvatar (w) {
      try {
        await call('resetAvatar', w.id)
        showNotice(T.avatarResetDone, 'ok')
        refresh()
      } catch (e) {
        fail(e)
      }
    }

    async function makeShortcut (w) {
      try {
        const res = await call('shortcut', w.id)
        showNotice(T.shortcutDone(res.file), 'ok')
      } catch (e) {
        fail(e)
      }
    }

    async function toggleHide () {
      if (!state) return
      try {
        state.settings = await call('settings', { hideBalances: !state.settings.hideBalances })
        render()
      } catch (e) {
        fail(e)
      }
    }

    // -----------------------------------------------------------------------------------------
    // Adressen kopieren – aus dem Adress-Cache, die Wallet muss dafür nicht geöffnet sein
    // -----------------------------------------------------------------------------------------

    function tickerStyle (ticker) {
      let h = 0
      for (const ch of ticker) h = (h * 31 + ch.codePointAt(0)) % 360
      return `background:linear-gradient(135deg,hsl(${h},45%,42%),hsl(${(h + 40) % 360},55%,30%))`
    }

    // Echtes Exodus-Icon (Pfad von main.js); fehlt es oder lädt es nicht, das Kürzel als Ersatz
    function coinIcon (a) {
      const fallback = () => el('div', { class: 'xw-addr-icon', style: tickerStyle(a.ticker), text: a.ticker.slice(0, 4) })
      if (!a.icon) return fallback()
      const img = el('img', { class: 'xw-addr-img', src: a.icon, alt: '', draggable: 'false' })
      img.addEventListener('error', () => img.replaceWith(fallback()), { once: true })
      return img
    }

    async function openSheet (w, exportMode) {
      sheetWallet = w
      sheetAddresses = []
      sheetPortfolioNames = []
      sheetExport = !!exportMode
      sheetCross = false
      sheetSelected = new Set()
      addrChips.classList.add('xw-hide')
      exportBar.classList.add('xw-hide')
      exportHint.classList.toggle('xw-hide', !sheetExport)
      exportHint.textContent = T.exportHint
      sheetNote.classList.toggle('xw-hide', sheetExport)
      sheetTitle.textContent = sheetExport ? T.mMultiCopy.replace(/\s*…$/, '') + ' · ' + labelOf(w) : T.addrTitle(labelOf(w))
      sheetSub.textContent = ''
      addrFilter.value = ''
      addrList.replaceChildren(el('div', { class: 'xw-empty', text: T.loading }))
      panel.classList.add('is-sheet')
      sheet.setAttribute('aria-hidden', 'false')
      setTimeout(() => addrFilter.focus(), 120)
      try {
        const res = await call('addresses', w.id)
        if (sheetWallet !== w || sheetCross) return
        sheetAddresses = res.addresses
        sheetPortfolioNames = Array.isArray(res.portfolioNames) ? res.portfolioNames : []
        sheetSub.textContent = res.updatedAt ? T.addrSaved(ago(res.updatedAt)) : ''
        if (sheetExport) sheetSelected = new Set(sheetPortfolios().map(([account]) => account)) // Start: alle
        renderAddresses()
      } catch (e) {
        addrList.replaceChildren(el('div', { class: 'xw-empty', text: e.message }))
      }
    }

    // Wallet-übergreifender Export: Auswahl = Wallets, kopiert deren Adressen als eine Liste
    async function openCrossExport () {
      closeMenu()
      sheetWallet = null
      sheetAddresses = []
      sheetPortfolioNames = []
      sheetExport = true
      sheetCross = true
      sheetSelected = new Set()
      addrChips.classList.add('xw-hide')
      exportBar.classList.add('xw-hide')
      exportHint.classList.remove('xw-hide')
      exportHint.textContent = T.exportWalletsHint
      sheetNote.classList.add('xw-hide')
      sheetTitle.textContent = T.exportAllWallets
      sheetSub.textContent = ''
      addrFilter.value = ''
      addrList.replaceChildren(el('div', { class: 'xw-empty', text: T.loading }))
      panel.classList.add('is-sheet')
      sheet.setAttribute('aria-hidden', 'false')
      if (!open) openPanel()
      setTimeout(() => addrFilter.focus(), 120)
      try {
        const res = await call('allAddresses')
        if (!sheetCross) return
        sheetAddresses = res.addresses
        sheetSelected = new Set(sheetWallets().map(([id]) => id)) // Start: alle Wallets
        renderAddresses()
      } catch (e) {
        addrList.replaceChildren(el('div', { class: 'xw-empty', text: e.message }))
      }
    }

    // Zurück: Sheet gleitet rechts raus, die Hauptansicht kommt zurück (@xw:sheet läuft rückwärts)
    function closeSheet () {
      sheetWallet = null
      sheetCross = false
      panel.classList.remove('is-sheet')
      sheet.setAttribute('aria-hidden', 'true')
    }

    // Wallets im Datenbestand (für den wallet-übergreifenden Export), Reihenfolge wie geliefert
    function sheetWallets () {
      const seen = new Map()
      for (const a of sheetAddresses) if (!seen.has(a.walletId)) seen.set(a.walletId, a.wallet || a.walletId)
      return [...seen.entries()]
    }

    // Auswahl-Schlüssel je Adresse: Wallet-übergreifend die Wallet, sonst das Portfolio
    const groupKey = (a) => (sheetCross ? a.walletId : a.account)
    const exportGroups = () => (sheetCross ? sheetWallets() : sheetPortfolios())

    // Portfolios in der Reihenfolge von Exodus (exodus_0, exodus_1, …) mit ihrem Anzeigenamen. Portfolios,
    // die Exodus kennt, zu denen aber noch keine Adressen gespeichert sind, bekommen den Schlüssel "name:<Name>"
    // und werden hinten angehängt – so sieht man sie trotzdem als Tab.
    function sheetPortfolios () {
      const seen = new Map()
      for (const a of sheetAddresses) if (!seen.has(a.account)) seen.set(a.account, a.portfolio || a.account)
      const list = [...seen.entries()].sort((x, y) => x[0].localeCompare(y[0], 'en', { numeric: true }))
      const known = new Set(list.map(([, name]) => name))
      for (const name of sheetPortfolioNames) if (!known.has(name)) { known.add(name); list.push(['name:' + name, name]) }
      return list
    }

    // groups: [key, label] – Portfolios (pro Wallet) oder Wallets (übergreifend). Der erste Chip ist „Alle“
    // (key null). Bleibt die Chip-Menge gleich, werden nur Zustände umgeschaltet – so laufen die Rand-
    // Überblendung und die kleine Feder beim Einschalten (@xw:chip). Neu gebaut wird nur bei neuer Menge.
    function renderChips (groups, selected) {
      // Bei einem einzelnen Portfolio im normalen Modus sind Tabs überflüssig; im Export-Modus zeigen
      // wir sie trotzdem (Mehrfachauswahl inkl. „Alle“).
      if (groups.length < 2 && !sheetExport) {
        addrChips.classList.add('xw-hide')
        addrChips.dataset.sig = ''
        return
      }
      const sig = [language, sheetExport ? 'x' : 'n', ...groups.map(([k, n]) => k + '=' + n)].join('|')
      if (addrChips.dataset.sig !== sig) {
        addrChips.dataset.sig = sig
        const make = (key, text) => {
          const node = el('button', { type: 'button', class: 'xw-chip', role: sheetExport ? null : 'tab', text, onclick: () => onChip(key) })
          node.xwKey = key
          return node
        }
        addrChips.replaceChildren(make(null, sheetExport ? T.exportAll : T.addrAll), ...groups.map(([key, name]) => make(key, name)))
      }
      // „Alle“ ist exklusiv: sind alle gewählt, leuchtet nur „Alle“
      const allSelected = sheetExport && groups.length > 0 && groups.every(([key]) => sheetSelected.has(key))
      for (const chip of addrChips.children) {
        const key = chip.xwKey
        const on = sheetExport ? (key === null ? allSelected : !allSelected && sheetSelected.has(key)) : selected === key
        const was = chip.classList.contains('is-active')
        chip.classList.toggle('is-active', on)
        if (!sheetExport) chip.setAttribute('aria-selected', String(on))
        if (on && !was) XW.replay(chip, 'is-on')
        else if (!on) chip.classList.remove('is-on')
      }
      addrChips.classList.remove('xw-hide')
    }

    function onChip (key) {
      if (!sheetExport) {
        sheetPortfolioByWallet.set(sheetWallet.id, key)
        renderAddresses()
        addrList.scrollTop = 0
        return
      }
      const all = exportGroups().map(([k]) => k)
      const allSelected = all.length > 0 && all.every((k) => sheetSelected.has(k))
      if (key === null) sheetSelected = new Set(all) // „Alle“ gewählt
      else if (allSelected) sheetSelected = new Set([key]) // aus „Alle“ heraus: nur dieses
      else {
        if (sheetSelected.has(key)) sheetSelected.delete(key)
        else sheetSelected.add(key)
        if (!sheetSelected.size) sheetSelected = new Set(all) // nichts mehr aktiv → wieder „Alle“
      }
      renderAddresses()
    }

    // Adressen, die aktuell exportiert würden: gewählte Portfolios + Suchfilter, doppelte Adressen raus.
    // (ETH und alle ERC-20-Token teilen sich eine Adresse – die soll nur einmal in der Liste stehen.)
    function exportMatches () {
      const q = addrFilter.value.trim().toLowerCase()
      const seen = new Set()
      const out = []
      for (const a of sheetAddresses) {
        if (!sheetSelected.has(groupKey(a))) continue
        if (q && !a.label.toLowerCase().includes(q) && !a.ticker.toLowerCase().includes(q) && !a.asset.toLowerCase().includes(q)) continue
        if (seen.has(a.address)) continue
        seen.add(a.address)
        out.push(a)
      }
      return out
    }

    // Kopieren → Lichtschweif, grüner Rand, Label wechselt; nach 1800 ms zurück. Ein erneuter Klick
    // während „Copied“ verlängert nur den Timer (XW.confirm), die Animation startet nicht neu.
    async function doExport () {
      const list = exportMatches()
      if (!list.length) return showNotice(T.exportNone, 'error')
      try {
        await call('copyText', list.map((a) => a.address).join('\n'))
        if (!exportBtn.classList.contains('is-copied')) exportLabelB.textContent = T.exportBtnDone(list.length)
        XW.confirm(exportBtn, 1800)
        showNotice(T.exportCopied(list.length), 'ok')
      } catch (e) {
        fail(e)
      }
    }

    function renderAddresses () {
      if (!sheetWallet && !sheetCross) return
      if (!sheetAddresses.length) {
        addrChips.classList.add('xw-hide')
        exportBar.classList.add('xw-hide')
        addrList.replaceChildren(el('div', { class: 'xw-empty', text: T.addrEmpty }))
        return
      }

      // Export-Modus: nach Auswahl filtern (Portfolios bzw. Wallets), Kopieren-Knopf mit Anzahl
      if (sheetExport) {
        const groups = exportGroups()
        renderChips(groups, null)
        const list = exportMatches()
        setExportLabels(list.length)
        exportBtn.disabled = !list.length
        exportBar.classList.remove('xw-hide')
        if (!list.length) {
          addrList.replaceChildren(el('div', { class: 'xw-empty', text: T.exportNone }))
          return
        }
        const order = new Map(groups.map(([key], i) => [key, i]))
        // Übergreifend: nach Wallet, dann Portfolio; sonst nach Portfolio
        const rows = list.slice().sort((x, y) =>
          (order.get(groupKey(x)) - order.get(groupKey(y))) ||
          x.account.localeCompare(y.account, 'en', { numeric: true }))
        // Wallets mit mehreren Portfolios: Portfolio pro Zeile zeigen
        const multiPortfolioWallets = new Set()
        if (sheetCross) {
          const byWallet = new Map()
          for (const a of sheetAddresses) {
            if (!byWallet.has(a.walletId)) byWallet.set(a.walletId, new Set())
            byWallet.get(a.walletId).add(a.account)
          }
          for (const [id, accs] of byWallet) if (accs.size > 1) multiPortfolioWallets.add(id)
        }
        const nodes = []
        let lastKey = null
        for (const a of rows) {
          const k = groupKey(a)
          if (k !== lastKey) {
            nodes.push(el('div', { class: 'xw-addr-group xw-label', text: sheetCross ? a.wallet : (a.portfolio || a.account) }))
            lastKey = k
          }
          nodes.push(addressRow(a, sheetCross && multiPortfolioWallets.has(a.walletId)))
        }
        addrList.replaceChildren(...nodes)
        nodes.forEach((n, i) => n.style.setProperty('--xw-i', i))
        return
      }
      exportBar.classList.add('xw-hide')
      const portfolios = sheetPortfolios()

      let selected = sheetPortfolioByWallet.get(sheetWallet.id) || null
      if (selected && !portfolios.some(([account]) => account === selected)) selected = null
      renderChips(portfolios, selected)

      const q = addrFilter.value.trim().toLowerCase()
      const hits = sheetAddresses.filter((a) =>
        (!selected || a.account === selected) &&
        (!q || a.label.toLowerCase().includes(q) || a.ticker.toLowerCase().includes(q) || a.asset.toLowerCase().includes(q)))
      if (!hits.length) {
        const unsaved = selected && selected.startsWith('name:')
        addrList.replaceChildren(el('div', { class: 'xw-empty', text: unsaved ? T.addrPortfolioEmpty : T.addrNoMatch }))
        return
      }
      // Bei "Alle" nach Portfolio gruppieren (mit Überschrift); bei einem gewählten Portfolio flache Liste
      const grouped = !selected && portfolios.length > 1
      const order = new Map(portfolios.map(([account], i) => [account, i]))
      if (grouped) hits.sort((x, y) => order.get(x.account) - order.get(y.account))
      const nodes = []
      let lastAccount = null
      for (const a of hits) {
        if (grouped && a.account !== lastAccount) {
          nodes.push(el('div', { class: 'xw-addr-group xw-label', text: a.portfolio || a.account }))
          lastAccount = a.account
        }
        nodes.push(addressRow(a))
      }
      addrList.replaceChildren(...nodes)
      nodes.forEach((n, i) => n.style.setProperty('--xw-i', i))
    }

    // showPortfolio: Portfolio-Namen zusätzlich pro Zeile zeigen (z. B. im wallet-übergreifenden Export)
    function addressRow (a, showPortfolio) {
      const multiPortfolio = showPortfolio !== undefined ? showPortfolio : sheetPortfolios().length > 1
      // Kopier-Bestätigung der Zeile (@xw:row): Adresse ↑ raus, „Address copied“ ↑ rein, Icon morpht
      // zum Häkchen; hält 1400 ms. Beide Texte liegen im selben Grid-Feld (.xw-addr-sub) – kein Springen.
      const row = el('div', { class: 'xw-addr xw-addr--cp', role: 'button', tabindex: '0', title: a.address },
        coinIcon(a),
        el('div', { class: 'xw-addr-body' },
          el('div', { class: 'xw-addr-name' },
            el('span', { text: a.label }),
            el('span', { class: 'xw-addr-ticker', text: a.ticker }),
            showPortfolio ? el('span', { class: 'xw-addr-port', text: a.portfolio || a.account }) : null),
          el('div', { class: 'xw-addr-sub' },
            el('span', { class: 'xw-addr-text', text: a.address }),
            el('span', { class: 'xw-addr-ok', text: T.addrOk }))),
        el('span', { class: 'xw-addr-copy', html: MORPH(16) }))
      const copy = async () => {
        try {
          const wid = a.walletId || (sheetWallet && sheetWallet.id)
          const res = await call('copyAddress', wid, a.asset, a.account)
          XW.confirm(row, 1400)
          showNotice(multiPortfolio ? T.addrCopiedFrom(res.ticker, a.portfolio || a.account) : T.addrCopied(res.ticker), 'ok')
        } catch (e) {
          fail(e)
        }
      }
      row.addEventListener('click', copy)
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') copy() })
      return row
    }

    // -----------------------------------------------------------------------------------------
    // Formular
    // -----------------------------------------------------------------------------------------

    // buttons: [{ text, run: async (value) => {} }] – der erste ist der Hauptknopf (auch für Enter)
    // Weitere Knopf-Optionen: danger (rot), free (nicht an confirmValue gebunden), keepOpen (Formular bleibt).
    // confirmValue: Knöpfe erst aktiv, wenn genau dieser Text eingetippt ist (z. B. Wallet-Name beim Löschen).
    let formConfirm = null
    let gatedNodes = []
    function updateGate () {
      const ok = formConfirm == null || input.value.trim() === formConfirm
      if (ok) input.classList.remove('is-error')
      for (const n of gatedNodes) {
        if (n.classList.contains('is-danger')) {
          // Löschen-Knopf: aria-disabled statt disabled – sonst bekäme er keine Klicks für das Schütteln.
          // Beim Übergang zu „Name stimmt“ federt er einmal (@xw:delete .is-armed).
          const armed = ok && !formBusy
          const wasArmed = n.getAttribute('aria-disabled') === 'false'
          n.setAttribute('aria-disabled', String(!armed))
          if (armed && !wasArmed) XW.once(n, 'is-armed')
        } else {
          n.disabled = !ok || formBusy
        }
      }
    }
    input.addEventListener('input', updateGate)

    function showForm ({ title, hint, value, placeholder, confirmValue, buttons }) {
      closeSheet()
      formTitle.textContent = title
      formHint.textContent = hint || ''
      formError.textContent = ''
      input.value = value || ''
      input.placeholder = placeholder || ''
      input.classList.remove('is-error')
      formConfirm = confirmValue == null ? null : confirmValue
      formActions = buttons
      const cancel = el('button', { type: 'button', class: 'xw-btn', onclick: hideForm, text: T.cancel })
      gatedNodes = []
      const nodes = buttons.map((b, i) => {
        const node = el('button', {
          type: i === 0 ? 'submit' : 'button',
          class: 'xw-btn' + (b.danger ? ' is-danger' : i === 0 ? ' is-primary' : ''),
          text: b.text,
          onclick: i === 0 ? null : (e) => { e.preventDefault(); runForm(b) },
        })
        if (!b.free) gatedNodes.push(node)
        return node
      })
      formButtons.className = buttons.length > 1 ? 'xw-form-buttons' : 'xw-row'
      formButtons.replaceChildren(...nodes, cancel)
      updateGate()
      actions.classList.add('xw-hide')
      form.classList.remove('xw-hide')
      setTimeout(() => { input.focus(); input.select() }, 40)
    }

    function hideForm () {
      formActions = []
      formConfirm = null
      gatedNodes = []
      form.classList.add('xw-hide')
      actions.classList.remove('xw-hide')
    }

    const gateOpen = () => formConfirm == null || input.value.trim() === formConfirm

    async function runForm (button) {
      if (formBusy) return
      if (!button.free && !gateOpen()) {
        // Falscher oder fehlender Name beim Löschen: Feld schüttelt kurz, roter Rand, Fokus zurück.
        // (main.js prüft den Namen beim Löschen ohnehin noch einmal.)
        if (button.danger) {
          input.classList.add('is-error')
          XW.once(input, 'xw-shake')
          input.focus()
        }
        return
      }
      formBusy = true
      const nodes = [...formButtons.querySelectorAll('button')]
      for (const n of nodes) n.disabled = true
      formError.textContent = ''
      try {
        await button.run(input.value.trim())
        if (!button.keepOpen) {
          hideForm()
          refresh()
        }
      } catch (err) {
        formError.textContent = err.message
      } finally {
        formBusy = false
        for (const n of nodes) n.disabled = false
        updateGate()
      }
    }

    function onSubmit (e) {
      e.preventDefault()
      if (formActions.length) runForm(formActions[0])
    }

    function startDelete (w) {
      const cache = w.cache && typeof w.cache.total === 'number' ? w.cache : null
      const balance = cache && !(state && state.settings.hideBalances) ? money(cache.total, cache.currency) : null
      showForm({
        title: T.deleteTitle(T.q(w.name)),
        hint: T.deleteHint(balance, w.running),
        value: '',
        placeholder: w.name,
        confirmValue: w.name,
        buttons: [
          {
            text: w.running ? T.deleteCloseOk : T.deleteOk,
            danger: true,
            run: async (typed) => {
              if (w.running) showNotice(T.closing(T.q(w.name)))
              const res = await call('remove', w.id, typed, { close: w.running })
              showNotice(T.deleteDone(T.q(res.name)), 'ok')
            },
          },
          ...(w.hasWallet ? [{ text: T.deleteBackupFirst, free: true, keepOpen: true, run: () => showBackup(w) }] : []),
        ],
      })
    }

    function startCreate () {
      showForm({
        title: T.createTitle,
        hint: T.createHint,
        value: state ? state.nextName : '',
        buttons: [{
          text: T.createOk,
          run: async (name) => {
            const res = await call('create', name, { restore: false })
            showNotice(T.createDone(T.q(res.name)), 'ok')
          },
        }],
      })
    }

    function startRestore () {
      showForm({
        title: T.restoreTitle,
        hint: T.restoreHint,
        value: state ? state.nextName : '',
        buttons: [{
          text: T.restoreOk,
          run: async (name) => {
            const res = await call('create', name, { restore: true })
            showNotice(T.restoreDone(T.q(res.name)), 'ok')
          },
        }],
      })
    }

    function startRename (w) {
      const rename = (options) => async (name) => {
        if (w.isCurrent) showNotice(T.renameClosing)
        else if (options.close) showNotice(T.closing(T.q(labelOf(w))))
        const res = await call('rename', w.id, name, options)
        showNotice(T.renameDone(T.q(res.name)), 'ok')
      }
      // Standard-Wallet: nur Anzeigename, kein Schließen nötig
      if (w.isStandard) {
        return showForm({
          title: T.renameTitle(T.q(labelOf(w))),
          hint: T.renameStandardHint,
          value: state.settings.standardName || '',
          buttons: [{ text: T.renameOk, run: rename({}) }],
        })
      }
      if (w.isCurrent || w.running) {
        return showForm({
          title: T.renameTitle(T.q(w.name)),
          hint: w.isCurrent ? T.renameCurrentHint : T.renameRunningHint,
          value: w.name,
          buttons: [
            { text: T.renameClose, run: rename({ close: true }) },
            { text: T.renameCloseReopen, run: rename({ close: true, reopen: true }) },
          ],
        })
      }
      showForm({
        title: T.renameTitle(T.q(w.name)),
        value: w.name,
        buttons: [{ text: T.renameOk, run: rename({}) }],
      })
    }

    function startImport (f) {
      showForm({
        title: T.importTitle(T.q(f.name)),
        hint: T.importHint,
        value: state ? state.nextName : '',
        buttons: [{
          text: T.importOk,
          run: async (name) => {
            const res = await call('importOld', f.path, name)
            showNotice(T.importDone(T.q(res.name)), 'ok')
          },
        }],
      })
    }

    // Beim Zurückwechseln ins Fenster sofort die Stände der anderen Wallets nachladen
    window.addEventListener('focus', () => { if (open) refresh() })

    // Anzahl der Wallets am Knopf anzeigen und die Sprache früh übernehmen
    setTimeout(() => { if (!state) refresh() }, 8000)
  }

  if (isExodusUi()) {
    debug('isExodusUi=true, starte UI...')
    if (document.readyState === 'loading') {
      debug('warte auf DOMContentLoaded...')
      document.addEventListener('DOMContentLoaded', () => {
        debug('DOMContentLoaded')
        start()
      }, { once: true })
    } else {
      debug('DOM bereits geladen')
      start()
    }
  } else {
    debug('isExodusUi=false, UI wird NICHT gestartet')
  }
}
