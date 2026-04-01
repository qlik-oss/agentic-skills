# D3 Templates — Qlik Embed API Skill

Reusable D3.js templates for custom charts powered by live Qlik hypercube data. All templates assume the persistent reference pattern from [SKILL.md](SKILL.md) is in place (`appDoc`, `sessionObj`, `selObj`, `fieldObj`).

All colors use `var()` references from the design system in [design-reference.md](design-reference.md).

---

## D3 Horizontal Bar Chart — Full Template

```javascript
function drawBarChart(data) {
  const container = document.getElementById('chart-container');
  const loadingEl = document.getElementById('chart-loading');
  if (loadingEl) loadingEl.remove();

  const margin = { top: 16, right: 80, bottom: 40, left: 200 };
  const totalW  = container.clientWidth || 700;
  const totalH  = 360;
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top  - margin.bottom;

  const svg = d3.select('#chart-container')
    .append('svg')
    .attr('id', 'd3-svg')
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('id', 'd3-g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value) * 1.12])
    .range([0, W]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.label))
    .range([0, H])
    .padding(0.28);

  // Gridlines
  g.append('g')
    .attr('class', 'gridlines')
    .selectAll('line')
    .data(x.ticks(5))
    .join('line')
    .attr('stroke', 'color-mix(in srgb, var(--text-primary) 5%, transparent)')
    .attr('stroke-dasharray', '3,3')
    .attr('x1', d => x(d)).attr('x2', d => x(d))
    .attr('y1', 0).attr('y2', H);

  // Bars (animated, wired to Qlik selections)
  const bars = g.selectAll('.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', 0)
    .attr('y', d => y(d.label))
    .attr('height', y.bandwidth())
    .attr('width', 0)
    .attr('rx', 3)
    .attr('fill', d => d.excluded
      ? 'color-mix(in srgb, var(--accent) 18%, transparent)'
      : 'var(--accent)')
    .attr('opacity', d => d.excluded ? 0.3 : (d.selected ? 1 : 0.85))
    .style('cursor', 'pointer')
    .on('click', (event, d) => toggleSelection('YourFieldName', d.label));

  bars.transition().duration(700).delay((d, i) => i * 60)
    .attr('width', d => Math.max(0, x(d.value)));

  // Value labels
  g.selectAll('.val-label')
    .data(data)
    .join('text')
    .attr('class', 'val-label')
    .attr('x', d => x(d.value) + 8)
    .attr('y', d => y(d.label) + y.bandwidth() / 2 + 4)
    .attr('fill', 'var(--text-primary)')
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', '10px')
    .text(d => d3.format(',')(d.value))
    .style('opacity', 0)
    .transition().duration(700).delay((d, i) => i * 60 + 300)
    .style('opacity', 1);

  // Y axis (labels only, no line)
  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(y).tickSize(0).tickPadding(10))
    .call(g => g.select('.domain').remove())
    .selectAll('text')
    .attr('fill', 'var(--text-muted)')
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', '10px');

  // X axis (integer format — NOT scientific notation)
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(',d')))
    .call(g => g.select('.domain').remove())
    .selectAll('text')
    .attr('fill', 'var(--text-muted)')
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', '10px');
}
```

**X-axis format tip:** Use `d3.format(',d')` for plain integers (e.g. `1,000`). Do NOT use `d3.format(',s')` — it produces scientific notation like `1.00000k`.

---

## Reactive Redraw — Update D3 In Place

When `sessionObj.on('changed')` fires, don't destroy and recreate the SVG — update bars and axes in place using D3's join pattern with transitions. This avoids flicker:

```javascript
function redrawD3Chart(data) {
  const svg = d3.select('#d3-svg');
  if (svg.empty()) { drawBarChart(data); return; }  // first render

  const g = d3.select('#d3-g');
  const container = document.getElementById('chart-container');
  const margin = { top: 16, right: 80, bottom: 40, left: 200 };
  const W = (container.clientWidth || 700) - margin.left - margin.right;
  const H = 360 - margin.top - margin.bottom;

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value) * 1.12])
    .range([0, W]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.label))
    .range([0, H])
    .padding(0.28);

  // Update bars
  g.selectAll('.bar')
    .data(data, d => d.label)
    .join('rect')
    .attr('class', 'bar')
    .attr('y', d => y(d.label))
    .attr('height', y.bandwidth())
    .attr('rx', 3)
    .style('cursor', 'pointer')
    .on('click', (event, d) => toggleSelection('YourFieldName', d.label))
    .transition().duration(400)
    .attr('width', d => Math.max(0, x(d.value)))
    .attr('fill', d => d.excluded
      ? 'color-mix(in srgb, var(--accent) 18%, transparent)'
      : 'var(--accent)')
    .attr('opacity', d => d.excluded ? 0.3 : (d.selected ? 1 : 0.85));

  // Update value labels with number animation
  g.selectAll('.val-label')
    .data(data, d => d.label)
    .join('text')
    .attr('class', 'val-label')
    .attr('y', d => y(d.label) + y.bandwidth() / 2 + 4)
    .attr('fill', 'var(--text-primary)')
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', '10px')
    .transition().duration(400)
    .attr('x', d => x(d.value) + 8)
    .tween('text', function(d) {
      const prev  = parseFloat(this.textContent.replace(/,/g, '')) || 0;
      const interp = d3.interpolateNumber(prev, d.value);
      return t => { this.textContent = d3.format(',')(Math.round(interp(t))); };
    });

  // Update Y axis
  g.select('.y-axis')
    .transition().duration(400)
    .call(d3.axisLeft(y).tickSize(0).tickPadding(10))
    .call(g => g.select('.domain').remove())
    .selectAll('text')
    .attr('fill', 'var(--text-muted)')
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', '10px');

  // Update X axis
  g.select('.x-axis')
    .transition().duration(400)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(',d')))
    .call(g => g.select('.domain').remove())
    .selectAll('text')
    .attr('fill', 'var(--text-muted)')
    .attr('font-family', 'DM Mono, monospace')
    .attr('font-size', '10px');
}
```

