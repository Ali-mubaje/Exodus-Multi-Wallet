'use strict'
/*
 * Exodus wallet sidebar – UI
 * ----------------------------------------
 * Runs as an additional preload script in the Exodus UI, in its own isolated
 * JavaScript world (no access to Exodus internals, no Node). Places a button top left in front
 * of the Exodus logo that opens the wallet sidebar. All actions go through main.js.
 */
{
  const { ipcRenderer } = require('electron')

  // Send debug output to main.js via IPC
  const debug = (msg) => {
    try { ipcRenderer.send('exodus-wallets:debug', msg) } catch (e) {}
  }

  debug(`preload.js loaded, URL: ${location.href}`)
  debug(`protocol: ${location.protocol}, pathname: ${decodeURIComponent(location.pathname)}`)

  const isExodusUi = () => {
    try {
      const result = window.top === window && location.protocol === 'file:' &&
        /\/src\/static\/exodus-prod\.html$/i.test(decodeURIComponent(location.pathname))
      debug(`isExodusUi() = ${result}`)
      return result
    } catch (e) {
      debug(`isExodusUi() error: ${e.message}`)
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
    layers: svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  }

  // Icon of the "Ready" card in place of the coin icon: green circle with checkmark (data: URL, CSP-compliant)
  const READY_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#3ad29f" fill-opacity=".16" stroke="#3ad29f" stroke-width="1.5"/><path d="m13 20.5 5 5 9-10" fill="none" stroke="#3ad29f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>')

  // Copy icon that turns into a checkmark when copying (handoff @xw:morph): front and
  // back of ICON.copy plus a checkmark drawn via stroke-dashoffset
  const MORPH = (size = 16) =>
    `<svg class="xw-morph" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    '<rect class="xw-m-front" x="8" y="8" width="13" height="13" rx="2"/><path class="xw-m-back" d="M4 16V5a1 1 0 0 1 1-1h11"/>' +
    '<path class="xw-m-check" d="m5 12 5 5 9-10" pathLength="1"/></svg>'

  // Colors come from Exodus' own theme variables (exodus.css, :root/.exodus-theme-*), so the
  // sidebar follows every Exodus theme. The fallbacks are the values of the default theme "origin".
  // Accent and gradient match .ex-button--default-color and the active nav stroke (#00bfff).
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

/* The row may extend under the ⋯ button (button 30px + gap) – there is room there */
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

/* Reduced motion (system setting). Panel, sheet, menu etc. are handled by the new .xw-reduce variants
   below (class via syncReduce); only the remaining press/hover transforms stay here. */
@media (prefers-reduced-motion:reduce){
  #xw-root .xw-icon:active,#xw-root .xw-more:active,#xw-toggle:active,
  #xw-root .xw-item:hover .xw-avatar,#xw-root .xw-fast{transform:none!important}
}

/* Exodus Multi Wallet – Motion (production). Variant 1A chosen. Taken from design_handoff_sidebar_motion/
   xw-motion.prod.css; order kept, panel selectors rewritten for preload.js. */

/* ===== @xw:tokens ===== */
/* Motion tokens – add once to #xw-root */
#xw-root{
  --xw-ease-out:cubic-bezier(.22,1,.36,1);     /* Default: fast in, soft out (= --xw-ease) */
  --xw-ease-in:cubic-bezier(.4,0,1,1);         /* Fade out / close */
  --xw-ease-io:cubic-bezier(.65,0,.35,1);      /* Paths with start and end (sweep, trail) */
  --xw-ease-back:cubic-bezier(.34,1.56,.64,1); /* Small overshoot (checkmark, dot) */
  --xw-d-fast:150ms;--xw-d-mid:220ms;--xw-d-slow:320ms;
  --xw-hold:1800ms;                            /* Copied state from click */
}
/* Shared button mechanics: pressed springs back */
#xw-root .xw-btn{transition:color .2s,background .2s,border-color .2s,transform 240ms var(--xw-ease-back)}
#xw-root .xw-btn:is(:active,.is-pressed){transform:scale(.98);transition-duration:.2s,.2s,.2s,90ms;transition-timing-function:ease,ease,ease,var(--xw-ease-out)}
#xw-root .xw-cp{isolation:isolate}
#xw-root .xw-cp-stack{display:grid;align-items:center;justify-items:center}
#xw-root .xw-cp-a,#xw-root .xw-cp-b{grid-area:1/1;display:inline-flex;align-items:center;gap:10px;white-space:nowrap}
#xw-root .xw-cp .xw-cp-b svg{color:var(--xw-green)}
/* Ring layer (1.5px, limited to the border via mask) */
#xw-root .xw-cp-fx{position:absolute;inset:-1px;border-radius:inherit;padding:1.5px;pointer-events:none;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
#xw-root .xw-cp-ring{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(-90deg,rgba(58,210,159,.95),rgba(58,210,159,.6));opacity:0;transition:opacity 300ms var(--xw-ease-out)}
#xw-root .xw-cp.is-copied .xw-cp-ring{opacity:1}

/* ===== @xw:trail ===== */
/* Variant A – light trail (chosen) */
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
/* Icon→checkmark morph (used here for the address row) */
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
/* Address row: tint, address → "Address copied", icon morph */
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
/* ⋯ menu: .is-open toggles it. Items get style="--xw-i:0..n" */
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
/* View from the right: .xw-view (main list) + .xw-sheet; class .is-sheet on the panel */
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
/* Staggered fade-in. Rows get style="--xw-i:n"; re-apply class .xw-anim on the container */
#xw-root .xw-anim>.xw-item,#xw-root .xw-anim>.xw-stag{animation:xw-in 280ms var(--xw-ease-out) both;animation-delay:calc(min(var(--xw-i,0),10) * 30ms + 90ms)}
@keyframes xw-in{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
@keyframes xw-fade{from{opacity:0}to{opacity:1}}
#xw-root.xw-reduce .xw-anim>.xw-item,#xw-root.xw-reduce .xw-anim>.xw-stag{animation-name:xw-fade;animation-delay:0ms}

/* ===== @xw:toast ===== */
/* Notice toast: absolute in the panel, .is-show toggles it; .is-ok / .is-error like the former .xw-notice */
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
/* Chip on/off (multi-select) – gradient border as a pseudo layer so it can cross-fade */
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
/* Opening the panel. Mapping prototype → preload.js: .xw-open → #xw-root.xw-open, .xw-slide → #xw-panel,
   .xw-backdrop → #xw-backdrop, .xw-toggle → #xw-toggle. The !important shielding of preload.js stays. */
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
/* Balance update: old value rolls out, new one rolls in; brief up/down tint. Container .xw-roll */
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
/* Wallet switch: marker bar, status dot pops in with a pulse */
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
/* Confirm delete: type the name → button "armed"; wrong input → short shake + red border */
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

/* ----- Additions for preload.js (not part of the handoff) ----- */
/* Toast icon changes with the kind (ok/error/neutral) */
#xw-root .xw-toast-ico{display:flex;flex:none}
/* Form fade-in without offset under reduced motion */
#xw-root.xw-reduce form:not(.xw-hide){animation-name:xw-fade}

/* ===== @xw:notify ===== */
/* "Money received" – notification, stack, nav dot, aftereffect in the sidebar.
   Uses the motion tokens from @xw:tokens (--xw-ease-out/-in/-io/-back). Self-contained: no keyframes from other sections needed.
   Stack: <div class="xw-nt-stack is-deck"> (or is-list) directly in #xw-root. Cards are created by XW.nt.notify(). */

#xw-root .xw-nt-stack{position:fixed;top:92px;left:24px;width:320px;z-index:2147483645;pointer-events:none}
/* Slot = position in the stack (transform only), card = fade in/out */
#xw-root .xw-nt{position:absolute;top:0;left:0;right:0;padding-bottom:8px;pointer-events:auto;transform-origin:50% 100%;transform:translateY(var(--xw-yl,0px));transition:transform 320ms var(--xw-ease-out),opacity 200ms var(--xw-ease-out)}
#xw-root .xw-nt-stack.is-deck:not(.is-paused) .xw-nt{transform:translateY(var(--xw-yd,0px)) scale(var(--xw-sd,1));transition-duration:260ms,200ms}
#xw-root .xw-nt.is-hidden{opacity:0;pointer-events:none}
#xw-root .xw-nt.is-gone{pointer-events:none}

#xw-root .xw-nt-card{position:relative;overflow:hidden;padding:12px 12px 10px 16px;border-radius:8px;background:var(--xw-surface);border:1px solid rgba(255,255,255,.08);box-shadow:0 12px 32px rgba(0,0,0,.5);cursor:pointer;outline:0;transition:background 200ms var(--xw-ease-out),filter 200ms var(--xw-ease-out)}
#xw-root .xw-nt-card:is(:hover,.is-hover){background:var(--xw-hover)}
#xw-root .xw-nt-card:focus-visible{box-shadow:0 12px 32px rgba(0,0,0,.5),0 0 0 1px var(--xw-cyan)}
#xw-root .xw-nt-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--xw-green)}
#xw-root .xw-nt-card:after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:rgba(255,255,255,.18);transform-origin:left;animation:xw-nt-life var(--xw-nt-life,6000ms) linear both}
#xw-root .xw-nt-stack.is-paused .xw-nt-card:after,#xw-root .xw-nt.is-static .xw-nt-card:after{animation-play-state:paused}
#xw-root .xw-nt.is-static .xw-nt-card:after{animation-delay:calc(var(--xw-nt-life,6000ms) * -.42)}
#xw-root .xw-nt-main{display:flex;align-items:center;gap:12px}
#xw-root .xw-nt-coin{flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-family:var(--xw-font-cond);font-size:10px;font-weight:700;letter-spacing:.04em;color:#fff}
#xw-root .xw-nt-coin img{display:block;width:40px;height:40px;object-fit:contain}
#xw-root .xw-nt-coin:not(:has(img)){clip-path:polygon(50% 0,93.3% 25%,93.3% 75%,50% 100%,6.7% 75%,6.7% 25%)}
#xw-root .xw-nt-body{flex:1;min-width:0}
#xw-root .xw-nt-amt{display:grid;overflow:hidden}
#xw-root .xw-nt-amt>span{grid-area:1/1;font-size:20px;font-weight:300;line-height:1.25;letter-spacing:-.005em;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#xw-root .xw-nt.is-private .xw-nt-amt>span{font-size:16px;font-weight:400}
#xw-root .xw-nt-sub{margin-top:1px;font-size:12px;color:var(--xw-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
#xw-root .xw-nt-x{flex:none;align-self:flex-start;width:28px;height:28px;margin:-4px -4px 0 0;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;opacity:.35;cursor:pointer;transition:opacity .1s,background .2s,transform 240ms var(--xw-ease-back)}
#xw-root .xw-nt-card:is(:hover,.is-hover) .xw-nt-x{opacity:.6}
#xw-root .xw-nt-x:hover{opacity:1!important;background:rgba(255,255,255,.07)}
#xw-root .xw-nt-x:active{transform:scale(.9);transition-duration:.1s,.2s,90ms}
#xw-root .xw-nt-foot{display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:9px;border-top:1px solid var(--xw-line);font-size:11.5px;color:var(--xw-muted);white-space:nowrap}
#xw-root .xw-nt-av{flex:none;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--xw-deep) center/cover no-repeat;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);font-family:var(--xw-font-cond);font-size:9px;font-weight:700;color:#fff}
#xw-root .xw-nt-wallet{min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:500;color:rgba(255,255,255,.82)}
#xw-root .xw-nt-port{min-width:0;overflow:hidden;text-overflow:ellipsis}
#xw-root .xw-nt-time{flex:none;margin-left:auto}
#xw-root .xw-nt-glint{position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 30%,rgba(58,210,159,.14) 45%,rgba(255,255,255,.09) 50%,rgba(58,210,159,.14) 55%,transparent 70%);transform:translateX(-100%);opacity:0}

/* Deck: older cards show only their edge; hover (= .is-paused) fans them out into a list */
#xw-root .xw-nt-main,#xw-root .xw-nt-foot{transition:opacity 150ms var(--xw-ease-out)}
#xw-root .xw-nt-stack.is-deck:not(.is-paused) .xw-nt.is-back .xw-nt-main,#xw-root .xw-nt-stack.is-deck:not(.is-paused) .xw-nt.is-back .xw-nt-foot{opacity:0}
#xw-root .xw-nt-stack.is-deck:not(.is-paused) .xw-nt.is-back .xw-nt-card{filter:brightness(.8)}

/* "+N more" */
#xw-root .xw-nt-more{position:absolute;top:0;left:0;display:flex;align-items:center;height:24px;padding:0 10px;border-radius:12px;font-size:11.5px;font-weight:500;color:rgba(255,255,255,.82);background:var(--xw-surface);border:1px solid rgba(255,255,255,.08);box-shadow:0 8px 20px rgba(0,0,0,.4);pointer-events:auto;opacity:0;transform:translateY(calc(var(--xw-yl,0px) - 4px));transition:opacity 150ms var(--xw-ease-in),transform 320ms var(--xw-ease-out)}
#xw-root .xw-nt-more.is-show{opacity:1;transform:translateY(var(--xw-yl,0px));transition:opacity 200ms var(--xw-ease-out),transform 320ms var(--xw-ease-out)}
#xw-root .xw-nt-stack.is-deck:not(.is-paused) .xw-nt-more.is-show{transform:translateY(var(--xw-yd,0px));transition-duration:200ms,260ms}

/* Incoming – accent in sync with the sound (t = 0: card inserted + receive.wav started) */
#xw-root .xw-nt.is-new .xw-nt-card{animation:xw-nt-in 280ms var(--xw-ease-out) both}
#xw-root .xw-nt.is-new .xw-nt-card:before{animation:xw-nt-bar 260ms var(--xw-ease-out) 60ms both}
#xw-root .xw-nt.is-new .xw-nt-coin{animation:xw-nt-pop 420ms var(--xw-ease-back) 40ms both}
#xw-root .xw-nt.is-new .xw-nt-amt>span{animation:xw-nt-amt 320ms var(--xw-ease-out) 100ms both,xw-nt-tint 1200ms var(--xw-ease-out) 100ms both}
#xw-root .xw-nt.is-new .xw-nt-glint{animation:xw-nt-glint 800ms var(--xw-ease-io) 120ms both}
/* Exit: ✕ to the left, click (open) shrinks, auto dismiss upwards */
#xw-root .xw-nt.is-out-x .xw-nt-card{animation:xw-nt-out-x 180ms var(--xw-ease-in) both}
#xw-root .xw-nt.is-out-open .xw-nt-card{animation:xw-nt-out-open 160ms var(--xw-ease-in) both}
#xw-root .xw-nt.is-out-auto .xw-nt-card{animation:xw-nt-out-auto 220ms var(--xw-ease-in) both}

@keyframes xw-nt-in{from{opacity:0;transform:translateY(-10px) scale(.98)}to{opacity:1;transform:none}}
@keyframes xw-nt-bar{from{transform:scaleY(0)}to{transform:none}}
@keyframes xw-nt-pop{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:none}}
@keyframes xw-nt-amt{from{opacity:0;transform:translateY(45%);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}
@keyframes xw-nt-tint{from{color:var(--xw-green)}to{color:var(--xw-text)}}
@keyframes xw-nt-glint{0%{opacity:0;transform:translateX(-100%)}15%{opacity:1}85%{opacity:1}100%{opacity:0;transform:translateX(100%)}}
@keyframes xw-nt-life{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@keyframes xw-nt-out-x{to{opacity:0;transform:translateX(-12px)}}
@keyframes xw-nt-out-open{to{opacity:0;transform:scale(.97)}}
@keyframes xw-nt-out-auto{to{opacity:0;transform:translateY(-6px)}}
@keyframes xw-nt-fade{from{opacity:0}}
@keyframes xw-nt-fade-out{to{opacity:0}}

/* Nav dot on the wallet button (#xw-toggle): bottom right, so the existing .xw-count (wallet count, top right) stays clear */
#xw-root .xw-nt-badge{position:absolute;right:1px;bottom:3px;width:10px;height:10px;border-radius:5px;background:var(--xw-green);box-shadow:0 0 0 2px #0c0e0f;font-family:var(--xw-font-cond);font-size:0;font-weight:700;line-height:14px;text-align:center;color:#06140e;pointer-events:none;opacity:0;transform:scale(.3);transition:opacity 150ms var(--xw-ease-in),transform 150ms var(--xw-ease-in)}
#xw-root .xw-nt-badge.is-on{opacity:1;transform:none;transition:opacity 200ms var(--xw-ease-out),transform 320ms var(--xw-ease-back)}
#xw-root .xw-nt-badge.is-count{width:auto;min-width:14px;height:14px;padding:0 3px;border-radius:7px;right:-2px;bottom:1px;font-size:9.5px}
#xw-root .xw-nt-badge:after{content:"";position:absolute;inset:0;border-radius:inherit;background:var(--xw-green);opacity:0}
#xw-root .xw-nt-badge.is-pulse:after{animation:xw-nt-ring 700ms var(--xw-ease-out) 120ms both}
#xw-root .xw-nt-badge.is-bump{animation:xw-nt-bump 240ms var(--xw-ease-back)}
@keyframes xw-nt-ring{from{opacity:.5;transform:scale(1)}to{opacity:0;transform:scale(2.6)}}
@keyframes xw-nt-bump{from{transform:scale(1.3)}to{transform:none}}

/* Aftereffect: wallet row glows green once while the balance rolls (@xw:roll, is-up) */
#xw-root .xw-item:after{content:"";position:absolute;inset:0;border-radius:inherit;background:rgba(58,210,159,.08);box-shadow:inset 0 0 0 1px rgba(58,210,159,.2);opacity:0;pointer-events:none}
#xw-root .xw-item.is-received:after{animation:xw-nt-wash 1300ms var(--xw-ease-out) var(--xw-rcv-delay,0ms)}
@keyframes xw-nt-wash{0%{opacity:0}18%{opacity:1}100%{opacity:0}}

/* Reduced motion: cross-fades only; green (bar, tint, dot, row) stays */
#xw-root.xw-reduce .xw-nt,#xw-root.xw-reduce .xw-nt-more{transition:opacity 200ms ease!important}
#xw-root.xw-reduce .xw-nt.is-new .xw-nt-card{animation:xw-nt-fade 200ms ease both}
#xw-root.xw-reduce .xw-nt.is-new .xw-nt-card:before,#xw-root.xw-reduce .xw-nt.is-new .xw-nt-coin,#xw-root.xw-reduce .xw-nt.is-new .xw-nt-glint{animation:none}
#xw-root.xw-reduce .xw-nt.is-new .xw-nt-amt>span{animation:xw-nt-tint 1200ms ease-out both}
#xw-root.xw-reduce .xw-nt[class*="is-out-"] .xw-nt-card{animation:xw-nt-fade-out 160ms ease both}
#xw-root.xw-reduce .xw-nt-card:after{display:none}
#xw-root.xw-reduce .xw-nt-badge,#xw-root.xw-reduce .xw-nt-badge.is-on{transform:none!important;transition:opacity 200ms ease}
#xw-root.xw-reduce .xw-nt-badge.is-pulse:after,#xw-root.xw-reduce .xw-nt-badge.is-bump{animation:none}

/* ----- Additions for @xw:notify (not part of the handoff) ----- */
/* Wallet without its own picture: Exodus logo in the 18 px circle as small as in the wallet row (20 of 36 px) */
#xw-root .xw-nt-av.is-exodus{background-size:10px 10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
/* Balance roll when opening the sidebar: starts together with the row glow (460 ms + 30 ms × row) */
#xw-root .xw-roll.is-delayed>.xw-roll-out{animation-delay:var(--xw-roll-d,0ms)!important}
#xw-root .xw-roll.is-delayed>.xw-roll-in{animation-delay:calc(var(--xw-roll-d,0ms) + 60ms)!important}
#xw-root.xw-reduce .xw-roll.is-delayed>.xw-roll-in{animation-delay:var(--xw-roll-d,0ms)!important}

/* ----- Background sync and setup of new wallets ----- */
/* "Ready" card: the hint may span two lines */
#xw-root .xw-nt.is-ready .xw-nt-sub{white-space:normal}
#xw-root .xw-badge.is-background{background:rgba(255,255,255,.07);color:rgba(255,255,255,.6)}
#xw-root .xw-badge.is-ready{background:rgba(58,210,159,.16);color:var(--xw-green)}
/* Status line: "Restoring – 12 coins left · keep it open" with a small spinner */
#xw-root .xw-status{display:flex;align-items:center;gap:7px;margin-top:5px;font-size:11.5px;line-height:1.35;color:rgba(255,255,255,.72)}
#xw-root .xw-status.is-warn{color:#ffc46b}
#xw-root .xw-spin{flex:none;width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(255,255,255,.18);border-top-color:var(--xw-cyan);animation:xw-spin 900ms linear infinite}
#xw-root .xw-status.is-warn .xw-spin{border-top-color:#ffc46b;animation:none;border-color:#ffc46b;opacity:.8}
@keyframes xw-spin{to{transform:rotate(360deg)}}
#xw-root.xw-reduce .xw-spin{animation:none;border-color:var(--xw-cyan)}
/* Switch "Sync all wallets in the background" */
#xw-root .xw-bg{display:flex;align-items:center;gap:12px;margin:4px 24px 0;padding:10px 0 2px;border-top:1px solid var(--xw-line);cursor:pointer}
#xw-root .xw-bg-text{flex:1;min-width:0}
#xw-root .xw-bg-title{font-size:12.5px;color:rgba(255,255,255,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#xw-root .xw-toggle{flex:none;position:relative;width:30px;height:18px;border-radius:9px;background:rgba(255,255,255,.14);transition:background 200ms var(--xw-ease-out)}
#xw-root .xw-toggle:after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform 240ms var(--xw-ease-back)}
#xw-root .xw-toggle[aria-checked="true"]{background:var(--xw-green)}
#xw-root .xw-toggle[aria-checked="true"]:after{transform:translateX(12px)}
#xw-root .xw-toggle:focus-visible{outline:1px solid var(--xw-cyan);outline-offset:2px}
`

  // -------------------------------------------------------------------------------------------
  // Texts. The language follows Exodus' setting (selectors.locale.language, provided by main.js);
  // Exodus desktop is currently English only. Unknown languages fall back to English; numbers
  // and dates are still shown in the format of the Exodus language (Intl handles any language).
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
      foot: 'Balances: last value saved by each wallet – kept up to date while it runs (also in the background). Click a wallet to open it in a new window.',
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
      ntMore: (n) => `+${n} more`,
      ntReceived: (ticker) => `Received ${ticker}`,
      ntDismiss: 'Dismiss',
      ntOpen: 'Open wallet',
      badgeBackground: 'Background',
      stStarting: 'Starting …',
      stOnboarding: 'Waiting – finish the setup in its Exodus window',
      stLocked: 'Locked – open it and enter the password',
      stLoading: 'Loading …',
      stRestoring: (n) => n > 0 ? `Restoring – ${n} coin${n === 1 ? '' : 's'} left · keep it open` : 'Restoring · keep it open',
      stSyncing: 'Loading balances · keep it open',
      stAddresses: 'Saving addresses · keep it open',
      stAlmost: 'Almost ready · keep it open',
      stSetupPending: 'Setup not finished – open it and keep it open until it’s ready',
      badgeReady: 'Ready',
      readyTitle: 'Ready',
      readySub: 'Everything loaded – you can close it',
      mBackground: 'Move to background',
      mShow: 'Show window',
      bgSync: 'Sync all wallets in the background',
      bgSyncHint: 'While Exodus is open, your other wallets keep running invisibly – so balances stay current and you get notified about incoming payments.',
      bgMoved: (n) => `${n} keeps running in the background.`,
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
      foot: 'Kontostände: zuletzt von der Wallet gespeichert – bleiben aktuell, solange sie läuft (auch im Hintergrund). Klick auf eine Wallet öffnet sie in einem neuen Fenster.',
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
      ntMore: (n) => `+${n} weitere`,
      ntReceived: (ticker) => `${ticker} erhalten`,
      ntDismiss: 'Schließen',
      ntOpen: 'Wallet öffnen',
      badgeBackground: 'Hintergrund',
      stStarting: 'Startet …',
      stOnboarding: 'Wartet – Einrichtung im Exodus-Fenster abschließen',
      stLocked: 'Gesperrt – öffnen und Passwort eingeben',
      stLoading: 'Lädt …',
      stRestoring: (n) => n > 0 ? `Wird wiederhergestellt – noch ${n} Coin${n === 1 ? '' : 's'} · offen lassen` : 'Wird wiederhergestellt · offen lassen',
      stSyncing: 'Kontostände werden geladen · offen lassen',
      stAddresses: 'Adressen werden gespeichert · offen lassen',
      stAlmost: 'Gleich fertig · offen lassen',
      stSetupPending: 'Einrichtung nicht fertig – öffnen und offen lassen, bis sie bereit ist',
      badgeReady: 'Bereit',
      readyTitle: 'Bereit',
      readySub: 'Alles geladen – du kannst sie schließen',
      mBackground: 'In den Hintergrund',
      mShow: 'Fenster anzeigen',
      bgSync: 'Alle Wallets im Hintergrund synchronisieren',
      bgSyncHint: 'Solange Exodus offen ist, laufen deine anderen Wallets unsichtbar mit – Kontostände bleiben aktuell und Eingänge werden gemeldet.',
      bgMoved: (n) => `${n} läuft im Hintergrund weiter.`,
    },
  }

  // Exodus' default is English – it applies until main.js delivers the real setting
  let language = 'en'
  let T = TEXTS.en
  function setLanguage (lang) {
    const raw = String(lang || 'en')
    const base = raw.toLowerCase().split(/[-_]/)[0]
    language = raw.replace('_', '-')
    T = TEXTS[base] || TEXTS.en
  }
  // Intl locale: "en" alone gives US format ($1,234.56); catch errors for exotic codes
  const intlLocale = () => {
    try { return Intl.NumberFormat.supportedLocalesOf([language]).length ? language : 'en' } catch (e) { return 'en' }
  }

  function el (tag, props, ...children) {
    const node = document.createElement(tag)
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue
      if (k === 'class') node.className = v
      else if (k === 'text') node.textContent = v
      else if (k === 'html') node.innerHTML = v // only for the fixed SVG icons above
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
      else node.setAttribute(k, v === true ? '' : String(v))
    }
    for (const c of children.flat()) {
      if (c != null && c !== false) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
    }
    return node
  }

  // Motion helpers from design_handoff_sidebar_motion/xw-motion.js – only set/remove classes.
  // In this script's scope instead of window.XW (isolated world, expose nothing).
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)')
  const XW = {
    // Mirror reduced motion onto #xw-root
    syncReduce (root) {
      const set = () => root.classList.toggle('xw-reduce', reduceQuery.matches)
      set(); reduceQuery.addEventListener('change', set)
    },
    // Copy confirmation (button + row): set .is-copied, remove after hold. Another click only extends it.
    confirm (el, hold = 1800) {
      clearTimeout(el._xwT)
      if (!el.classList.contains('is-copied')) el.classList.add('is-copied')
      el._xwT = setTimeout(() => el.classList.remove('is-copied'), hold)
    },
    // Restart a keyframe animation
    replay (el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls) },
    // One-shot class, removes itself after animationend
    once (el, cls) {
      XW.replay(el, cls)
      el.addEventListener('animationend', function h (e) { if (e.target === el) { el.classList.remove(cls); el.removeEventListener('animationend', h) } })
    },
    // kind: 'ok' | 'error' | '' (neutral, gradient bar). An empty kind sets no is-* class.
    toast (el, text, kind = 'ok', hold = 2400) {
      clearTimeout(el._xwT)
      el.querySelector('.xw-toast-text').textContent = text
      el.classList.remove('is-ok', 'is-error'); if (kind) el.classList.add('is-' + kind)
      el.style.setProperty('--xw-toast', hold + 'ms')
      XW.replay(el, 'is-show')
      el._xwT = setTimeout(() => el.classList.remove('is-show'), hold)
    },
    // Roll a balance: host = .xw-roll, dir = 'up' | 'down' | ''
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

  // "Money received" from design_handoff_notify/xw-notify.js – as XW.nt in the same scope. The texts
  // come from TEXTS (so they follow the Exodus language), the ✕ is ICON.close.
  XW.nt = (() => {
    const texts = () => ({ more: T.ntMore, received: T.ntReceived, now: T.justNow, dismiss: T.ntDismiss, open: T.ntOpen })
    const SKEL = '<div class="xw-nt-card" role="button" tabindex="0"><i class="xw-nt-glint" aria-hidden="true"></i>' +
      '<div class="xw-nt-main"><span class="xw-nt-coin"></span><div class="xw-nt-body"><div class="xw-nt-amt"><span></span></div><div class="xw-nt-sub"></div></div>' +
      '<button class="xw-nt-x" type="button">' + ICON.close(14) + '</button></div>' +
      '<div class="xw-nt-foot"><span class="xw-nt-av"></span><span class="xw-nt-wallet"></span><span class="xw-nt-port"></span><span class="xw-nt-time"></span></div></div>'
    const GAP = 8, MAX = 3, DECK_STEP = 8, DECK_SCALE = 0.04

    const NT = {
      life: 6000,
      /* d = { wallet:{name, img?, initial?, color?}, coin:{name, ticker, icon?, color?},
               amount:'+0.0012 BTC', value?:'≈ $78.40', portfolio?, time?, hidden?:bool }
         o = { life?, sound?: HTMLAudioElement, onOpen?(d), static?:bool } */
      notify (stack, d, o = {}) {
        const t = texts()
        const life = o.life || NT.life
        const s = document.createElement('div')
        s.className = 'xw-nt'
        s.setAttribute('role', 'status')
        s.innerHTML = SKEL
        const q = c => s.querySelector(c)
        const coin = q('.xw-nt-coin')
        if (d.coin.icon) { const img = new Image(); img.src = d.coin.icon; img.alt = ''; coin.appendChild(img) }
        else { coin.textContent = d.coin.ticker; if (d.coin.color) coin.style.background = d.coin.color }
        const priv = !!d.hidden
        s.classList.toggle('is-private', priv)
        q('.xw-nt-amt span').textContent = priv ? t.received(d.coin.ticker) : d.amount
        q('.xw-nt-sub').textContent = priv || !d.value ? d.coin.name : d.value + ' · ' + d.coin.name
        const av = q('.xw-nt-av')
        if (d.wallet.img) av.style.backgroundImage = 'url("' + d.wallet.img + '")'
        else { av.textContent = d.wallet.initial || d.wallet.name.slice(0, 1); if (d.wallet.color) av.style.backgroundColor = d.wallet.color }
        q('.xw-nt-wallet').textContent = d.wallet.name
        q('.xw-nt-port').textContent = d.portfolio ? '· ' + d.portfolio : ''
        q('.xw-nt-time').textContent = d.time || t.now
        q('.xw-nt-x').setAttribute('aria-label', t.dismiss)
        q('.xw-nt-card').setAttribute('aria-label', t.open + ': ' + d.wallet.name)
        s.style.setProperty('--xw-nt-life', life + 'ms')
        s._left = life

        if (o.static) s.classList.add('is-static')
        else {
          s.classList.add('is-new')
          q('.xw-nt-x').addEventListener('click', e => { e.stopPropagation(); NT.dismiss(s, 'x') })
          const open = () => { if (o.onOpen) o.onOpen(d); NT.dismiss(s, 'open') }
          q('.xw-nt-card').addEventListener('click', open)
          q('.xw-nt-card').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
        }
        if (!stack._xwBound && !o.static) {
          stack._xwBound = true
          stack.addEventListener('mouseenter', () => NT.pause(stack, true))
          stack.addEventListener('mouseleave', () => NT.pause(stack, false))
          stack.addEventListener('focusin', () => NT.pause(stack, true))
          stack.addEventListener('focusout', e => { if (!stack.contains(e.relatedTarget)) NT.pause(stack, false) })
        }
        stack._xwT = t
        if (o.sound) { try { o.sound.currentTime = 0; const p = o.sound.play(); if (p) p.catch(() => {}) } catch (e) {} }
        stack.insertBefore(s, stack.firstChild)
        if (!o.static) NT._arm(stack, s)
        NT.layout(stack)
        return s
      },
      _arm (stack, s) {
        if (stack.classList.contains('is-paused') || s._gone) return
        clearTimeout(s._timer)
        s._t0 = performance.now()
        s._timer = setTimeout(() => NT.dismiss(s, 'auto'), Math.max(0, s._left))
      },
      pause (stack, on) {
        stack.classList.toggle('is-paused', on)
        stack.querySelectorAll('.xw-nt:not(.is-gone):not(.is-static)').forEach(s => {
          if (on) { clearTimeout(s._timer); if (s._t0 != null) { s._left -= performance.now() - s._t0; s._t0 = null } }
          else NT._arm(stack, s)
        })
      },
      dismiss (s, how = 'auto') {
        if (s._gone) return
        s._gone = true
        clearTimeout(s._timer)
        const stack = s.parentElement
        s.classList.add('is-gone', 'is-out-' + how)
        const card = s.firstElementChild
        let done = false
        const rm = () => { if (!done) { done = true; s.remove() } }
        card.addEventListener('animationend', e => { if (e.target === card && e.animationName.indexOf('out') > -1) rm() })
        setTimeout(rm, 1200)
        if (stack) NT.layout(stack)
      },
      clear (stack) { stack.querySelectorAll('.xw-nt:not(.is-gone)').forEach(s => NT.dismiss(s, 'auto')) },
      layout (stack) {
        const slots = [...stack.querySelectorAll('.xw-nt:not(.is-gone)')]
        let y = 0, h0 = 0
        slots.forEach((s, i) => {
          const h = s.firstElementChild.offsetHeight
          if (i === 0) h0 = h
          const d = Math.min(i, MAX - 1)
          s.style.setProperty('--xw-yl', y + 'px')
          s.style.setProperty('--xw-yd', (h0 - h + d * DECK_STEP) + 'px')
          s.style.setProperty('--xw-sd', String(1 - d * DECK_SCALE))
          s.style.zIndex = String(100 - i)
          s.classList.toggle('is-back', i > 0)
          s.classList.toggle('is-hidden', i >= MAX)
          if (i < MAX) y += h + GAP
        })
        let more = stack.querySelector('.xw-nt-more')
        if (!more) { more = document.createElement('div'); more.className = 'xw-nt-more'; stack.appendChild(more) }
        const n = slots.length - MAX
        if (n > 0) more.textContent = (stack._xwT || texts()).more(n)
        more.style.setProperty('--xw-yl', y + 'px')
        more.style.setProperty('--xw-yd', (h0 + Math.min(slots.length - 1, MAX - 1) * DECK_STEP + GAP) + 'px')
        more.classList.toggle('is-show', n > 0)
      },
      /* Dot/counter on the wallet button: n = unseen incoming payments; 0 when the sidebar opens */
      badge (toggle, n) {
        let b = toggle.querySelector('.xw-nt-badge')
        if (!b) { b = document.createElement('span'); b.className = 'xw-nt-badge'; b.setAttribute('aria-hidden', 'true'); toggle.appendChild(b) }
        const was = +(b.dataset.n || 0)
        b.dataset.n = String(n)
        if (n > 1) b.textContent = n > 9 ? '9+' : String(n)
        b.classList.toggle('is-count', n > 1)
        if (n > 0 && was === 0) { b.classList.add('is-on'); XW.replay(b, 'is-pulse') }
        else if (n > was) XW.replay(b, 'is-bump')
        if (n === 0) b.classList.remove('is-on', 'is-pulse', 'is-bump')
      },
      /* Briefly make the wallet row glow green (delay: e.g. 460 ms while the sidebar is opening) */
      markWallet (item, delay = 0) {
        item.style.setProperty('--xw-rcv-delay', delay + 'ms')
        XW.replay(item, 'is-received')
        clearTimeout(item._xwRcv)
        item._xwRcv = setTimeout(() => item.classList.remove('is-received'), delay + 1400)
      },
    }
    return NT
  })()

  // Currency comes per wallet from its Exodus setting (USD, EUR, …), the number format from the language
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

  // label comes from main.js (custom name of the default wallet); fallback for older states
