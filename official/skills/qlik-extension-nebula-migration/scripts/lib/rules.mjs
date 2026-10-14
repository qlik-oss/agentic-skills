// Detection rules shared by inventory.mjs and check-no-host-apis.mjs.
//
// bucket:
//   direct   - has a documented or evidence-based nebula equivalent (see references/api-mapping.md)
//   rewrite  - no 1:1 mapping; the code has to be redesigned
//   host     - depends on the Sense client page (APIs, frameworks, DOM, CSS); must not survive migration
//   review   - may be fine or may not; a person or the agent has to look at the context
//
// scope: "js" | "html" | "css" | "any". `id(m)` may derive the id from the match.
// These are regex heuristics, not a parser. Treat hits as a work list, not a verdict.

const QLIK_ROOT = {
  Promise: ["direct", "native Promise"],
  resize: ["direct", "useRect() as an effect dependency"],
  currApp: ["rewrite", "useApp() returns the raw engine Doc, not the capability QApp wrapper"],
  navigation: ["rewrite", "galaxy.anything.sense.navigation or useNavigation(); optional, Sense-only, guard it"],
  theme: ["rewrite", "useTheme()"],
  table: ["rewrite", "no equivalent; render from layout.qHyperCube.qDataPages"],
  openApp: ["host", "client-only API; not available to nebula"],
  getGlobal: ["host", "use useGlobal()"],
  getAppList: ["host", "client-only API; not available in Qlik Cloud"],
  getExtensionList: ["host", "deprecated client-only API"],
  callRepository: ["host", "deprecated client-only API; not available in Qlik Cloud"],
  sessionApp: ["host", "not available in Qlik Cloud via capability API; use enigma/@qlik/api outside the extension"],
  sessionAppFromApp: ["host", "not available in Qlik Cloud via capability API"],
  setOnError: ["host", "deprecated client-only API"],
  setLanguage: ["host", "client-only API; use useTranslator()/useAppLayout() for locale"],
  setDeviceType: ["host", "client-only API; use useDeviceType()"],
  registerExtension: ["host", "client-only API; build a normal supernova instead"],
  getThemeList: ["host", "client-only API"],
  on: ["host", "client-only event API"],
  off: ["host", "client-only event API"],
};

const BACKEND = {
  selectValues: ["direct", "instant selection: model.selectHyperCubeValues(path, dim, values, toggle)"],
  getData: ["direct", "model.getHyperCubeData(path, pages)"],
  eachDataRow: ["direct", "iterate layout.qHyperCube.qDataPages[*].qMatrix"],
  getRowCount: ["direct", "layout.qHyperCube.qSize.qcy"],
  getDataRow: ["direct", "index into the loaded qDataPages"],
  getDimensionInfos: ["direct", "layout.qHyperCube.qDimensionInfo"],
  getMeasureInfos: ["direct", "layout.qHyperCube.qMeasureInfo"],
  getProperties: ["direct", "model.getProperties()"],
  setProperties: ["direct", "model.setProperties(props)"],
  applyPatches: ["direct", "model.applyPatches(patches, softPatch)"],
  clearSelections: ["direct", "selections.clear() or model.resetMadeSelections()"],
  hasSelections: ["direct", "selections.isActive() / layout.qSelectionInfo.qInSelections"],
  isSnapshot: ["direct", "layout.snapshotData presence (see snapshots-and-export.md)"],
  getReducedData: ["direct", "model.getHyperCubeReducedData(path, pages, zoom, mode)"],
  getPivotData: ["direct", "model.getHyperCubePivotData(path, pages)"],
  getStackData: ["direct", "model.getHyperCubeStackData(path, pages, maxNbrCells)"],
  selectRange: ["direct", "model.rangeSelectHyperCubeValues(path, ranges, columnsToSelect, orMode)"],
  search: ["review", "no direct hook; implement with the engine search methods or drop it"],
  acceptSearch: ["review", "no direct hook"],
  abortSearch: ["review", "no direct hook"],
  setCacheOptions: ["review", "no equivalent; page explicitly with getHyperCubeData"],
  clearSoftPatches: ["direct", "model.clearSoftPatches()"],
  expandLeft: ["direct", "model.expandLeft(path, row, col, all)"],
  expandTop: ["direct", "model.expandTop(path, row, col, all)"],
  collapseLeft: ["direct", "model.collapseLeft(path, row, col, all)"],
  collapseTop: ["direct", "model.collapseTop(path, row, col, all)"],
  save: ["review", "deprecated; no equivalent"],
};