---

## Selection State Mapping

Map `qState` from the hypercube layout to visual properties:

```javascript
// In fetchData() or getHypercubeData():
.map(row => ({
  label:    row[0].qText,
  value:    row[1].qNum,
  selected: row[0].qState === 'S',
  excluded: row[0].qState === 'X' || row[0].qState === 'XS'
}))
```

| qState | Meaning | Visual treatment |
|---|---|---|
| `'O'` | Optional (no selections active) | Normal — `opacity: 0.85`, accent fill |
| `'S'` | Selected | Full — `opacity: 1`, accent fill |
| `'X'` | Excluded | Dimmed — `opacity: 0.3`, muted accent fill |
| `'XS'` | Excluded by selection | Same as `'X'` |
| `'A'` | Alternative (not selected in an active field) | Slightly dimmed — `opacity: 0.5` |

Apply in D3:
```javascript
.attr('fill', d => d.excluded
  ? 'color-mix(in srgb, var(--accent) 18%, transparent)'
  : 'var(--accent)')
.attr('opacity', d => d.excluded ? 0.3 : (d.selected ? 1 : 0.85))
```

---

## Wiring D3 Clicks to Qlik Selections

Every interactive D3 element must call `toggleSelection(fieldName, value)` from [SKILL.md](SKILL.md). Examples for common chart types:

```javascript
// Bar chart
.on('click', (event, d) => toggleSelection('YourFieldName', d.label))

// Force-directed graph node
.on('click', (event, d) => toggleSelection('ProviderName', d.id))

// Chord diagram arc
.on('click', (event, d) => toggleSelection('Condition', names[d.index]))

// Sunburst segment (multi-depth)
.on('click', (event, d) => {
  if (d.depth === 1) toggleSelection('Category', d.data.name);
  if (d.depth === 2) toggleSelection('SubCategory', d.data.name);
})

// Beeswarm dot
.on('click', (event, d) => toggleSelection('Condition', d.cond))
```

> ⚠️ D3 visuals that zoom/animate locally without calling `toggleSelection()` look interactive but break the Qlik associative model. Users click expecting KPIs and filter panels to update — and nothing happens.

---

## Hover Tooltip Pattern

```javascript
const tooltip = d3.select('body').append('div')
  .attr('class', 'd3-tooltip')
  .style('position', 'absolute')
  .style('pointer-events', 'none')
  .style('opacity', 0)
  .style('background', 'var(--card-bg)')
  .style('border', 'var(--border)')
  .style('border-radius', '8px')
  .style('padding', '8px 12px')
  .style('font-family', 'DM Mono, monospace')
  .style('font-size', '11px')
  .style('color', 'var(--text-primary)')
  .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
  .style('z-index', '10000');

bars
  .on('mouseenter', (event, d) => {
    tooltip
      .html(`<strong>${d.label}</strong><br/>${d3.format(',')(d.value)}`)
      .style('opacity', 1)
      .style('left', (event.pageX + 12) + 'px')
      .style('top', (event.pageY - 20) + 'px');
  })
  .on('mousemove', (event) => {
    tooltip
      .style('left', (event.pageX + 12) + 'px')
      .style('top', (event.pageY - 20) + 'px');
  })
  .on('mouseleave', () => {
    tooltip.style('opacity', 0);
  });
```

---

## Container HTML Pattern

```html
<div class="card chart-size">
  <div class="card-header">Chart Title</div>
  <div id="chart-container" style="position:relative; width:100%; height:100%;">
    <div id="chart-loading" style="
      display:flex; align-items:center; justify-content:center;
      height:100%; font-family:'DM Mono',monospace; font-size:11px;
      color:var(--text-muted);">
      Loading chart data…
    </div>
  </div>
</div>
```

The loading placeholder is removed by `drawBarChart()` on first render. If data fetch fails, `showError()` replaces it with an error message (see error handling in SKILL.md).
