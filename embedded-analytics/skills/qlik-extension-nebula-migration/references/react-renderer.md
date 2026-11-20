# Optional: React renderer

Offer React when the legacy template has deeply nested or heavily conditional markup (typical for AngularJS templates), or when the user already writes React. Plain DOM remains the default: it is smaller and has no run-time dependency. Ask once; do not switch silently.

React here is **your own bundled copy**. Never rely on a React, MUI or other UI framework that the Sense page or the embedding page happens to load (`host-isolation.md`).

## Setup

```bash
npm install react react-dom
```

- Put them in `dependencies`, **not** `peerDependencies`. `nebula build` treats every peer dependency as external and does not bundle it; only `@nebula.js/stardust` should be a peer dependency.
- `nebula build` compiles JSX (`@babel/preset-react`); use `.jsx` files or JSX in `.js`. nebula.js-examples has a working `react-table-chart`.
- Expect a larger bundle (React + ReactDOM). Check `check-package.mjs` output for the zipped size.

## Wiring

Keep hooks in `component()` and pass plain values to React:

```jsx
// src/index.js
import { createRoot } from 'react-dom/client';
import { useElement, useStaleLayout, useSelections, useInteractionState, useEffect, useState } from '@nebula.js/stardust';
import App from './App';

export default function supernova(galaxy) {
  return {
    qae: { properties, data },
    ext: ext(galaxy),
    component() {
      const element = useElement();
      const layout = useStaleLayout();
      const selections = useSelections();
      const interactions = useInteractionState();
      const [root, setRoot] = useState(null);

      useEffect(() => {
        const r = createRoot(element);
        setRoot(r);
        return () => r.unmount();                  // always unmount
      }, [element]);

      useEffect(() => {
        if (!root || !layout) return;
        root.render(<App layout={layout} selections={selections} interactions={interactions} />);
      }, [root, layout, selections, interactions]);
    },
  };
}
```

## Rules

- **Do not call stardust hooks inside React components.** They only work in `component()`. Pass data and callbacks down as props.
- Selections: the handler passed to React calls `selections.begin([path])` and `selections.select({...})` exactly as in `selections-and-data.md`. Keep highlight state in React state and reset it from the `deactivated` / `cleared` listeners.
- `createRoot` on `useElement()`: use one root per element and unmount in the cleanup.
- CSS: same rules as `styling-and-assets.md`; prefix class names or use CSS modules.
- Do not use `dangerouslySetInnerHTML` with data from the layout.
- If you choose TypeScript, `nebula create --typescript` generates a TS scaffold.
- Run `check-no-host-apis.mjs` as usual. React imports are fine because they are declared dependencies; an undeclared `import 'react'` fails the check.

## When not to use it

Small charts that only draw a few elements, or charts drawing with canvas/SVG libraries such as d3 or picasso.js, gain nothing from React.