const APP = {
  field: ["rewrite", "(await app.getField(name)).select*(...) on the raw Doc from useApp()"],
  variable: ["rewrite", "app.getVariableByName(...) / setStringValue on the raw Doc"],
  getObject: ["rewrite", "useEmbed().render({ element, id }) or model calls; do not embed from inside a chart unless needed"],
  visualization: ["rewrite", "useEmbed() or build the chart yourself"],
  createCube: ["rewrite", "app.createSessionObject({ qInfo, qHyperCubeDef }) then getLayout(); destroy on unmount"],
  createList: ["rewrite", "app.createSessionObject({ qInfo, qListObjectDef })"],
  createGenericObject: ["rewrite", "app.createSessionObject(...)"],
  createTable: ["rewrite", "no equivalent"],
  getObjectProperties: ["rewrite", "app.getObject(id) then getProperties()"],
  theme: ["rewrite", "useTheme()"],
  bookmark: ["rewrite", "app.applyBookmark / createBookmark on the raw Doc"],
  selectionState: ["rewrite", "app.getSelectionObject / session object with qSelectionObjectDef"],
  clearAll: ["rewrite", "app.clearAll()"],
  back: ["rewrite", "app.back()"],
  forward: ["rewrite", "app.forward()"],
  lockAll: ["rewrite", "app.lockAll()"],
  unlockAll: ["rewrite", "app.unlockAll()"],
  getAppLayout: ["rewrite", "useAppLayout()"],
  getList: ["rewrite", "app.createSessionObject with a list definition"],
  destroySessionObject: ["rewrite", "app.destroySessionObject(id) in an effect cleanup"],
};

const tag = (map, key, fallback) => map[key] ?? fallback;

