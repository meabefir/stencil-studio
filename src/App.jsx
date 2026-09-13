import { useEffect, useId, useMemo, useRef, useState } from "react";

const PAPER_SIZES = [
  { id: "a3", label: "A3", width: 297, height: 420 },
  { id: "a4", label: "A4", width: 210, height: 297 },
  { id: "a5", label: "A5", width: 148, height: 210 },
  { id: "a6", label: "A6", width: 105, height: 148 },
  { id: "letter", label: "US Letter", width: 215.9, height: 279.4 },
  { id: "legal", label: "US Legal", width: 215.9, height: 355.6 },
];

const ELEMENT_TYPES = [
  { id: "line", label: "Straight lines", symbol: "—" },
  { id: "circle", label: "Circles", symbol: "○" },
  { id: "oval", label: "Ovals", symbol: "⬭" },
  { id: "wave", label: "Waves", symbol: "∿" },
  { id: "square", label: "Squares", symbol: "□" },
  { id: "polygon", label: "Polygons", symbol: "⬡" },
  { id: "heart", label: "Hearts", symbol: "♥" },
  { id: "star", label: "Stars", symbol: "★" },
];

const TYPE_DEFAULTS = {
  line: { length: 28 },
  circle: { radius: 9, arcAngle: 360, layers: 2, innerThickness: 0.45, layerGap: 2.2 },
  oval: { radius: 8, stretch: 1.65, arcAngle: 360, layers: 2, innerThickness: 0.45, layerGap: 2 },
  wave: { length: 36, amplitude: 4.5, frequency: 2 },
  square: { side: 17 },
  polygon: { radius: 10, sides: 6 },
  heart: { size: 20 },
  star: { radius: 10, points: 5, innerRatio: 0.44 },
};

const COMMON_DEFAULTS = {
  thickness: 0.65,
  strokeStyle: "solid",
  spacing: 7,
  overlapOffset: 0,
  rotation: 0,
  rotationOffset: 0,
};

const DEFAULT_PAGE = { paperId: "a4", orientation: "portrait", margin: 12, spaceVertical: true, rowGap: 0 };
const PRESET_FORMAT = "stencil-studio-preset";
const PRESET_VERSION = 1;
const STORAGE_KEYS = {
  workspace: "stencil-studio.workspace.v1",
  presets: "stencil-studio.presets.v1",
};

const initialRows = [
  { id: "line-1", type: "line", ...COMMON_DEFAULTS, ...TYPE_DEFAULTS.line, rotationOffset: 8 },
  { id: "circle-1", type: "circle", ...COMMON_DEFAULTS, ...TYPE_DEFAULTS.circle },
  { id: "wave-1", type: "wave", ...COMMON_DEFAULTS, ...TYPE_DEFAULTS.wave, frequency: 2.5 },
  { id: "star-1", type: "star", ...COMMON_DEFAULTS, ...TYPE_DEFAULTS.star, rotation: -90, rotationOffset: 10 },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRow(type = "line", overrides = {}) {
  const safeType = TYPE_DEFAULTS[type] ? type : "line";
  return {
    id: makeId(),
    type: safeType,
    ...COMMON_DEFAULTS,
    ...TYPE_DEFAULTS[safeType],
    ...overrides,
  };
}

function normalizeRow(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const type = TYPE_DEFAULTS[safeInput.type] ? safeInput.type : "line";
  const row = createRow(type);
  const limits = {
    thickness: [0.2, 3],
    spacing: [1, 30],
    overlapOffset: [-30, 30],
    rotation: [-180, 180],
    rotationOffset: [-90, 90],
    length: [1, 200],
    radius: [1, 100],
    arcAngle: [1, 360],
    layers: [1, 12],
    innerThickness: [0.1, 5],
    layerGap: [0.1, 50],
    stretch: [0.1, 10],
    amplitude: [0.1, 100],
    frequency: [0.1, 20],
    side: [1, 200],
    sides: [3, 24],
    size: [1, 200],
    points: [3, 24],
    innerRatio: [0.05, 0.95],
  };

  Object.entries(limits).forEach(([key, [min, max]]) => {
    if (Number.isFinite(safeInput[key])) row[key] = clamp(safeInput[key], min, max);
  });
  ["layers", "sides", "points"].forEach((key) => {
    if (Number.isFinite(row[key])) row[key] = Math.round(row[key]);
  });
  if (["solid", "dashed", "dotted"].includes(safeInput.strokeStyle)) row.strokeStyle = safeInput.strokeStyle;
  if (typeof safeInput.id === "string" && safeInput.id.length > 0) row.id = safeInput.id;
  return row;
}

function makePreset(name, page, rows, dpi) {
  return {
    format: PRESET_FORMAT,
    version: PRESET_VERSION,
    name: String(name || "Untitled preset").trim().slice(0, 60) || "Untitled preset",
    savedAt: new Date().toISOString(),
    page: { ...page },
    rows: rows.map((row) => ({ ...row })),
    dpi,
  };
}

function normalizePreset(input) {
  if (!input || typeof input !== "object" || input.format !== PRESET_FORMAT || input.version !== PRESET_VERSION) {
    throw new Error("This is not a Stencil Studio preset.");
  }
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 100) {
    throw new Error("The preset must contain between 1 and 100 rows.");
  }

  const sourcePage = input.page && typeof input.page === "object" ? input.page : {};
  const page = {
    paperId: PAPER_SIZES.some((paper) => paper.id === sourcePage.paperId) ? sourcePage.paperId : DEFAULT_PAGE.paperId,
    orientation: ["portrait", "landscape"].includes(sourcePage.orientation) ? sourcePage.orientation : DEFAULT_PAGE.orientation,
    margin: Number.isFinite(sourcePage.margin) ? clamp(sourcePage.margin, 5, 30) : DEFAULT_PAGE.margin,
    spaceVertical: sourcePage.spaceVertical !== false,
    rowGap: Number.isFinite(sourcePage.rowGap) ? clamp(sourcePage.rowGap, 0, 50) : DEFAULT_PAGE.rowGap,
  };

  return {
    format: PRESET_FORMAT,
    version: PRESET_VERSION,
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 60) : "Imported preset",
    savedAt: typeof input.savedAt === "string" ? input.savedAt : new Date().toISOString(),
    page,
    rows: input.rows.map(normalizeRow),
    dpi: [150, 300, 600].includes(Number(input.dpi)) ? Number(input.dpi) : 300,
  };
}

