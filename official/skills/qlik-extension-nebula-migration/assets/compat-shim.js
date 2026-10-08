// STAGE 1 ONLY. Delete this file in stage 2.
//
// Lets legacy `paint($element, layout)` code run inside a nebula `component()` unchanged, so you can
// get a first working build before refactoring. It adapts the small slice of the Extension API
// context (`this`) that extension code usually touches, using only stardust hook results.
//
// It does NOT provide, and must never be extended to provide, anything from the Sense client page:
// no `qlik` object, no `$scope`, no AngularJS, no `qvangular`, no host jQuery. Code that needs
// those has to be rewritten (references/angularjs-rewrite.md, references/host-isolation.md).
//
// Usage in src/index.js (hooks are called inside component(), the shim is plain data/functions):
//
//   import { useElement, useStaleLayout, useModel, useSelections, useInteractionState, useEffect } from '@nebula.js/stardust';
//   import { createLegacyContext } from './compat-shim';
//   import legacyPaint from './legacy-paint';   // the old paint($element, layout), moved over verbatim
//
//   component() {
//     const element = useElement();
//     const layout = useStaleLayout();
//     const model = useModel();
//     const selections = useSelections();
//     const interaction = useInteractionState();
//     useEffect(() => {
//       const ctx = createLegacyContext({ layout, model, selections, interaction });
//       legacyPaint.call(ctx, element, layout);     // old code expects `this` to be the context
//     }, [element, layout, model, selections, interaction]);
//   }
//
// If the old code used jQuery on $element, bundle jQuery (npm dependency) and pass `$(element)` as the
// first argument. That is an interim step; remove it in stage 2.

const PATH = '/qHyperCubeDef';
const unsupported = (name) => () => {
  throw new Error(`compat-shim: ${name} has no nebula equivalent; rewrite this call (see references/api-mapping.md)`);
};

/**
 * @param {object} p
 * @param {object} p.layout        result of useLayout()/useStaleLayout()
 * @param {object} p.model         result of useModel() (GenericObject)
 * @param {object} p.selections    result of useSelections() (ObjectSelections)
 * @param {object} [p.interaction] result of useInteractionState() ({ passive, active, select, edit })
 * @param {string} [p.path]        data path; defaults to '/qHyperCubeDef'
 */
export function createLegacyContext({ layout, model, selections, interaction = {}, path = PATH }) {
  const cube = () => layout?.qHyperCube ?? {};
  const pages = () => cube().qDataPages ?? [];

  const instantSelect = (dim, values, toggle) => model.selectHyperCubeValues(path, dim, values, !!toggle);

  // Modal selection: the old `this.selectValues` showed the confirm/cancel toolbar.
  const modalSelect = async (dim, values, toggle) => {
    if (!selections.isActive()) await selections.begin([path]);
    return selections.select({ method: 'selectHyperCubeValues', params: [path, dim, values, !!toggle] });
  };

  const backendApi = {
    // instant selection (applies immediately)
    selectValues: instantSelect,
    // pages beyond the initial fetch
    getData: (qPages) => model.getHyperCubeData(path, qPages),
    getRowCount: () => cube().qSize?.qcy ?? 0,
    getDimensionInfos: () => cube().qDimensionInfo ?? [],
    getMeasureInfos: () => cube().qMeasureInfo ?? [],
    // iterates only the rows already in the layout; page more data with getData() first
    eachDataRow: (cb) => {
      pages().forEach((page) => (page.qMatrix ?? []).forEach((row, i) => cb(page.qArea.qTop + i, row)));
    },
    getDataRow: (n) => {
      for (const page of pages()) {
        const i = n - page.qArea.qTop;
        if (i >= 0 && i < (page.qMatrix?.length ?? 0)) return page.qMatrix[i];
      }
      return undefined;
    },
    getProperties: () => model.getProperties(),
    setProperties: (props) => model.setProperties(props),
    applyPatches: (patches, soft) => model.applyPatches(patches, !!soft),
    clearSelections: () => selections.clear(),
    hasSelections: () => !!layout?.qSelectionInfo?.qInSelections || selections.isActive(),
    isSnapshot: () => !!layout?.snapshotData,
    // Not available as hooks. Replace these call sites in stage 2.
    search: unsupported('backendApi.search'),
    acceptSearch: unsupported('backendApi.acceptSearch'),
    abortSearch: unsupported('backendApi.abortSearch'),
    setCacheOptions: () => {},
  };

  return {
    backendApi,
    selectValues: modalSelect,
    // `selectionMode` CONFIRM vs QUICK is a design decision in nebula (modal vs instant); see references/selections-and-data.md
    selectionsEnabled: interaction.select !== false && interaction.active !== false,
    options: { noInteraction: interaction.active === false },
    inEditState: () => interaction.edit === true,
    // Present so `this.$scope` access fails loudly instead of silently returning undefined.
    get $scope() {
      throw new Error('compat-shim: $scope is AngularJS from the host page and is not available; rewrite this code');
    },
  };
}
