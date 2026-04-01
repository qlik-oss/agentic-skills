# Advanced Patterns — Qlik Embed API Skill

Reactive selections, Clear All HUD, error handling, and debugging patterns. Referenced from the main [SKILL.md](../SKILL.md).

---

## Reactive Selections — D3 ↔ Qlik Bidirectional

The app connection must be **persistent** (not recreated per call) to support reactivity. Open the app once and keep references to the doc, field object, hypercube, and selection object.

### Persistent Reference Pattern

```javascript
let appDoc     = null;  // Qlik doc (engine connection)
let sessionObj = null;  // hypercube session object — drives D3 redraw
let selObj     = null;  // app-wide SelectionObject — drives Clear All HUD
let fieldObj   = null;  // field object — used to apply selections from D3 clicks

async function openApp(doc) {
  appDoc  = doc || (await qix.openAppSession({ appId: APP_ID }).getDoc());
  fieldObj = await appDoc.getField('YourFieldName');

  // Hypercube — reacts to selections, redraws D3
  sessionObj = await appDoc.createSessionObject({ /* qHyperCubeDef */ });
  sessionObj.on('changed', async () => {
    const data = await getHypercubeData();
    redrawD3Chart(data);
  });

  // SelectionObject — reacts to ANY selection anywhere in the app
  selObj = await appDoc.createSessionObject({
    qInfo: { qType: 'SelectionObject' },
    qSelectionObjectDef: {}
  });
  selObj.on('changed', () => updateClearAllHUD());

  // Polling fallback — embedded qlik-embed filter panels don't always
  // trigger selObj.on('changed') in the @qlik/api session
  setInterval(updateClearAllHUD, 1500);
}
```

**Why two separate objects?**
- `sessionObj` (hypercube) only knows about the fields in its own definition — it misses selections made in filter panels on other fields
- `selObj` (SelectionObject) tracks ALL active selections across every field in the app — it's the only reliable source of truth

**Why the polling fallback?**
- Embedded `<qlik-embed>` filter panels run in their own shadow DOM session
- Selections made through them don't always fire `selObj.on('changed')` in the `@qlik/api` session

---

## MANDATORY RULE — D3 Clicks MUST Drive Qlik Selections

**Every D3 visualization click must call `fieldObj.selectValues()` to apply that selection back into the Qlik engine.** D3 clicks that only update visual state locally are incomplete.

### Canonical toggleSelection — Multi-Field Version

Use this pattern for ALL D3 click handlers:

```javascript
async function toggleSelection(fieldName, value) {
  if (!appDoc) return;

  const fld = await appDoc.getField(fieldName);

  // Check if this value is already the only selection via SelectionObject
  const selLayout = await selObj.getLayout();
  const existing  = selLayout.qSelectionObject.qSelections || [];
  const thisField = existing.find(s => s.qField === fieldName);
  const isOnlySelection = thisField
    && thisField.qSelectedCount === 1
    && thisField.qSelected === value;

  if (isOnlySelection) {
    await fld.clear();
  } else {
    await fld.selectValues(
      [{ qText: value }],
      false,  // toggle mode off — replace existing selection
      true    // soft lock — allows other fields to still filter
    );
  }
}
```

> **Why SelectionObject instead of hypercube qState?** The SelectionObject tracks ALL active selections across every field in the app. Hypercube `qState` only reflects fields defined in the cube.

### Wire to every D3 click handler

```javascript
// Bar chart
.on('click', (event, d) => toggleSelection('YourFieldName', d.label))

// Force node
.on('click', (event, d) => toggleSelection('AdmitProvNM', d.id))

// Chord arc
.on('click', (event, d) => toggleSelection('HRRP Condition', names[d.index]))

// Sunburst segment
.on('click', (event, d) => {
  if (d.depth === 1) toggleSelection('HRRP Condition', d.data.name);
  if (d.depth === 2) toggleSelection('ICD9DSC', d.data.name);
})
```

> D3 visuals that zoom or animate locally without calling `toggleSelection()` look interactive but break the Qlik associative model. Every click = a Qlik selection.

### Reflect selection state visually in D3

Using `qState` from the hypercube layout:
- `qState === 'S'` → selected (full opacity)
- `qState === 'X'` or `'XS'` → excluded (dim to ~0.3 opacity, muted fill)

```javascript
.attr('fill',    d => d.excluded ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--accent)')
.attr('opacity', d => d.excluded ? 0.3 : (d.selected ? 1 : 0.85))
```

---

## Clear All — Dual HUD System

Two complementary components work together. See [design-reference.md](design-reference.md) for full CSS.

### 1. Fixed Top-Right Floating HUD

**`position: fixed; top: 18px; right: 24px`** — always visible as the user scrolls. Shows active field summary + Clear All button. Appears only when selections are active.

> Do NOT place at `bottom: 0` (obscures charts) or in the header (hidden behind sticky elements).

### 2. Always-Visible Inline Selections Bar (Below Filters)