function readStoredWorkspace() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.workspace);
    return raw ? normalizePreset(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function readStoredPresets() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.presets) || "[]");
    return Array.isArray(raw) ? raw.flatMap((item) => {
      try {
        return [normalizePreset(item)];
      } catch {
        return [];
      }
    }) : [];
  } catch {
    return [];
  }
}

function paperDimensions(page) {
  const paper = PAPER_SIZES.find((item) => item.id === page.paperId) ?? PAPER_SIZES[1];
  return page.orientation === "portrait"
    ? { width: paper.width, height: paper.height, label: paper.label }
    : { width: paper.height, height: paper.width, label: paper.label };
}

function elementWidth(row) {
  switch (row.type) {
    case "line":
    case "wave":
      return row.length;
    case "circle":
      return row.radius * 2;
    case "oval":
      return row.radius * 2 * row.stretch;
    case "square":
      return row.side;
    case "polygon":
    case "star":
      return row.radius * 2;
    case "heart":
      return row.size;
    default:
      return 20;
  }
}

function elementHeight(row) {
  switch (row.type) {
    case "line":
      return row.thickness;
    case "circle":
      return row.radius * 2;
    case "oval":
      return row.radius * 2;
    case "wave":
      return row.amplitude * 2;
    case "square":
      return row.side;
    case "polygon":
    case "star":
      return row.radius * 2;
    case "heart":
      return row.size * 0.88;
    default:
      return 20;
  }
}

function horizontalFootprint(row) {
  const width = elementWidth(row);
  const height = elementHeight(row);
  if (["circle", "polygon", "star"].includes(row.type)) return Math.max(width, height) + row.thickness;
  let widest = 0;
  for (let index = 0; index < 48; index += 1) {
    const angle = ((row.rotation + row.rotationOffset * index) * Math.PI) / 180;
    const projectedWidth = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
    widest = Math.max(widest, projectedWidth);
  }
  return widest + row.thickness;
}

function verticalFootprint(row, count) {
  const width = elementWidth(row);
  const height = elementHeight(row);
  if (["circle", "polygon", "star"].includes(row.type)) return Math.max(width, height) + row.thickness;
  let tallest = 0;
  for (let index = 0; index < Math.max(1, count); index += 1) {
    const angle = ((row.rotation + row.rotationOffset * index) * Math.PI) / 180;
    const projectedHeight = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
    tallest = Math.max(tallest, projectedHeight);
  }
  return tallest + row.thickness;
}

function repeatCount(row, availableWidth) {
  const shapeWidth = horizontalFootprint(row);
  return clamp(Math.floor((availableWidth + row.spacing) / (shapeWidth + row.spacing)), 1, 48);
}

function typeMeta(type) {
  return ELEMENT_TYPES.find((item) => item.id === type) ?? ELEMENT_TYPES[0];
}

function strokeProps(row, width = row.thickness) {
  const dash = row.strokeStyle === "dashed"
    ? `${width * 5} ${width * 3}`
    : row.strokeStyle === "dotted"
      ? `0 ${width * 3.3}`
      : undefined;

  return {
    fill: "none",
    stroke: "#111216",
    strokeWidth: width,
    strokeDasharray: dash,
    strokeLinecap: row.strokeStyle === "dotted" ? "round" : "butt",
    strokeLinejoin: "round",
  };
}