export const RULES = [
  // ---- extension object shape -------------------------------------------------
  { id: "ext.initialProperties", bucket: "direct", scope: "js", codeOnly: true, re: /\binitialProperties\b/, to: "qae.properties (src/object-properties.js); fold definition defaultValues in" },
  { id: "ext.definition", bucket: "direct", scope: "js", codeOnly: true, re: /(?<![.\w])definition\s*:|^\s*definition\s*,?\s*$/m, to: "ext.definition (src/ext.js); dimensions/measures sections become `data: { uses: 'data' }`" },
  { id: "ext.support", bucket: "direct", scope: "js", codeOnly: true, re: /(?<![.\w])support\s*:|^\s*support\s*,?\s*$/m, to: "ext.support (flags may be functions of layout)" },
  { id: "ext.paint", bucket: "direct", scope: "js", codeOnly: true, re: /(?<![.\w])paint\s*(?::|\(\s*\$?\w*element)|^\s*paint\s*,?\s*$/m, to: "component() + useElement() + useLayout()/useStaleLayout() + useEffect()" },
  { id: "ext.resize", bucket: "direct", scope: "js", codeOnly: true, re: /(?<![.\w])resize\s*(?::|\(\s*\$?\w*element)|^\s*resize\s*,?\s*$/m, to: "useRect() width/height as effect dependencies" },
  { bucket: "direct", scope: "js", re: /(?<![.\w])(mounted|beforeDestroy|updateData)\s*(?::\s*function|\()/, id: (m) => `ext.${m[1]}`, to: "useEffect with a cleanup function (mounted/beforeDestroy); updateData is just a layout effect" },
  { id: "ext.importExportProperties", bucket: "direct", scope: "js", re: /\b(importProperties|exportProperties)\b/, to: "qae.importProperties / qae.exportProperties" },
  { id: "ext.getDropOptions", bucket: "review", scope: "js", re: /\bgetDrop(?:Field|Dimension|Measure)Options\b/, to: "not in the public Extension API reference; check whether it is needed" },
  { id: "ext.clearSelectedValues", bucket: "rewrite", scope: "js", re: /\bclearSelectedValues\b/, to: "no hook; react to ObjectSelections events (canceled/cleared/deactivated)" },
  { id: "dom.$element", bucket: "direct", scope: "js", codeOnly: true, re: /\$element\b/, to: "useElement() returns the raw HTMLElement ($element[0]); wrap with bundled jQuery only as a stage-1 step" },

  // ---- selections / interaction ----------------------------------------------
  { id: "backendApi.selectValues", bucket: "direct", scope: "js", re: /backendApi\s*\.\s*selectValues\b/, to: "see references/selections-and-data.md (instant vs modal)" },
  { id: "ctx.selectValues", bucket: "direct", scope: "js", re: /\b(?:this|self|that|me|_this)\s*\.\s*selectValues\s*\(/, to: "modal: useSelections().begin([path]) + select({ method: 'selectHyperCubeValues', params })" },
  { id: "selection.state", bucket: "direct", scope: "js", re: /\b(selectionsEnabled|selectionMode)\b/, to: "useInteractionState().select; CONFIRM vs QUICK is a design choice (modal vs instant)" },
  { id: "interaction.state", bucket: "direct", scope: "js", re: /\b(interactionState|noInteraction|inEditState)\b/, to: "useInteractionState() ({ passive, active, select, edit }); useConstraints() is deprecated" },
  { id: "app.field.selection", bucket: "rewrite", scope: "js", re: /\.field\s*\([^)]*\)\s*\.\s*(select\w*|toggleSelect|clear|lock|unlock)\b/, to: "(await app.getField(name)).selectValues(...) on useApp()" },
  { id: "snapshot", bucket: "direct", scope: "js", re: /\b(setSnapshotData|canTakeSnapshot|snapshotData)\b/, to: "onTakeSnapshot() + layout.snapshotData + ext.support.snapshot" },
  { id: "export.call", bucket: "host", scope: "js", re: /\b(?:vis|viz|visualization|qviz|chart)\w*\s*\.\s*(exportData|exportImg|exportPdf)\s*\(/i, to: "QVisualization export is not supported in Qlik Cloud (a method of your own that is merely named exportData is fine)" },

  // ---- backendApi.* / qlik.* / app.* ------------------------------------------
  { bucket: "direct", scope: "js", re: /backendApi\s*\.\s*(getData|eachDataRow|getRowCount|getDataRow|getPivotData|getStackData|getReducedData|getDimensionInfos|getMeasureInfos|getProperties|setProperties|applyPatches|clearSelections|hasSelections|search|acceptSearch|abortSearch|selectRange|setCacheOptions|expandLeft|expandTop|collapseLeft|collapseTop|clearSoftPatches|save|isSnapshot)\b/, id: (m) => `backendApi.${m[1]}`, dyn: (m) => tag(BACKEND, m[1], ["review", ""]) },
  { bucket: "direct", scope: "js", re: /\bqlik\s*\.\s*(currApp|openApp|Promise|table|navigation|theme|resize|getGlobal|getAppList|getExtensionList|callRepository|sessionApp|sessionAppFromApp|setOnError|setLanguage|setDeviceType|registerExtension|getThemeList|on|off)\b/, id: (m) => `qlik.${m[1]}`, dyn: (m) => tag(QLIK_ROOT, m[1], ["review", ""]) },
  { bucket: "rewrite", scope: "js", re: /\b(?:app|currApp|qApp)\s*\.\s*(field|variable|getObject|visualization|createCube|createList|createGenericObject|createTable|getObjectProperties|theme|bookmark|selectionState|clearAll|back|forward|lockAll|unlockAll|getAppLayout|getList|destroySessionObject)\b/, id: (m) => `app.${m[1]}`, dyn: (m) => tag(APP, m[1], ["rewrite", ""]) },

  // ---- host-page APIs, frameworks, DOM ---------------------------------------
  { id: "host.window.qlik", bucket: "host", scope: "js", codeOnly: true, re: /\bwindow\s*\.\s*qlik\b/, to: "the qlik global is a host API; use hooks" },
  { id: "host.qvangular", bucket: "host", scope: "js", codeOnly: true, re: /\bqvangular\b/, to: "internal host module; rewrite without AngularJS" },
  { id: "host.autogenerated", bucket: "host", scope: "any", re: /autogenerated\/(?:qix|qvangular|[\w/.-]+)/, to: "internal host module path; use useModel()/useApp()" },
  { id: "host.angular.template", bucket: "host", scope: "js", codeOnly: true, re: /(?<![.\w])template\s*:\s*(?:['"`]|function|\w)/, to: "AngularJS template; rewrite as DOM or React (references/angularjs-rewrite.md)" },
  { id: "host.angular.controller", bucket: "host", scope: "js", codeOnly: true, re: /(?<![.\w])controller\s*:\s*(?:\[|function|['"`])/, to: "AngularJS controller; move logic into component()" },
  { id: "host.angular.scope", bucket: "host", scope: "js", codeOnly: true, re: /\$scope\b|\$rootScope\b|\$timeout\b|\$compile\b|\$digest\b|\$apply\b|\$watch\b|\bangular\s*\.\s*(module|element|injector)\b/, to: "AngularJS runtime; replace with hooks/state" },
  { id: "host.qv-selector", bucket: "host", scope: "js", re: /['"`][^'"`\n]*\.qv-[\w-]+/, to: "internal Sense CSS class; do not select or style host elements" },
  { id: "host.qv-activate", bucket: "host", scope: "js", re: /\bqv-activate\b/, to: "Sense-only event; use click/pointer events" },
  { id: "host.qv-selector", bucket: "host", scope: "css", re: /\.qv-[\w-]+/, to: "internal Sense CSS class; do not style host elements" },
  { id: "host.lui-class", bucket: "host", scope: "any", re: /(?<![\w-])lui-[a-z][\w-]*/, to: "Leonardo UI class provided by the Sense page; write your own CSS under your own prefix (bundling the Leonardo UI stylesheet would also put lui-* selectors in your bundle)" },
  { id: "host.angular.directive", bucket: "host", scope: "html", re: /\bng-[a-z-]+|\bqv-[a-z-]+|\{\{[^}]+\}\}/, to: "AngularJS template syntax; rewrite" },
  { id: "host.global-css", bucket: "host", scope: "js", re: /document\s*\.\s*head\b|appendTo\(\s*['"]head['"]\s*\)|\$\(\s*['"]head['"]\s*\)/, to: "global CSS injection; scope styles to your element" },
  { id: "host.dom-query", bucket: "review", scope: "js", re: /document\s*\.\s*(?:querySelector(?:All)?|getElementById|getElementsBy\w+)\s*\(/, to: "must be scoped to the allocated element; prefer element.querySelector" },
  { id: "host.jquery-global-selector", bucket: "review", scope: "js", re: /\$\(\s*(?:document|window|['"`][#.][^'"`]*['"`])\s*\)/, to: "global jQuery selector; scope to useElement()" },
  { id: "host.enigma-session", bucket: "review", scope: "js", re: /enigma\s*\.\s*create\b|new\s+WebSocket\b/, to: "do not open a second engine session; use useModel()/useApp()" },
  { id: "host.external-url", bucket: "review", scope: "any", re: /['"`](?:https?:)?\/\/[^'"`\s]+\.(?:js|css|woff2?|ttf|otf)(?:\?[^'"`\s]*)?['"`]|\b(?:paths|baseUrl)\s*:\s*\{[^}]*['"`](?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}|<(?:script|img)\b[^>]*\bsrc\s*=\s*['"]?(?:https?:)?\/\/|<link\b[^>]*\bhref\s*=\s*['"]?(?:https?:)?\/\/|\.src\s*=\s*['"`](?:https?:)?\/\/|\b(?:getScript|importScripts|fetch|Worker)\s*\(\s*['"`](?:https?:)?\/\/|\bimport\s*\(\s*['"`](?:https?:)?\/\/|\burl\(\s*['"]?(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/, to: "loads something from another origin at run time (script, style, font, image or request); needs a tenant CSP entry or Qlik Cloud blocks it silently. Bundle it or inline it (references/external-resources.md); a link the user clicks needs no entry" },

  // ---- found while converting real extensions ---------------------------------
  { id: "host.luiDialog", bucket: "host", scope: "js", re: /\bluiDialog\b|\bluiPopover\b|\bluiTooltip\b/, to: "host Leonardo UI service; build the dialog/popover inside your own element (native <dialog> works)" },
  { id: "app.variable.content", bucket: "rewrite", scope: "js", re: /\.\s*(setContent|getContent)\s*\(/, id: (m) => `variable.${m[1]}`, dyn: (m) => ["rewrite", m[1] === "setContent" ? "deprecated capability call; variable.setStringValue / setNumValue on the raw engine variable" : "read the value from the variable's getLayout().qText / qNumber"] },
  { id: "app.create.content", bucket: "rewrite", scope: "js", re: /\.\s*(createDimension|createMeasure|createObject|createSheet|createBookmark)\s*\(/, to: "engine Doc method of the same name (creates persistent app content: confirm that is intended)" },
  { id: "app.sheetlist", bucket: "rewrite", scope: "js", re: /\.\s*getSheetList\s*\(|\.\s*getAppObjectList\s*\(/, to: "not a public engine Doc method; use a session object with qAppObjectListDef { qType: 'sheet' } (references/app-and-navigation.md)" },
  { id: "qlik.config", bucket: "host", scope: "js", re: /\bqlik\s*\.\s*config\b/, to: "host-provided object; derive what you need from the page URL or the raw Doc" },
  { id: "host.app-model", bucket: "review", scope: "js", re: /\bapp\s*\.\s*model\b|\.\s*model\s*\.\s*enigmaModel\b/, to: "undocumented shape of the Sense app wrapper (app.model / app.model.enigmaModel); acceptable only as a guarded fallback in property-panel callbacks, and say so in the report" },
  { id: "host.qlik-identifier", bucket: "host", scope: "js", codeOnly: true, re: /(?<![\w$.-])qlik(?![\w$-])(?!\s*:)/, to: "the qlik object is a host API; use hooks, or derive what you need from the page URL or the raw Doc" },
  { id: "host.dom-outside", bucket: "host", scope: "js", re: /document\s*\.\s*body\s*\.\s*(?:appendChild|append|prepend|insertBefore|insertAdjacentElement|insertAdjacentHTML)\b/, to: "adds DOM outside your own element; keep dialogs, tooltips and download anchors inside the element from useElement()" },
  { id: "host.relative-fetch", bucket: "review", scope: "js", re: /\bfetch\s*\(\s*['"`]\/(?!\/)|XMLHttpRequest\b/, to: "request to a host-relative URL (for example a Sense REST endpoint); not available outside Sense and needs the user's session and permissions, so make it optional and report it" },
  { id: "code.eval", bucket: "review", scope: "js", codeOnly: true, re: /(?<![.\w])eval\s*\(|new\s+Function\s*\(/, to: "generated code; replace with a normal function (it breaks when the bundle is minified; a stricter CSP than Qlik Cloud's default may also block it)" },
  { id: "storage.local", bucket: "review", scope: "js", codeOnly: true, re: /\b(?:localStorage|sessionStorage)\b/, to: "per-browser state: keep it, but namespace the key and handle it being unavailable" },
  { id: "cdn.google-charts", bucket: "review", scope: "js", re: /google\s*\.\s*charts\s*\.\s*load|gstatic\.com|gstatic\.cn|loader\.js/, to: "loads code from a CDN at run time; cannot be bundled from npm; needs a CSP entry or a re-implementation" },
  { id: "dom.html-injection", bucket: "review", scope: "js", codeOnly: true, re: /\.\s*(?:innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML\s*\(|document\s*\.\s*write\w*\s*\(|\.\s*html\s*\(\s*[^)\s]/, to: "HTML built from strings (innerHTML, .html(...)): never put layout/cell data into HTML; use textContent, or sanitize with a bundled library (references/styling-and-assets.md)" },

  // ---- data-model features that need a panel or reading pattern of their own -------------------
  { id: "data.attribute-expressions", bucket: "review", scope: "js", re: /\b(?:qAttributeExpressions|qAttrExps|qAttributeDimensions)\b/, to: "per-row color/label/tooltip expressions: the panel item moves into the data section (references/properties-and-data.md)" },
  { id: "data.calc-condition", bucket: "review", scope: "js", re: /\b(?:qCalcCond|qCalcCondition|calcCond|dataHandling)\b/, to: "calculation condition / data handling section: declare it explicitly (references/properties-and-data.md)" },
  { id: "data.library-or-alternatives", bucket: "review", scope: "js", re: /\b(?:qLibraryId|qLayoutExclude|qFallbackTitle)\b/, to: "master-library items or alternative dimensions/measures: titles come from the library item; test alternatives in your host (references/properties-and-data.md)" },
  { id: "data.alternate-state", bucket: "review", scope: "js", re: /\bqStateName\b|\bqStateNames\b/, to: "alternate states: keep the state argument on Doc.getField (references/app-and-navigation.md)" },

  // ---- libraries --------------------------------------------------------------
  { id: "lib.jquery", bucket: "rewrite", scope: "js", codeOnly: true, re: /\$\s*\(|\bjQuery\b|\$\s*\.\s*(?:ajax|extend|each|Deferred|when|map|grep|proxy)\b/, to: "jQuery from the host is deprecated for extensions; bundle it temporarily or replace with DOM APIs" },
  { id: "lib.underscore", bucket: "rewrite", scope: "js", codeOnly: true, re: /(?<![\w$.])_\s*\.\s*(?:each|map|filter|reduce|find|extend|debounce|throttle|isFunction|isArray|pluck|uniq|sortBy|groupBy|clone|defaults|keys|values|has|contains|without|union|flatten|zip|range)\b\s*\(/, to: "underscore from the host is deprecated; use native methods or bundle lodash-es" },
  { id: "lib.require-config", bucket: "rewrite", scope: "js", re: /\brequire(?:js)?\s*\.\s*config\s*\(/, to: "RequireJS paths become npm dependencies" },
  { id: "lib.require-call", bucket: "rewrite", scope: "js", re: /(?<![.\w])require\s*\(\s*\[/, to: "runtime AMD loading; use static ES imports" },

  // ---- styling / assets -------------------------------------------------------
  { id: "css.less", bucket: "rewrite", scope: "css", onlyExt: ".less", re: /@[\w-]+\s*:\s*[^;]+;|\.[\w-]+\s*\(\s*\)\s*;|@import\s*\(/, to: "LESS is not configured in nebula build; convert to plain CSS (or add a postcss pipeline)" },
  { id: "css.external-import", bucket: "review", scope: "css", re: /@import\s+(?:url\()?['"]?(?:https?:)?\/\//, to: "external stylesheet; bundle it (CSP)" },
];

/** Resolve rule -> { id, bucket, to } for a regex match. */
export function describe(rule, m) {
  const id = typeof rule.id === "function" ? rule.id(m) : rule.id;
  if (rule.dyn) {
    const [bucket, to] = rule.dyn(m);
    return { id, bucket, to };
  }
  return { id, bucket: rule.bucket, to: rule.to };
}

// ---- AMD dependency classification (used by inventory.mjs) ---------------------
export const HOST_AMD_DEPS = [
  /^qlik$/, /^jquery$/, /^underscore$/, /^angular$/, /^qvangular$/, /^general\.utils$/, /^util$/,
  /^translator$/, /^client\.utils\//, /^core\.utils\//, /^objects\./, /^autogenerated\//, /^ng!/, /^qlik-stable/,
  /^jquery\./, /^assets\//,
];

export function classifyAmdDep(dep) {
  if (/^(?:text|css|async|json|domReady|i18n)!/.test(dep)) return "plugin";
  if (/^(?:https?:)?\/\//.test(dep)) return "external-url";
  if (dep.startsWith(".")) return "local";
  if (dep === "module" || dep === "exports" || dep === "require") return "amd-builtin";
  if (HOST_AMD_DEPS.some((re) => re.test(dep))) return "host";
  return "third-party";
}
