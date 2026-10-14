# Rewriting AngularJS extensions

nebula.js has no `template`, `controller` or `$scope`, and this skill does not allow any use of the AngularJS that the Sense page provides. An extension with `host.angular.*` hits in the inventory needs a renderer rewrite, not a port. Plan it as the biggest work item.

qlik.dev: AngularJS 1.8 long-term support ended on 2021-12-12 (qlik.dev) and help.qlik.com says Qlik continues to support AngularJS in Qlik Sense Enterprise Client-Managed. The two sources give different end-of-support dates; do not cite either as a hard deadline for Qlik Cloud.

## Approach

1. **Read the template and controller together** and list: bound data, derived values, user events, watchers, and anything calling a service.
2. **Choose the renderer**: plain DOM (default, smallest) or React (`react-renderer.md`). Pick React when the template has substantial nested conditional markup.
3. **Move state to hooks**; the template becomes a render function.
4. Keep the legacy CSS class names only if you scope them; otherwise rename to a unique prefix (`styling-and-assets.md`).

## Mapping

| AngularJS | nebula.js |
|---|---|
| `template: '<div ng-repeat="r in rows">...'` | A render function that builds elements from the layout (`render.js` in `worked-example.md`), or JSX |
| `ng-repeat` over `qlik.table(this).rows` | Loop over `layout.qHyperCube.qDataPages[*].qMatrix`; headers from `qDimensionInfo` / `qMeasureInfo` |
| `ng-click`, `ng-change` | `addEventListener` created in the effect (remove it on cleanup), or React handlers |
| `ng-if`, `ng-show`, `ng-class` | Create/skip elements, toggle `hidden` / `classList` |
| `{{ value }}` | `textContent = value` (never `innerHTML` with data) |
| Filters (`\| number`, `\| date`) | `Intl.NumberFormat` / `Intl.DateTimeFormat` with `useAppLayout().qLocaleInfo`, or use the cell's `qText` |
| `$scope.$watch(expr, fn)` | `useEffect(fn, [expr])` |
| `$scope.layout` | `useLayout()` / `useStaleLayout()` |
| `$scope.options.interactionState` | `useInteractionState()` |
| `$scope.component.model` and its `Validated/Invalidated/Aborted/Cancelled/Closed` events | `useModel()`; `selections.addListener('deactivated' \| 'cleared', fn)` |
| `$scope.selectionsApi` | `useSelections()` |
| `$scope.backendApi` | `useModel()`; see `selections-and-data.md` |
| `$timeout`, `$interval` | `setTimeout`, `setInterval` inside `useEffect` with cleanup |
| `$scope.$apply()` / `$digest` | Not needed |
| `$q` | native `Promise` |
| `qlik.table(this)` | No equivalent; build the table model yourself |
| `ng-bind-html` / `$sce` | Do not render untrusted HTML. Build elements, or sanitize with a bundled library |
| Custom property-panel component with `template`/`controller` | Built-in component or move the feature into the chart (`host-isolation.md`) |
| `qv-extension` directive on the template root | Not needed |

## Sequence

1. Write the render function against a fixture layout (copy a real `layout` JSON from the legacy chart) so it can be tested without Sense.
2. Wire it into `component()` with `useEffect` and `useStaleLayout`.
3. Re-attach interactions (selections, clicks) one at a time, comparing with the legacy chart.
4. Delete the AngularJS template, controller and the `ng-*` attributes last.

Accessibility and keyboard behavior in AngularJS templates (tabindex, aria attributes) are easy to lose; check them in the inventory of the template and keep them (`useKeyboard()` can help).