function arcPath(rx, ry, angle) {
  const safeAngle = clamp(angle, 1, 359.8);
  const start = -90 - safeAngle / 2;
  const end = -90 + safeAngle / 2;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const startPoint = [Math.cos(radians(start)) * rx, Math.sin(radians(start)) * ry];
  const endPoint = [Math.cos(radians(end)) * rx, Math.sin(radians(end)) * ry];
  const largeArc = safeAngle > 180 ? 1 : 0;
  return `M ${startPoint[0]} ${startPoint[1]} A ${rx} ${ry} 0 ${largeArc} 1 ${endPoint[0]} ${endPoint[1]}`;
}

function regularPolygonPoints(sides, outerRadius, innerRadius = null) {
  const total = innerRadius === null ? sides : sides * 2;
  return Array.from({ length: total }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
    const radius = innerRadius === null || index % 2 === 0 ? outerRadius : innerRadius;
    return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
  }).join(" ");
}

function wavePath(length, amplitude, frequency) {
  const samples = 80;
  return Array.from({ length: samples + 1 }, (_, index) => {
    const progress = index / samples;
    const x = -length / 2 + progress * length;
    const y = -Math.sin(progress * Math.PI * 2 * frequency) * amplitude;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(3)} ${y.toFixed(3)}`;
  }).join(" ");
}

function LayeredArc({ row, oval = false }) {
  return Array.from({ length: row.layers }, (_, index) => {
    const layerRadius = row.radius - row.layerGap * index;
    if (layerRadius <= 0.7) return null;
    const rx = oval ? layerRadius * row.stretch : layerRadius;
    const ry = layerRadius;
    const props = strokeProps(row, index === 0 ? row.thickness : row.innerThickness);
    if (row.arcAngle >= 359.8) {
      return oval
        ? <ellipse key={index} cx="0" cy="0" rx={rx} ry={ry} {...props} />
        : <circle key={index} cx="0" cy="0" r={layerRadius} {...props} />;
    }
    return <path key={index} d={arcPath(rx, ry, row.arcAngle)} {...props} />;
  });
}

function ElementShape({ row, index, x, y }) {
  const rotation = row.rotation + row.rotationOffset * index;
  const props = strokeProps(row);
  let shape = null;

  switch (row.type) {
    case "line":
      shape = <line x1={-row.length / 2} y1="0" x2={row.length / 2} y2="0" {...props} />;
      break;
    case "circle":
      shape = <LayeredArc row={row} />;
      break;
    case "oval":
      shape = <LayeredArc row={row} oval />;
      break;
    case "wave":
      shape = <path d={wavePath(row.length, row.amplitude, row.frequency)} {...props} />;
      break;
    case "square":
      shape = <rect x={-row.side / 2} y={-row.side / 2} width={row.side} height={row.side} {...props} />;
      break;
    case "polygon":
      shape = <polygon points={regularPolygonPoints(row.sides, row.radius)} {...props} />;
      break;
    case "heart": {
      const scale = row.size / 24;
      shape = (
        <path
          d="M 0 10 C -3 6 -12 1 -12 -5 C -12 -11 -4 -14 0 -8 C 4 -14 12 -11 12 -5 C 12 1 3 6 0 10 Z"
          transform={`scale(${scale})`}
          vectorEffect="non-scaling-stroke"
          {...props}
        />
      );
      break;
    }
    case "star":
      shape = <polygon points={regularPolygonPoints(row.points, row.radius, row.radius * row.innerRatio)} {...props} />;
      break;
    default:
      shape = null;
  }

  return <g transform={`translate(${x} ${y}) rotate(${rotation})`}>{shape}</g>;
}

function SheetPreview({ page, rows, svgRef }) {
  const { width, height, label } = paperDimensions(page);
  const innerWidth = width - page.margin * 2;
  const innerHeight = height - page.margin * 2;
  const manualRowGap = Number.isFinite(page.rowGap) ? page.rowGap : DEFAULT_PAGE.rowGap;
  const layouts = rows.map((row) => {
    const count = repeatCount(row, innerWidth);
    return { row, count, height: verticalFootprint(row, count) };
  });
  const occupiedHeight = layouts.reduce((total, layout) => total + layout.height, 0);
  const verticalGap = page.spaceVertical
    ? Math.max(0, (innerHeight - occupiedHeight) / (rows.length + 1))
    : manualRowGap;
  let verticalCursor = page.margin + (page.spaceVertical ? verticalGap : 0);
  layouts.forEach((layout) => {
    layout.y = verticalCursor + layout.height / 2;
    verticalCursor += layout.height + verticalGap;
  });

  return (
    <svg
      ref={svgRef}
      className="paper"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby="sheet-title sheet-description"
    >
      <title id="sheet-title">{label} tattoo stencil practice sheet</title>
      <desc id="sheet-description">{rows.length} rows of evenly repeated line-work elements.</desc>
      <rect width={width} height={height} fill="#ffffff" />
      <rect
        className="preview-guide"
        x={page.margin}
        y={page.margin}
        width={innerWidth}
        height={innerHeight}
        fill="none"
      />
      {layouts.map(({ row, count, y }) => {
        const shapeWidth = Math.min(horizontalFootprint(row), innerWidth);
        const firstX = count === 1 ? width / 2 : page.margin + shapeWidth / 2;
        const lastX = count === 1 ? width / 2 : width - page.margin - shapeWidth / 2;

        return (
          <g key={row.id} data-row-type={row.type} data-row-y={y}>
            {Array.from({ length: count }, (_, index) => {
              const baseX = count === 1 ? firstX : firstX + (lastX - firstX) * (index / (count - 1));
              const x = baseX + row.overlapOffset * (index - (count - 1) / 2);
              return <ElementShape key={index} row={row} index={index} x={x} y={y} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function RangeField({ label, value, unit = "", min, max, step = 1, onChange }) {
  return (
    <label className="range-field">
      <span className="field-label"><span>{label}</span><output>{value}{unit}</output></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function NumberField({ label, value, unit = "", min, max, step = 1, onChange }) {
  const inputId = useId();
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [usesCoarsePointer, setUsesCoarsePointer] = useState(() => (
    typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches
  ));
  const dragRef = useRef(null);

  useEffect(() => {
    const query = window.matchMedia?.("(pointer: coarse)");
    if (!query) return undefined;
    const updatePointerMode = () => setUsesCoarsePointer(query.matches);
    updatePointerMode();
    query.addEventListener("change", updatePointerMode);
    return () => query.removeEventListener("change", updatePointerMode);
  }, []);

  const startAdjust = (event) => {
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startValue: value };
    setIsAdjusting(true);
  };

  const moveAdjust = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const raw = drag.startValue + ((drag.startY - event.clientY) / 12) * step;
    const decimals = Math.max(0, (String(step).split(".")[1] || "").length);
    const stepped = Math.round(raw / step) * step;
    onChange(clamp(Number(stepped.toFixed(decimals)), min, max));
  };

  const stopAdjust = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setIsAdjusting(false);
  };

  return (
    <div className="number-field">
      <span className="number-field-label"><label htmlFor={inputId}>{label}</label><small aria-hidden="true">drag ↕</small></span>
      <span className={`number-input-wrap ${isAdjusting ? "adjusting" : ""}`}>
        <input
          id={inputId}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          readOnly={usesCoarsePointer}
          inputMode={usesCoarsePointer ? "none" : "decimal"}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(clamp(next, min, max));
          }}
          title={usesCoarsePointer ? "Use the adjacent adjust button: drag up to increase or down to decrease." : "Type a value, or use the adjacent adjust button."}
        />
        {unit && <em>{unit}</em>}
        <button
          type="button"
          className="adjust-button"
          aria-label={`Adjust ${label}${unit ? ` in ${unit}` : ""}. Drag up to increase or down to decrease.`}
          title="Drag up to increase. Drag down to decrease."
          onPointerDown={startAdjust}
          onPointerMove={moveAdjust}
          onPointerUp={stopAdjust}
          onPointerCancel={stopAdjust}
        >
          <span aria-hidden="true">↕</span>
        </button>
        <span className="adjust-hint" aria-hidden="true">Slide up to increase</span>
      </span>
    </div>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function ShapeControls({ row, update }) {
  switch (row.type) {
    case "line":
      return <RangeField label="Line length" value={row.length} unit=" mm" min={6} max={90} onChange={(length) => update({ length })} />;
    case "circle":
    case "oval":
      return (
        <>
          <RangeField label="Outer radius" value={row.radius} unit=" mm" min={3} max={30} step={0.5} onChange={(radius) => update({ radius })} />
          {row.type === "oval" && <RangeField label="Width ratio" value={row.stretch} unit="×" min={0.6} max={2.5} step={0.05} onChange={(stretch) => update({ stretch })} />}
          <RangeField label="Arc angle" value={row.arcAngle} unit="°" min={15} max={360} step={5} onChange={(arcAngle) => update({ arcAngle })} />
          <RangeField label="Circle layers" value={row.layers} min={1} max={6} onChange={(layers) => update({ layers })} />
          {row.layers > 1 && (
            <div className="two-column">
              <NumberField label="Layer gap" value={row.layerGap} unit="mm" min={0.5} max={8} step={0.1} onChange={(layerGap) => update({ layerGap })} />
              <NumberField label="Inner stroke" value={row.innerThickness} unit="mm" min={0.2} max={2.5} step={0.05} onChange={(innerThickness) => update({ innerThickness })} />
            </div>
          )}
        </>
      );
    case "wave":
      return (
        <>
          <RangeField label="Pattern length" value={row.length} unit=" mm" min={18} max={90} onChange={(length) => update({ length })} />
          <RangeField label="Amplitude" value={row.amplitude} unit=" mm" min={1} max={18} step={0.5} onChange={(amplitude) => update({ amplitude })} />
          <RangeField label="Frequency" value={row.frequency} unit=" cycles" min={0.5} max={6} step={0.25} onChange={(frequency) => update({ frequency })} />
        </>
      );
    case "square":
      return <RangeField label="Side length" value={row.side} unit=" mm" min={5} max={50} onChange={(side) => update({ side })} />;
    case "polygon":
      return (
        <>
          <RangeField label="Outer radius" value={row.radius} unit=" mm" min={3} max={28} step={0.5} onChange={(radius) => update({ radius })} />
          <RangeField label="Polygon sides" value={row.sides} min={3} max={12} onChange={(sides) => update({ sides })} />
        </>
      );
    case "heart":
      return <RangeField label="Heart width" value={row.size} unit=" mm" min={6} max={50} onChange={(size) => update({ size })} />;
    case "star":
      return (
        <>
          <RangeField label="Outer radius" value={row.radius} unit=" mm" min={3} max={28} step={0.5} onChange={(radius) => update({ radius })} />
          <RangeField label="Star points" value={row.points} min={3} max={12} onChange={(points) => update({ points })} />
          <RangeField label="Inner radius" value={Math.round(row.innerRatio * 100)} unit="%" min={20} max={80} step={2} onChange={(value) => update({ innerRatio: value / 100 })} />
        </>
      );
    default:
      return null;
  }
}

function SwitchField({ label, description, checked, onChange }) {
  return (
    <label className="switch-field">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-track" aria-hidden="true"><span /></span>
    </label>
  );
}

function PresetDialog({ open, name, setName, presets, onClose, onSave, onDownload, onLoad, onImport }) {
  const fileInputRef = useRef(null);
  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="preset-dialog" role="dialog" aria-modal="true" aria-labelledby="preset-title">
        <header className="dialog-header">
          <div><span className="dialog-kicker">Local workspace</span><h2 id="preset-title">Save or load a preset</h2></div>
          <button type="button" className="dialog-close" aria-label="Close presets" onClick={onClose}>×</button>
        </header>
        <p className="dialog-copy">Your current sheet is auto-saved in this browser. Named presets and downloaded JSON files use the same format.</p>

        <div className="preset-save-panel">
          <label className="preset-name-field">
            <span>Preset name</span>
            <input autoFocus type="text" maxLength="60" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="dialog-actions">
            <button type="button" className="dialog-button primary" disabled={!name.trim()} onClick={onSave}>Save in browser</button>
            <button type="button" className="dialog-button" disabled={!name.trim()} onClick={onDownload}>Download JSON</button>
          </div>
        </div>

        <div className="preset-library-heading">
          <div><h3>Saved in this browser</h3><small>{presets.length} preset{presets.length === 1 ? "" : "s"}</small></div>
          <button type="button" className="dialog-button compact" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await onImport(file);
              event.target.value = "";
            }}
          />
        </div>

        <div className="preset-list">
          {presets.length === 0 ? (
            <div className="preset-empty"><strong>No named presets yet</strong><span>Save the current sheet above, or import a JSON preset.</span></div>
          ) : presets.map((preset) => (
            <button key={`${preset.name}-${preset.savedAt}`} type="button" className="preset-item" onClick={() => onLoad(preset)}>
              <span><strong>{preset.name}</strong><small>{preset.rows.length} rows · {paperDimensions(preset.page).label} · {preset.page.orientation}</small></span>
              <span className="preset-date">{new Date(preset.savedAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [restoredWorkspace] = useState(() => readStoredWorkspace());
  const startingRows = restoredWorkspace?.rows ?? initialRows;
  const [page, setPage] = useState(restoredWorkspace?.page ?? DEFAULT_PAGE);
  const [rows, setRows] = useState(startingRows);
  const [selectedId, setSelectedId] = useState(startingRows[0].id);
  const [draggedId, setDraggedId] = useState(null);
  const [dpi, setDpi] = useState(restoredWorkspace?.dpi ?? 300);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("My stencil");
  const [presets, setPresets] = useState(() => readStoredPresets());
  const svgRef = useRef(null);
  const appStateRef = useRef({ page, rows, dpi });
  const noticeTimeoutRef = useRef(null);
  appStateRef.current = { page, rows, dpi };

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0], [rows, selectedId]);
  const dimensions = paperDimensions(page);
  const pageRowGap = Number.isFinite(page.rowGap) ? page.rowGap : DEFAULT_PAGE.rowGap;
  const printableWidth = dimensions.width - page.margin * 2;
  const pixelWidth = Math.round((dimensions.width / 25.4) * dpi);
  const pixelHeight = Math.round((dimensions.height / 25.4) * dpi);

  const showNotice = (message) => {
    setNotice(message);
    window.clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = window.setTimeout(() => setNotice(""), 2800);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEYS.workspace, JSON.stringify(makePreset("Autosave", page, rows, dpi)));
      } catch {
        // The editor remains usable when browser storage is unavailable.
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [page, rows, dpi]);

  useEffect(() => {
    if (!presetOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPresetOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [presetOpen]);

  const savePresetInBrowser = () => {
    const preset = makePreset(presetName, page, rows, dpi);
    const next = [preset, ...presets.filter((item) => item.name.toLowerCase() !== preset.name.toLowerCase())].slice(0, 30);
    try {
      window.localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(next));
      setPresets(next);
      showNotice(`“${preset.name}” saved in this browser`);
    } catch {
      showNotice("Browser storage is unavailable");
    }
  };

  const downloadPreset = () => {
    const preset = makePreset(presetName, page, rows, dpi);
    const blob = new Blob([`${JSON.stringify(preset, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "stencil-preset"}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice("Preset JSON downloaded");
  };

  const loadPreset = (input) => {
    try {
      const preset = normalizePreset(input);
      setPage(preset.page);
      setRows(preset.rows);
      setSelectedId(preset.rows[0].id);
      setDpi(preset.dpi);
      setPresetName(preset.name);
      setPresetOpen(false);
      showNotice(`“${preset.name}” loaded`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Preset could not be loaded");
    }
  };

  const importPreset = async (file) => {
    try {
      loadPreset(JSON.parse(await file.text()));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Preset JSON could not be read");
    }
  };

  const updateSelected = (patch) => {
    if (!selected) return;
    setRows((current) => current.map((row) => row.id === selected.id ? { ...row, ...patch } : row));
  };

  const changeRowType = (type) => {
    if (!selected || !TYPE_DEFAULTS[type]) return;
    setRows((current) => current.map((row) => {
      if (row.id !== selected.id) return row;
      return {
        id: row.id,
        type,
        ...COMMON_DEFAULTS,
        ...TYPE_DEFAULTS[type],
        thickness: row.thickness,
        strokeStyle: row.strokeStyle,
        spacing: row.spacing,
        overlapOffset: row.overlapOffset,
        rotation: row.rotation,
        rotationOffset: row.rotationOffset,
      };
    }));
  };

  const addRow = () => {
    const row = createRow("line");
    setRows((current) => [...current, row]);
    setSelectedId(row.id);
  };

  const duplicateRow = (id) => {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === id);
      if (index < 0) return current;
      const copy = { ...current[index], id: makeId() };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      setSelectedId(copy.id);
      return next;
    });
  };

  const removeRow = (id) => {
    if (rows.length === 1) {
      showNotice("A sheet needs at least one row");
      return;
    }
    setRows((current) => {
      const index = current.findIndex((row) => row.id === id);
      const next = current.filter((row) => row.id !== id);
      if (selectedId === id) setSelectedId(next[Math.min(index, next.length - 1)].id);
      return next;
    });
  };

  const moveRow = (id, direction) => {
    setRows((current) => {
      const from = current.findIndex((row) => row.id === id);
      const to = clamp(from + direction, 0, current.length - 1);
      if (from < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const dropRow = (targetId) => {
    if (!draggedId || draggedId === targetId) return setDraggedId(null);
    setRows((current) => {
      const from = current.findIndex((row) => row.id === draggedId);
      const to = current.findIndex((row) => row.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedId(null);
  };

  const exportSheet = async (format) => {
    if (!svgRef.current || exporting) return;
    setExporting(true);
    try {
      const clone = svgRef.current.cloneNode(true);
      clone.querySelectorAll(".preview-guide").forEach((guide) => guide.remove());
      clone.setAttribute("width", String(pixelWidth));
      clone.setAttribute("height", String(pixelHeight));
      const xml = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = svgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);

      const mime = format === "jpeg" ? "image/jpeg" : "image/png";
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Export failed")), mime, 0.96);
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stencil-${dimensions.label.toLowerCase().replaceAll(" ", "-")}-${page.orientation}-${dpi}dpi.${format === "jpeg" ? "jpg" : "png"}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotice(`${format.toUpperCase()} downloaded at ${dpi} DPI`);
    } catch (error) {
      console.error(error);
      showNotice("Export could not be completed");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return undefined;
    const lifecycle = new AbortController();
    const afterPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const registrations = [
      context.registerTool({
        name: "configure_stencil_page",
        title: "Configure stencil page",
        description: "Set the paper size, orientation, printable margin, vertical spacing mode, or manual row gap in the visible stencil editor.",
        inputSchema: {
          type: "object",
          properties: {
            paperId: { type: "string", enum: PAPER_SIZES.map((item) => item.id) },
            orientation: { type: "string", enum: ["portrait", "landscape"] },
            margin: { type: "number", minimum: 5, maximum: 30 },
            spaceVertical: { type: "boolean" },
            rowGap: { type: "number", minimum: 0, maximum: 50 },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Page settings must be an object.");
          const current = appStateRef.current.page;
          const next = { ...current };
          if (input.paperId !== undefined) {
            if (!PAPER_SIZES.some((item) => item.id === input.paperId)) throw new Error("Unsupported paper size.");
            next.paperId = input.paperId;
          }
          if (input.orientation !== undefined) {
            if (!["portrait", "landscape"].includes(input.orientation)) throw new Error("Unsupported orientation.");
            next.orientation = input.orientation;
          }
          if (input.margin !== undefined) {
            if (typeof input.margin !== "number" || input.margin < 5 || input.margin > 30) throw new Error("Margin must be between 5 and 30 mm.");
            next.margin = input.margin;
          }
          if (input.spaceVertical !== undefined) {
            if (typeof input.spaceVertical !== "boolean") throw new Error("spaceVertical must be a boolean.");
            next.spaceVertical = input.spaceVertical;
          }
          if (input.rowGap !== undefined) {
            if (typeof input.rowGap !== "number" || input.rowGap < 0 || input.rowGap > 50) throw new Error("Row gap must be between 0 and 50 mm.");
            next.rowGap = input.rowGap;
          }
          appStateRef.current = { ...appStateRef.current, page: next };
          setPage(next);
          await afterPaint();
          return next;
        },
      }, { signal: lifecycle.signal }),
      context.registerTool({
        name: "add_stencil_rows",
        title: "Add stencil rows",
        description: "Add one or more element rows to the visible stencil sheet in a single action.",
        inputSchema: {
          type: "object",
          properties: {
            types: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", enum: ELEMENT_TYPES.map((item) => item.id) } },
          },
          required: ["types"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          if (!input || !Array.isArray(input.types) || input.types.length < 1 || input.types.length > 12) throw new Error("Provide between 1 and 12 row types.");
          if (!input.types.every((type) => TYPE_DEFAULTS[type])) throw new Error("One or more row types are unsupported.");
          const added = input.types.map((type) => createRow(type));
          setRows((current) => {
            const next = [...current, ...added];
            appStateRef.current = { ...appStateRef.current, rows: next };
            return next;
          });
          setSelectedId(added[added.length - 1].id);
          await afterPaint();
          return { added: added.length, totalRows: appStateRef.current.rows.length };
        },
      }, { signal: lifecycle.signal }),
    ];

    Promise.allSettled(registrations).then((results) => {
      results.forEach((result) => {
        if (result.status === "rejected" && result.reason?.name !== "AbortError") {
          console.warn("WebMCP tool registration failed", result.reason);
        }
      });
    });
    return () => lifecycle.abort();
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span>S</span></div>
        <div className="brand-copy"><h1>Stencil Studio</h1><p>Line-work sheet builder</p></div>
        <button className="preset-button" type="button" onClick={() => setPresetOpen(true)}><span>Presets</span><small>Auto-saved</small></button>
        <div className="export-tools" aria-label="Export settings">
          <label className="dpi-select">
            <span>Resolution</span>
            <select value={dpi} onChange={(event) => setDpi(Number(event.target.value))}>
              <option value="150">150 DPI</option>
              <option value="300">300 DPI</option>
              <option value="600">600 DPI</option>
            </select>
          </label>
          <button className="export-button secondary" type="button" disabled={exporting} onClick={() => exportSheet("jpeg")}>JPEG</button>
          <button className="export-button" type="button" disabled={exporting} onClick={() => exportSheet("png")}>{exporting ? "Preparing…" : <><span className="export-long">Export </span>PNG</>}</button>
        </div>
      </header>

      <aside className="controls" aria-label="Stencil controls">
        <section className="panel-section">
          <div className="section-title"><span>01</span><h2>Page setup</h2></div>
          <div className="two-column">
            <SelectField label="Paper" value={page.paperId} onChange={(paperId) => setPage({ ...page, paperId })}>
              {PAPER_SIZES.map((paper) => <option key={paper.id} value={paper.id}>{paper.label}</option>)}
            </SelectField>
            <SelectField label="Orientation" value={page.orientation} onChange={(orientation) => setPage({ ...page, orientation })}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </SelectField>
          </div>
          <RangeField label="Printable margin" value={page.margin} unit=" mm" min={5} max={30} onChange={(margin) => setPage({ ...page, margin })} />
          <SwitchField
            label="Space rows vertically"
            description={page.spaceVertical ? "Evenly across the printable height" : `Stacked with ${pageRowGap} mm between rows`}
            checked={page.spaceVertical}
            onChange={(spaceVertical) => setPage({ ...page, spaceVertical, rowGap: pageRowGap })}
          />
          {!page.spaceVertical && (
            <NumberField
              label="Row gap"
              value={pageRowGap}
              unit="mm"
              min={0}
              max={50}
              step={0.5}
              onChange={(rowGap) => setPage({ ...page, rowGap })}
            />
          )}
        </section>

        <section className="panel-section rows-section">
          <div className="section-title row-title">
            <span>02</span><h2>Sheet rows</h2>
            <button className="text-button" type="button" onClick={addRow}>＋ Add row</button>
          </div>
          <p className="section-note">Drag rows or use the arrows to reorder them.</p>
          <div className="row-list">
            {rows.map((row, index) => {
              const meta = typeMeta(row.type);
              return (
                <div
                  key={row.id}
                  className={`row-card ${row.id === selectedId ? "active" : ""} ${row.id === draggedId ? "dragging" : ""}`}
                  draggable
                  onDragStart={() => setDraggedId(row.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropRow(row.id)}
                >
                  <button
                    className="row-selector"
                    type="button"
                    aria-pressed={row.id === selectedId}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span className="drag-handle" aria-hidden="true">⠿</span>
                    <span className="shape-symbol" aria-hidden="true">{meta.symbol}</span>
                    <span className="row-copy"><strong>{meta.label}</strong><small>Row {index + 1} · {repeatCount(row, printableWidth)} repeats</small></span>
                  </button>
                  <span className="row-actions">
                    <button type="button" title="Move row up" aria-label={`Move row ${index + 1} up`} disabled={index === 0} onClick={() => moveRow(row.id, -1)}>↑</button>
                    <button type="button" title="Move row down" aria-label={`Move row ${index + 1} down`} disabled={index === rows.length - 1} onClick={() => moveRow(row.id, 1)}>↓</button>
                    <button type="button" title="Duplicate row" aria-label={`Duplicate row ${index + 1}`} onClick={() => duplicateRow(row.id)}>⧉</button>
                    <button className="delete-action" type="button" title="Delete row" aria-label={`Delete row ${index + 1}`} onClick={() => removeRow(row.id)}>×</button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {selected && (
          <section className="panel-section editor-section">
            <div className="section-title"><span>03</span><h2>Edit row</h2><b className="row-index">{String(rows.findIndex((row) => row.id === selected.id) + 1).padStart(2, "0")}</b></div>
            <SelectField label="Element type" value={selected.type} onChange={changeRowType}>
              {ELEMENT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
            </SelectField>

            <ShapeControls row={selected} update={updateSelected} />

            <div className="two-column compact-fields">
              <NumberField label="Stroke" value={selected.thickness} unit="mm" min={0.2} max={3} step={0.05} onChange={(thickness) => updateSelected({ thickness })} />
              <SelectField label="Stroke style" value={selected.strokeStyle} onChange={(strokeStyle) => updateSelected({ strokeStyle })}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </SelectField>
            </div>
            <RangeField label="Minimum spacing" value={selected.spacing} unit=" mm" min={1} max={30} onChange={(spacing) => updateSelected({ spacing })} />
            <NumberField label="Overlap offset" value={selected.overlapOffset} unit="mm" min={-30} max={30} step={0.1} onChange={(overlapOffset) => updateSelected({ overlapOffset })} />
            <div className="two-column compact-fields">
              <NumberField label="Rotation" value={selected.rotation} unit="°" min={-180} max={180} onChange={(rotation) => updateSelected({ rotation })} />
              <NumberField label="Step offset" value={selected.rotationOffset} unit="°" min={-90} max={90} onChange={(rotationOffset) => updateSelected({ rotationOffset })} />
            </div>
            <p className="field-help">Negative overlap packs elements together; positive overlap spreads them apart. Step offset progressively rotates each repeat.</p>
          </section>
        )}
      </aside>

      <section className="workspace" aria-label="Stencil sheet preview">
        <div className="canvas-meta">
          <div><i aria-hidden="true" /> Live preview</div>
          <div>{dimensions.width} × {dimensions.height} mm <span>·</span> {pixelWidth.toLocaleString()} × {pixelHeight.toLocaleString()} px</div>
        </div>
        <div className="paper-wrap">
          <div className="page-ruler vertical"><span>0</span><span>{Math.round(dimensions.height / 2)}</span><span>{Math.round(dimensions.height)}</span></div>
          <SheetPreview page={page} rows={rows} svgRef={svgRef} />
          <div className="page-ruler horizontal"><span>0</span><span>{Math.round(dimensions.width / 2)}</span><span>{Math.round(dimensions.width)} mm</span></div>
        </div>
        <p className="canvas-caption">The dashed margin guide is preview-only and will not appear in exports.</p>
      </section>

      <PresetDialog
        open={presetOpen}
        name={presetName}
        setName={setPresetName}
        presets={presets}
        onClose={() => setPresetOpen(false)}
        onSave={savePresetInBrowser}
        onDownload={downloadPreset}
        onLoad={loadPreset}
        onImport={importPreset}
      />
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