const labelOf = (w) => w.label || (w.isStandard ? T.standard : w.name)

  function start () {
    debug('start() called')
    if (document.getElementById('xw-root')) {
      debug('xw-root already exists, aborting')
      return
    }
    const style = el('style', { id: 'xw-style' })
    style.textContent = CSS
    ;(document.head || document.documentElement).appendChild(style)

    let state = null
    let open = false
    let refreshTimer = null
    // Previous values per wallet: for the balance roll (only on change) and is-live (only on status change)
    const prevValues = new Map()
    const prevStatus = new Map()

    // Fixed labels: [element, text key, attribute or null for the text]. applyTexts()
    // sets them again as soon as main.js reports a different Exodus language.
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
    // On open the total staggers in as the second element (header 0, total 1, wallet rows from 2)
    const sumBox = el('div', { class: 'xw-sum xw-stag xw-hide', style: '--xw-i:1' })
    const list = el('div', { class: 'xw-list', role: 'list' })
    // Notice toast (replaces the former .xw-notice in the footer – floats, shifts nothing)
    const toastIco = el('span', { class: 'xw-toast-ico', html: ICON.check(16) })
    const toastEl = el('div', { class: 'xw-toast', role: 'status', 'aria-live': 'polite' }, toastIco, el('span', { class: 'xw-toast-text' }))
    const oldBox = el('div')
    const actions = el('div', { class: 'xw-actions' },
      el('button', { type: 'button', class: 'xw-btn is-primary', onclick: startCreate, html: ICON.plus(18) }, label(el('span'), 'create')),
      el('button', { type: 'button', class: 'xw-btn', onclick: startRestore, html: ICON.restore(18) }, label(el('span'), 'restore')),
      oldBox)

    // Form (enter a name) with freely configurable buttons – e.g. when renaming an open wallet
    // "Close & rename" / "Close, rename & reopen" / "Cancel"
    const formTitle = el('div', { class: 'xw-form-title' })
    const formHint = el('div', { class: 'xw-form-hint' })
    const input = el('input', { class: 'xw-input', type: 'text', maxlength: 40, spellcheck: 'false', autocomplete: 'off' })
    const formError = el('div', { class: 'xw-form-error' })
    const formButtons = el('div')
    const form = el('form', { class: 'xw-hide', onsubmit: onSubmit }, formTitle, formHint, input, formError, formButtons)
    let formActions = []
    let formBusy = false

    // Address view: slides in from the right over the list
    const sheetTitle = el('div', { class: 'xw-sheet-title' })
    const sheetSub = el('div', { class: 'xw-sheet-sub' })
    const addrFilter = el('input', { class: 'xw-input', type: 'text', spellcheck: 'false', autocomplete: 'off', oninput: () => renderAddresses() })
    label(addrFilter, 'addrFilter', 'placeholder')
    const addrList = el('div', { class: 'xw-addr-list' })
    const addrChips = el('div', { class: 'xw-chips xw-hide', role: 'tablist' })
    label(addrChips, 'addrPortfolios', 'aria-label')
    const exportHint = label(el('div', { class: 'xw-sheet-sub xw-hide' }), 'exportHint')
    // Copy button variant 1A "light trail": both labels sit in the same grid cell, the width
    // follows the longer one – nothing jumps when they switch.
    const exportLabelA = el('span')
    const exportLabelB = el('span')
    const exportBtn = el('button', { type: 'button', class: 'xw-btn is-primary xw-cp xw-cp--trail', onclick: () => doExport() },
      el('span', { class: 'xw-cp-fx', 'aria-hidden': 'true' }, el('i', { class: 'xw-cp-ring' }), el('i', { class: 'xw-cp-comet' })),
      el('span', { class: 'xw-cp-halo', 'aria-hidden': 'true' }, el('i', { class: 'xw-cp-comet' })),
      el('span', { class: 'xw-cp-stack' },
        el('span', { class: 'xw-cp-a', html: ICON.copy(16) }, exportLabelA),
        el('span', { class: 'xw-cp-b', html: ICON.check(16) }, exportLabelB)))
    // While "Copied" shows, the number in the second label stays put, even if the selection changes
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
    // Remember the selected portfolio (account name like "exodus_1") per wallet – null = all
    const sheetPortfolioByWallet = new Map()
    // Export mode: multi-select, then copy all addresses as a list.
    // sheetCross = across wallets (selection = wallets); otherwise per wallet (selection = portfolios).
    let sheetExport = false
    let sheetCross = false
    let sheetSelected = new Set()

    // Main view in .xw-view: moves aside to the left when the address view (.xw-sheet) slides in.
    // Both are direct children of the panel; switching is done with .is-sheet on the panel.
    // Switch: keep all wallets running in the background (default: on)
    const bgToggle = label(el('button', { type: 'button', class: 'xw-toggle', role: 'switch', 'aria-checked': 'true' }), 'bgSync', 'aria-label')
    // One line – the explanation lives in the tooltip so the wallet list doesn't shrink
    const bgRow = label(el('div', { class: 'xw-bg xw-hide', onclick: () => toggleBackground() },
      el('div', { class: 'xw-bg-text' }, label(el('div', { class: 'xw-bg-title' }), 'bgSync')),
      bgToggle), 'bgSyncHint', 'title')
    const view = el('div', { class: 'xw-view' },
      sumBox,
      label(el('div', { class: 'xw-intro' }), 'intro'),
      el('div', { class: 'xw-section' }, label(el('div', { class: 'xw-label' }), 'yourWallets')),
      list,
      el('div', { class: 'xw-bottom' }, actions, form),
      bgRow,
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

    // Don't trigger Exodus keyboard shortcuts while typing in the sidebar
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

    // Stack for "Money received" (@xw:notify): top left below the navigation, beneath backdrop and sidebar
    const ntStack = el('div', { class: 'xw-nt-stack is-deck' })
    // Unseen incoming payments while the sidebar is closed: counter on the button and the affected wallets (IDs)
    let unseen = 0
    const pending = new Set()
    const root = el('div', { id: 'xw-root' }, toggle, ntStack, el('div', { id: 'xw-backdrop', onclick: () => closePanel() }), panel)
    document.body.appendChild(root)
    XW.syncReduce(root) // mirror "reduced motion" as class .xw-reduce
    applyTexts()

    // Place the button in front of the Exodus logo (header height/visibility changes per view)
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

    // Exodus sets the theme class (.exodus-theme-*) on an element inside #app-container.
    // Our #xw-root hangs directly off body and so doesn't inherit the variables – so we copy the
    // computed values over whenever the theme changes.
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
      debug(`Theme applied: ${key || '(default)'}`)
    }
    syncTheme()
    setInterval(syncTheme, 2000)

    // Stagger in the wallet rows (@xw:stagger). .xw-anim stays on the container only briefly: rows inserted
    // during that time (first load after opening) animate along; the 15 s redraw does not.
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
      // Incoming payments while the sidebar was closed: dot goes away; the row glows and the balance rolls once
      // panel and stagger are done (460 ms + 30 ms × row) – both with the same start time
      const marks = new Map()
      if (pending.size) {
        const t0 = performance.now()
        for (const id of pending) {
          const i = state ? Math.max(0, state.wallets.findIndex((w) => w.id === id)) : 0
          marks.set(id, t0 + 460 + i * 30)
          rollAt.set('w:' + id, t0 + 460 + i * 30)
        }
        rollAt.set('sum', t0 + 460)
        pending.clear()
      }
      unseen = 0
      XW.nt.badge(toggle, 0)
      refresh().then(() => {
        for (const [id, at] of marks) {
          const item = itemFor(id)
          if (item) XW.nt.markWallet(item, Math.max(0, Math.round(at - performance.now())))
        }
      })
      refreshEvery = 0
      setRefreshEvery(15000)
      setTimeout(() => panel.focus(), 60)
    }

    let refreshEvery = 0
    function setRefreshEvery (ms) {
      if (refreshEvery === ms) return
      refreshEvery = ms
      clearInterval(refreshTimer)
      refreshTimer = setInterval(refresh, ms)
    }

    function closePanel () {
      open = false
      root.classList.remove('xw-open')
      toggle.setAttribute('aria-expanded', 'false')
      clearInterval(refreshTimer)
      refreshEvery = 0
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

    // Notices as a toast. Short confirmations stay for 2.4 s (handoff default); longer texts and errors
    // stay longer so they can be read. The remaining-time line runs for exactly this duration.
    function showNotice (text, kind) {
      const len = String(text).length
      const hold = kind === 'error'
        ? Math.min(10000, Math.max(4000, 1500 + len * 50))
        : Math.min(8000, Math.max(2400, 1100 + len * 38))
      toastIco.innerHTML = kind === 'error' ? ICON.alert(16) : kind === 'ok' ? ICON.check(16) : ICON.info(16)
      XW.toast(toastEl, text, kind || '', hold)
    }
    const fail = (e) => showNotice(e.message, 'error')

    function applyLanguage (lang) {
      if ((lang || 'en') === language) return
      setLanguage(lang || 'en')
      applyTexts()
      if (!form.classList.contains('xw-hide')) hideForm() // an open form would still show the old language
    }

    function render () {
      if (!state) return
      applyLanguage(state.locale && state.locale.language)
      const hide = !!state.settings.hideBalances
      eyeBtn.innerHTML = hide ? ICON.eyeOff(18) : ICON.eye(18)
      eyeBtn.title = hide ? T.showBalances : T.hideBalances
      count.textContent = String(state.wallets.length)
      count.classList.toggle('xw-hide', state.wallets.length < 2)
      renderSum(hide)
      bgToggle.setAttribute('aria-checked', String(state.settings.backgroundSync !== false))
      bgRow.classList.toggle('xw-hide', state.wallets.length < 2)
      // While a wallet is still loading or being set up, check more often (4 s instead of 15 s)
      const busy = state.wallets.some((w) => w.setup || (w.running && w.status && w.status.state !== 'ready'))
      if (open) setRefreshEvery(busy ? 4000 : 15000)
      // An open menu belongs to an element that is about to be replaced
      closeMenu()
      list.replaceChildren(...state.wallets.map((w, i) => renderWallet(w, hide, i)))
      oldBox.replaceChildren(...state.oldFolders.map((f) =>
        el('button', { type: 'button', class: 'xw-btn', onclick: () => startImport(f), html: ICON.import(18) },
          el('span', { text: T.importOld(f.name) }))))
    }

    // Wrap the balance in .xw-roll (@xw:roll). If the value changed since the last render, the old
    // value rolls out and the new one rolls in – direction by the number. On the first render and with hidden
    // balances (••••••) the value is simply shown, without animation.
    // rollAt: start time (performance.now) for a balance's next roll – after an incoming payment while the
    // sidebar was closed, it only rolls together with the row glow
    const rollAt = new Map()
    function rollHost (key, text, num, rollable) {
      const host = el('span', { class: 'xw-roll' })
      const prev = prevValues.get(key)
      prevValues.set(key, rollable ? { text, num } : null)
      const at = rollAt.get(key)
      rollAt.delete(key)
      if (rollable && prev && prev.text !== text) {
        const delay = at ? Math.round(at - performance.now()) : 0
        if (delay > 0) {
          host.classList.add('is-delayed')
          host.style.setProperty('--xw-roll-d', delay + 'ms')
        }
        host.appendChild(el('span', { class: 'xw-roll-cur', text: prev.text }))
        XW.roll(host, text, num > prev.num ? 'up' : num < prev.num ? 'down' : '')
      } else {
        host.appendChild(el('span', { class: 'xw-roll-cur', text }))
      }
      return host
    }

    // Total of all wallets. Different currencies (e.g. one wallet in USD, one in EUR) are not
    // converted – that would need exchange rates from the network – but shown as subtotals.
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
        // With several currencies the whole string rolls; the direction comes from the main currency
        el('div', { class: 'xw-sum-value' + (groups.length > 1 && !hide ? ' is-multi' : '') }, rollHost('sum', text, groups[0][1], !hide)),
        // replaceChildren() would insert null as the text "null", hence an empty array instead of null
        ...(missing ? [el('div', { class: 'xw-sum-note', text: T.sumMissing(missing) })] : []))
      sumBox.classList.remove('xw-hide')
    }

    // What Exodus is currently doing in this wallet – only while it isn't simply "ready". For new wallets
    // (create, restore, import) this says it has to stay open until everything is loaded.
    function statusLine (w) {
      const st = w.running && w.status ? w.status.state : null
      let text = null
      let warn = false
      if (st && st !== 'ready') {
        if (st === 'onboarding' && !w.hasWallet) return null // "Waiting for the 12 words" / "New" is already shown
        text = st === 'starting' ? T.stStarting
          : st === 'onboarding' ? T.stOnboarding
            : st === 'locked' ? T.stLocked
              : st === 'loading' ? T.stLoading
                : st === 'restoring' ? T.stRestoring(w.status.left)
                  : st === 'syncing' ? T.stSyncing
                    : st === 'addresses' ? T.stAddresses : null
        warn = st === 'locked'
      } else if (w.setup && w.running) {
        text = T.stAlmost
      } else if (w.setup && !w.running && w.hasWallet) {
        text = T.stSetupPending
        warn = true
      }
      if (!text) return null
      return el('div', { class: 'xw-status' + (warn ? ' is-warn' : ''), role: 'status' }, el('span', { class: 'xw-spin', 'aria-hidden': 'true' }), el('span', { text }))
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
      else if (w.background) badges.push(el('span', { class: 'xw-badge is-background', text: T.badgeBackground }))
      else if (w.running) badges.push(el('span', { class: 'xw-badge is-running', text: T.badgeOpen }))
      // Just finished setting up: "Ready" for half an hour
      const readyAt = !w.setup && cache && Date.parse(cache.setupDoneAt || '')
      if (readyAt && Date.now() - readyAt < 30 * 60 * 1000) badges.push(el('span', { class: 'xw-badge is-ready', text: T.badgeReady }))
      if (w.isStart && state.wallets.length > 1) badges.push(el('span', { class: 'xw-badge is-start', text: T.badgeStart }))

      // Portfolios in one row; if they don't fit, the row fades out on the right and scrolls sideways with the mouse wheel
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
          if (atEnd) return // at the edge, keep scrolling the list normally
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

      // Real status change (e.g. another wallet was just opened)? Not on every redraw.
      const status = w.isCurrent ? 'current' : w.running ? 'running' : ''
      const becameLive = prevStatus.has(w.id) && prevStatus.get(w.id) !== status && !!status
      prevStatus.set(w.id, status)

      const name = labelOf(w)
      const item = el('div', {
        class: 'xw-item' + (w.isCurrent ? ' is-current' : w.running ? ' is-running' : ''),
        style: `--xw-i:${index + 2}`, // header 0, total 1, wallet rows from 2
        'data-id': w.id,
        role: 'listitem',
        tabindex: w.isCurrent ? null : '0',
        title: w.isCurrent ? T.itemCurrent : (w.running ? T.itemRunning : T.itemOpen),
      },
      // Custom picture (data: URL from main.js) or the Exodus logo
      w.avatar
        ? el('div', { class: 'xw-avatar has-image' }, el('img', { src: w.avatar, alt: '', draggable: 'false' }))
        : el('div', { class: 'xw-avatar is-exodus' }),
      el('div', { class: 'xw-body' },
        el('div', { class: 'xw-name' }, el('span', { class: 'xw-name-text', text: name }), ...badges),
        el('div', { class: 'xw-bal' + (cache ? '' : ' is-muted') }, cache ? rollHost('w:' + w.id, balance, cache.total, !hide) : balance),
        cache ? el('div', { class: 'xw-meta', text: T.updated(ago(cache.updatedAt)) }) : null,
        statusLine(w),
        ports),
      moreBtn)

      // Quick switch: appears on hover, opens the wallet and closes this window
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

      // Right-click opens the same menu at the mouse position
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleMenu(w, moreBtn, { x: e.clientX, y: e.clientY })
      })

      if (!w.isCurrent) {
        item.addEventListener('click', (e) => { if (!e.target.closest('.xw-more, .xw-fast')) openWallet(w, false) })
        item.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === item) openWallet(w, false) })
      }
      // Status dot pops in and pulses once (@xw:switch), then the class is removed again
      if (becameLive) {
        XW.replay(item, 'is-live')
        setTimeout(() => item.classList.remove('is-live'), 1000)
      }
      return item
    }

    // -----------------------------------------------------------------------------------------
    // 3-dot menu
    // -----------------------------------------------------------------------------------------

    let menu = null
    let menuButton = null

    function menuEntries (w) {
      const entries = []
      if (!w.isCurrent) {
        entries.push([ICON.open, w.background ? T.mShow : w.running ? T.mFocus : T.mOpen, () => openWallet(w, false)])
        entries.push([ICON.swap, T.mSwitch, () => openWallet(w, true)])
        if (w.running && !w.background && state.settings.backgroundSync !== false) entries.push([ICON.layers, T.mBackground, () => moveToBackground(w)])
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
      // Desktop shortcuts only exist on Windows (.lnk)
      if (!state || state.platform === 'win32') entries.push([ICON.desktop, T.mShortcut, () => makeShortcut(w)])
      entries.push([ICON.folder, T.mFolder, () => call('showFolder', w.id).catch(fail)])
      // The default folder belongs to Exodus itself; a wallet can't delete itself from its own window
      if (!w.isStandard && !w.external && !w.isCurrent) {
        entries.push('-')
        entries.push([ICON.trash, T.mDelete, () => startDelete(w), 'is-danger'])
      }
      return entries.filter((e, i, all) => e !== '-' || (i > 0 && all[i - 1] !== '-'))
    }

    // point: mouse position on right-click – then open there instead of at the ⋯ button
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
          style: `--xw-i:${itemIndex++}`, // slightly staggered fade-in
          html: icon(16),
          onclick: (e) => { e.stopPropagation(); if (!run) return; closeMenu(); run() },
        }, el('span', { text })))
      }
      panel.appendChild(node)
      // Below the button, right-aligned; if it no longer fits below, open upwards
      const pr = panel.getBoundingClientRect()
      const br = button.getBoundingClientRect()
      const h = node.offsetHeight
      if (point) {
        // At the mouse, but fully inside the panel (otherwise shift left/up)
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
        // Never beyond the panel edge – if necessary the menu covers its own button
        const top = Math.min(Math.max(8, wanted), pr.height - h - 8)
        node.style.right = Math.max(8, Math.round(pr.right - br.right)) + 'px'
        node.style.top = Math.round(top) + 'px'
        // When it opens upwards, it grows from the bottom corner (formerly class .is-up)
        node.style.transformOrigin = below ? 'top right' : 'bottom right'
        button.setAttribute('aria-expanded', 'true')
      }
      menu = node
      menuButton = button
      button.classList.add('is-active')
      // Open one frame later so the transition runs from the closed state
      requestAnimationFrame(() => {
        if (menu !== node) return
        node.classList.add('is-open')
        const first = node.querySelector('.xw-menu-item:not(.is-checked)')
        if (first) first.focus()
      })
    }

    // Close: remove .is-open (120 ms ease-in), then remove it from the DOM
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
    // Actions
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

    async function moveToBackground (w) {
      try {
        await call('hide', w.id)
        showNotice(T.bgMoved(T.q(labelOf(w))), 'ok')
        setTimeout(refresh, 2000)
      } catch (e) {
        fail(e)
      }
    }

    async function toggleBackground () {
      if (!state) return
      const on = state.settings.backgroundSync === false
      bgToggle.setAttribute('aria-checked', String(on))
      try {
        await call('settings', { backgroundSync: on })
        refresh()
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
    // Copy addresses – from the address cache, the wallet doesn't need to be open for this
    // -----------------------------------------------------------------------------------------

    function tickerStyle (ticker) {
      let h = 0
      for (const ch of ticker) h = (h * 31 + ch.codePointAt(0)) % 360
      return `background:linear-gradient(135deg,hsl(${h},45%,42%),hsl(${(h + 40) % 360},55%,30%))`
    }

    // Real Exodus icon (path from main.js); if it's missing or fails to load, the ticker as a fallback
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
        if (sheetExport) sheetSelected = new Set(sheetPortfolios().map(([account]) => account)) // start: all
        renderAddresses()
      } catch (e) {
        addrList.replaceChildren(el('div', { class: 'xw-empty', text: e.message }))
      }
    }

    // Cross-wallet export: selection = wallets, copies their addresses as one list
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
        sheetSelected = new Set(sheetWallets().map(([id]) => id)) // start: all wallets
        renderAddresses()
      } catch (e) {
        addrList.replaceChildren(el('div', { class: 'xw-empty', text: e.message }))
      }
    }

    // Back: the sheet slides out to the right, the main view returns (@xw:sheet runs in reverse)
    function closeSheet () {
      sheetWallet = null
      sheetCross = false
      panel.classList.remove('is-sheet')
      sheet.setAttribute('aria-hidden', 'true')
    }

    // Wallets in the data set (for the cross-wallet export), in the order delivered
    function sheetWallets () {
      const seen = new Map()
      for (const a of sheetAddresses) if (!seen.has(a.walletId)) seen.set(a.walletId, a.wallet || a.walletId)
      return [...seen.entries()]
    }

    // Selection key per address: the wallet when cross-wallet, otherwise the portfolio
    const groupKey = (a) => (sheetCross ? a.walletId : a.account)
    const exportGroups = () => (sheetCross ? sheetWallets() : sheetPortfolios())

    // Portfolios in Exodus order (exodus_0, exodus_1, …) with their display name. Portfolios
    // that Exodus knows but that have no saved addresses yet get the key "name:<name>"
    // and are appended at the end – so they still show up as a tab.
    function sheetPortfolios () {
      const seen = new Map()
      for (const a of sheetAddresses) if (!seen.has(a.account)) seen.set(a.account, a.portfolio || a.account)
      const list = [...seen.entries()].sort((x, y) => x[0].localeCompare(y[0], 'en', { numeric: true }))
      const known = new Set(list.map(([, name]) => name))
      for (const name of sheetPortfolioNames) if (!known.has(name)) { known.add(name); list.push(['name:' + name, name]) }
      return list
    }

    // groups: [key, label] – portfolios (per wallet) or wallets (cross-wallet). The first chip is "All"
    // (key null). If the chip set stays the same, only states are toggled – so the border cross-fade
    // and the small spring on activation run (@xw:chip). Rebuilt only when the set changes.
    function renderChips (groups, selected) {
      // With a single portfolio in normal mode tabs are pointless; in export mode we
      // show them anyway (multi-select incl. "All").
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
      // "All" is exclusive: if all are selected, only "All" is lit
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
      if (key === null) sheetSelected = new Set(all) // "All" selected
      else if (allSelected) sheetSelected = new Set([key]) // coming from "All": only this one
      else {
        if (sheetSelected.has(key)) sheetSelected.delete(key)
        else sheetSelected.add(key)
        if (!sheetSelected.size) sheetSelected = new Set(all) // nothing active any more → back to "All"
      }
      renderAddresses()
    }

    // Addresses that would currently be exported: selected portfolios + search filter, duplicates removed.
    // (ETH and all ERC-20 tokens share one address – it should appear only once in the list.)
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

    // Copy → light trail, green border, label switches; back after 1800 ms. Another click
    // during "Copied" only extends the timer (XW.confirm), the animation doesn't restart.
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

      // Export mode: filter by selection (portfolios or wallets), copy button with count
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
        // Cross-wallet: by wallet, then portfolio; otherwise by portfolio
        const rows = list.slice().sort((x, y) =>
          (order.get(groupKey(x)) - order.get(groupKey(y))) ||
          x.account.localeCompare(y.account, 'en', { numeric: true }))
        // Wallets with several portfolios: show the portfolio on each row
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
      // With "All", group by portfolio (with heading); with a selected portfolio, a flat list
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

    // showPortfolio: also show the portfolio name on each row (e.g. in the cross-wallet export)
    function addressRow (a, showPortfolio) {
      const multiPortfolio = showPortfolio !== undefined ? showPortfolio : sheetPortfolios().length > 1
      // Row copy confirmation (@xw:row): address ↑ out, "Address copied" ↑ in, icon morphs
      // into a checkmark; holds 1400 ms. Both texts sit in the same grid cell (.xw-addr-sub) – no jumping.
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
    // Form
    // -----------------------------------------------------------------------------------------

    // buttons: [{ text, run: async (value) => {} }] – the first one is the main button (also for Enter)
    // More button options: danger (red), free (not bound to confirmValue), keepOpen (form stays open).
    // confirmValue: buttons only become active once exactly this text is typed (e.g. wallet name when deleting).
    let formConfirm = null
    let gatedNodes = []
    function updateGate () {
      const ok = formConfirm == null || input.value.trim() === formConfirm
      if (ok) input.classList.remove('is-error')
      for (const n of gatedNodes) {
        if (n.classList.contains('is-danger')) {
          // Delete button: aria-disabled instead of disabled – otherwise it wouldn't get clicks for the shake.
          // On the transition to "name matches" it springs once (@xw:delete .is-armed).
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
        // Wrong or missing name when deleting: the field shakes briefly, red border, focus back.
        // (main.js checks the name again on delete anyway.)
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
      // Default wallet: display name only, no closing needed
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

    // -----------------------------------------------------------------------------------------
    // Money received (@xw:notify). main.js sends the incoming payment only to the focused window and never
    // to the receiving wallet's own window – Exodus shows it there with its own display and sound.
    // -----------------------------------------------------------------------------------------

    // Exodus' own receive sound, the same file for every wallet (src/static/media/audio/receive.wav,
    // the same path Exodus itself uses). Load once, then reuse.
    const receiveSound = new Audio('media/audio/receive.wav')
    receiveSound.preload = 'auto'

    const itemFor = (id) => [...list.children].find((n) => n.dataset && n.dataset.id === id) || null

    function formatAmount (n, ticker) {
      const f = (opts) => new Intl.NumberFormat(intlLocale(), opts).format(n)
      let text = f({ maximumFractionDigits: 8 })
      if (!/[1-9]/.test(text)) text = f({ maximumSignificantDigits: 4 }) // tiny amounts (e.g. tokens with 18 decimals)
      return '+' + text + ' ' + ticker
    }

    // New wallet finished setting up: "Ready – everything loaded" card (no sound), also in its own window
    async function onReady (ev) {
      if (ev.language) applyLanguage(ev.language)
      const name = ev.wallet || T.standard
      const here = state && state.wallets.find((w) => w.isCurrent)
      const own = here && ev.walletId && here.id === ev.walletId
      const card = XW.nt.notify(ntStack, {
        wallet: { name, img: ev.avatar || 'svg/brand/exodus-logomark.svg' },
        coin: { name: T.readySub, ticker: '', icon: READY_ICON },
        amount: T.readyTitle,
        value: null,
        portfolio: null,
        time: ago(new Date(ev.at).toISOString()),
        hidden: false,
      }, {
        sound: null,
        // Click: bring another wallet to the front; in its own window, open the sidebar
        onOpen: () => { if (own) { if (!open) openPanel() } else if (ev.walletId) openWallet({ id: ev.walletId, label: name }, false) },
      })
      if (!ev.avatar) card.querySelector('.xw-nt-av').classList.add('is-exodus')
      card.classList.add('is-ready')
      XW.nt.layout(ntStack) // two-line hint → re-measure the height
      if (open) {
        await refresh()
        const item = ev.walletId && itemFor(ev.walletId)
        if (item) XW.nt.markWallet(item, 0)
      }
    }

    async function onReceived (ev) {
      if (ev && ev.type === 'ready') return onReady(ev)
      if (!ev || typeof ev.amount !== 'number' || !ev.ticker) return
      // Safety net: incoming payment on this window's wallet → nothing (no card, no dot, no glow)
      const here = state && state.wallets.find((w) => w.isCurrent)
      if (here && ev.walletId && here.id === ev.walletId) return
      if (ev.language) applyLanguage(ev.language)
      const hidden = !!ev.hidden
      const name = ev.wallet || T.standard
      // Exodus plays receive.wav itself on every incoming payment – also in a background wallet's window. If it
      // already did (main.js keeps count), the card stays silent: the same sound, exactly once.
      const sound = ev.exodusSound || (ev.sound && ev.sound.on === false) ? null : receiveSound
      if (sound && ev.sound && typeof ev.sound.volume === 'number') sound.volume = ev.sound.volume
      const card = XW.nt.notify(ntStack, {
        wallet: { name, img: ev.avatar || 'svg/brand/exodus-logomark.svg' },
        coin: { name: ev.coin || ev.ticker, ticker: ev.ticker, icon: ev.icon || null },
        amount: hidden ? '' : formatAmount(ev.amount, ev.ticker),
        value: hidden || typeof ev.value !== 'number' ? null : '≈ ' + money(ev.value, ev.currency),
        portfolio: ev.portfolio || null,
        time: ago(new Date(ev.at).toISOString()),
        hidden,
      }, {
        sound,
        // Open or bring to the front – the same action as a click on the wallet row
        onOpen: () => { if (ev.walletId) openWallet({ id: ev.walletId, label: name }, false) },
      })
      if (!ev.avatar) card.querySelector('.xw-nt-av').classList.add('is-exodus')

      if (open) {
        // Sidebar open: the row glows right away, the balance rolls on redraw (not with hidden balances)
        await refresh()
        const item = ev.walletId && itemFor(ev.walletId)
        if (item) XW.nt.markWallet(item, 0)
      } else {
        unseen++
        if (ev.walletId) pending.add(ev.walletId)
        XW.nt.badge(toggle, unseen)
      }
    }
    ipcRenderer.on('exodus-wallets:received', (_event, ev) => {
      onReceived(ev).catch((e) => debug('Incoming-payment display failed: ' + e.message))
    })

    // When switching back to the window, reload the other wallets' balances right away
    window.addEventListener('focus', () => { if (open) refresh() })

    // Show the wallet count on the button and pick up the language early
    setTimeout(() => { if (!state) refresh() }, 8000)
  }

  if (isExodusUi()) {
    debug('isExodusUi=true, starting UI...')
    if (document.readyState === 'loading') {
      debug('waiting for DOMContentLoaded...')
      document.addEventListener('DOMContentLoaded', () => {
        debug('DOMContentLoaded')
        start()
      }, { once: true })
    } else {
      debug('DOM already loaded')
      start()
    }
  } else {
    debug('isExodusUi=false, UI will NOT be started')
  }
}