Persistent bar directly below the filter strip — shows "No filters applied" when empty, or chips for each active selection with individual clear buttons.

### updateClearAllHUD — Uses SelectionObject, NOT the hypercube

```javascript
async function updateClearAllHUD() {
  if (!selObj) return;
  try {
    const selLayout  = await selObj.getLayout();
    const selections = selLayout.qSelectionObject.qSelections || [];

    const btn      = document.getElementById('clear-all-btn');
    const label    = document.getElementById('active-selections-label');
    const bar      = document.getElementById('selections-bar');
    const emptyMsg = document.getElementById('sel-empty-msg');

    // Floating top-right HUD
    if (selections.length > 0) {
      btn.classList.add('visible');
      label.style.opacity = '1';
      label.textContent = '● ' + selections
        .map(s => s.qField + (s.qSelectedCount ? ' (' + s.qSelectedCount + ')' : ''))
        .join('  ·  ');
    } else {
      btn.classList.remove('visible');
      label.style.opacity = '0';
      label.textContent   = '';
    }

    // Inline selections bar
    bar.querySelectorAll('.sel-chip, .clear-all-inline').forEach(el => el.remove());
    if (selections.length === 0) {
      emptyMsg.style.display = '';
    } else {
      emptyMsg.style.display = 'none';
      selections.forEach(s => {
        const chip = document.createElement('div');
        chip.className = 'sel-chip';
        chip.innerHTML = `<span>${s.qField} (${s.qSelectedCount})</span><span class="chip-x">✕</span>`;
        chip.querySelector('.chip-x').addEventListener('click', async (e) => {
          e.stopPropagation();
          const fld = await appDoc.getField(s.qField);
          await fld.clear();
          updateClearAllHUD();
        });
        bar.appendChild(chip);
      });
      const clearBtn = document.createElement('button');
      clearBtn.className = 'clear-all-inline';
      clearBtn.textContent = '✕ Clear All';
      clearBtn.addEventListener('click', clearAll);
      bar.appendChild(clearBtn);
    }
  } catch(e) { console.warn('HUD update error:', e); }
}
```

**Critical:** Do NOT use hypercube rows to check active selections — it only sees fields in its own definition. Always use `selObj`.

### clearAll function

```javascript
async function clearAll() {
  if (!appDoc) return;
  await appDoc.clearAll(false);  // false = do not lock selections
  updateClearAllHUD();
}

document.getElementById('clear-all-btn')
  .addEventListener('click', clearAll);
```

---

## Error Handling Pattern

```javascript
async function initCustomChart() {
  try {
    const data = await fetchData();
    if (!data.length) {
      showError('No data returned — check field names match app');
      return;
    }
    drawBarChart(data);
  } catch(err) {
    console.warn('Chart error:', err);
    showError('Engine error: ' + (err.message || err));
  }
}

function showError(msg) {
  const el = document.getElementById('chart-loading');
  if (el) el.innerHTML = `
    <div style="font-family:'DM Mono',monospace;font-size:11px;color:#ef4444;
                text-align:center;line-height:2;padding:20px;">
      ⚠ ${msg}
    </div>`;
}
```

---

## Debugging the Hypercube

Add these console logs to trace failures:

```javascript
console.log('Step 1: auth config set');
console.log('Step 2: opening app session...');
console.log('Step 3: doc opened');
console.log('Step 4: layout received, pages:', layout.qHyperCube.qDataPages.length);
console.log('Step 5: row count:', rows.length);
console.log('Step 6: data:', JSON.stringify(rows.slice(0,3)));
```

### Common failure points

| Symptom | Cause | Fix |
|---|---|---|
| `row count: 0` | Field name wrong or measure expression invalid | Use `qlik_get_fields()` to verify exact field names |
| WebSocket error | Using enigma.js with `?access_token=` pattern | Switch to `@qlik/api` |
| "Qlik runtime system not found" | Pinned CDN version doesn't exist | Use unversioned CDN |
| Spinner never stops | `oauth-callback.js` not deployed or wrong `data-host` | Check callback page |
| "No permission to open app" | OAuth client missing `user_default` scope | Add scope in MC → OAuth |
| D3 chart blank, no error | `@qlik/api` called before qlik-embed auth completes | Use retry pattern or increase delay |
| HUD shows "No filters" despite active selections | Filter panels don't fire `selObj.on('changed')` | Add `setInterval(updateClearAllHUD, 1500)` |
| D3 click zooms but KPIs don't update | Click only updates local visual | Wire to `toggleSelection()` |
| Dashboard dies after ~6 hours | SPA access token expired, no refresh token | Add page reload timer or use server-side OAuth |

---

## Verifying Field Names Before Writing the Hypercube

**Always use MCP tools to verify fields before hardcoding in the hypercube:**

- Use `qlik_get_fields(appId)` to see all available fields
- Use `qlik_create_data_object()` to test dimension + measure combinations
- Never assume field names — they're often different from display labels
