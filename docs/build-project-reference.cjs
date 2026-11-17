const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const entries = Object.entries(lock.packages).filter(([p]) => p).map(([p, v]) => ({
  name: p.slice(p.lastIndexOf('node_modules/') + 13),
  version: v.version ?? null,
  packagePath: p,
  development: !!v.dev,
  optional: !!v.optional,
  direct: Object.hasOwn(manifest.dependencies ?? {}, p.replace(/^node_modules\//, '')) || Object.hasOwn(manifest.devDependencies ?? {}, p.replace(/^node_modules\//, '')),
  license: v.license ?? null,
})).sort((a, b) => a.name.localeCompare(b.name) || a.packagePath.localeCompare(b.packagePath));
const direct = entries.filter(p => p.direct);
fs.writeFileSync(path.join(__dirname, 'dependency-inventory.json'), JSON.stringify({
  source: 'package-lock.json', reviewedDate: '2026-11-10',
  note: 'Lockfile entries, not proof of installed packages. Includes nested versions and platform-specific optional packages. Development and optional flags follow lockfile metadata.',
  directCount: direct.length, packageEntryCount: entries.length, packages: entries,
}, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'dependency-inventory.md'), [
  '# Complete locked dependency inventory', '',
  'Source: `package-lock.json`, reviewed 10 November 2026. Current scope: `project-overview-and-architecture.md`.', '',
  `${direct.length} direct dependencies; ${entries.length} non-root package entries. Entries include nested versions and optional packages for other operating systems. They are the locked graph, not a claim that every entry is installed on this Windows host.`, '',
  'Flags: direct = declared in package.json; development = lockfile dev flag; optional = lockfile optional flag. Dependency roles for transitive entries are determined by their parent packages, rather than by direct application imports.', '',
  ...entries.flatMap(p => [`- **${p.name} ${p.version}** — ${[p.direct ? 'direct' : 'transitive', p.development ? 'development' : 'not marked dev', ...(p.optional ? ['optional'] : [])].join(', ')}. Path: \`${p.packagePath}\``, '']),
].join('\n'));
const report = fs.readFileSync(path.join(__dirname, 'project-overview-and-architecture.md'), 'utf8');
const sections = report.split(/^## /m).slice(1).map(s => ({ title: s.slice(0, s.indexOf('\n')), body: s.slice(s.indexOf('\n') + 1).trim() }));
const canvas = `import { H1, H2, Text, useState, useHostTheme } from "cursor/canvas";
const sections = ${JSON.stringify(sections)};
const dependencies = ${JSON.stringify(direct)};
const layers = [
  ["Next.js host", "App Router pages, layouts, server rendering and browser bundles"],
  ["Browser features", "Resume · Spoken interviews · Suggestions · Dashboard · Settings"],
  ["Shared foundation", "UI primitives, charts, Zod schemas, authorization and usage checks"],
  ["Data operations", "FastAPI ↔ PostgreSQL / private Storage ↔ durable AI worker"],
  ["Demo persistence", "Explicit fixtures and mockmate-demo-v1; theme stored separately"]
];
export default function MockmateArchitecture() {
  const theme = useHostTheme();
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const section = sections[selected];
  const chunks = section.body.split(/(\x60\x60\x60[\\s\\S]*?\x60\x60\x60)/g);
  const clean = (s: string) => s.replace(/\\*\\*/g, "").replace(/\x60/g, "");
  const box = { border: "1px solid " + theme.stroke.secondary, padding: 14, borderRadius: 6 };
  return <main style={{ background: theme.bg.editor, color: theme.text.primary, padding: 24, maxWidth: 1200, margin: "0 auto", fontFamily: "system-ui", lineHeight: 1.65 }}>
    <Text>LOCAL SOURCE REVIEW · 10 NOVEMBER 2026</Text>
    <H1>Mockmate: project and architecture</H1>
    <p style={{ color: theme.text.secondary }}>Single free workspace for resumes, text interviews, reports, analytics and advice.</p>
    <p style={{ ...box, background: theme.fill.tertiary }}>Live mode uses Supabase Auth, PostgreSQL, private resume storage, FastAPI, external AI and a durable worker. Demo mode uses explicit fixtures.</p>
    <H2>Current architecture</H2>
    <div aria-label="Architecture flow from Next.js host to browser persistence">
      {layers.map(([title, detail], i) => <div key={title}>
        {i > 0 && <div style={{ textAlign: "center", color: theme.text.tertiary }}>↓</div>}
        <div style={{ ...box, display: "flex", flexWrap: "wrap", gap: 12 }}><strong style={{ minWidth: 180, color: i === 0 ? theme.accent.primary : theme.text.primary }}>{title}</strong><span style={{ color: theme.text.secondary }}>{detail}</span></div>
      </div>)}
    </div>
    <p style={{ color: theme.text.tertiary, fontSize: 12 }}>Source: local app routes, components, services, backend and configuration. The separate demo uses local mock operations.</p>
    <H2>Explore the implementation</H2>
    <nav style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20 }} aria-label="Report sections">{sections.map((s, i) => <button key={s.title} onClick={() => setSelected(i)} style={{ border: "1px solid " + theme.stroke.secondary, background: selected === i ? theme.accent.control : theme.bg.editor, color: selected === i ? theme.text.onAccent : theme.text.secondary, padding: "6px 10px", borderRadius: 5, cursor: "pointer" }}>{s.title}</button>)}</nav>
    <article><H2>{section.title}</H2>{chunks.map((chunk, i) => {
      if (chunk.startsWith("\x60\x60\x60mermaid")) return <p key={i} style={{ color: theme.text.tertiary }}>The full Mermaid diagram is included in the written project report. The architecture flow above provides the layer overview.</p>;
      if (chunk.startsWith("\x60\x60\x60")) return <pre key={i} style={{ ...box, overflowX: "auto", background: theme.fill.tertiary, fontSize: 12 }}>{chunk.replace(/^\x60\x60\x60[^\\n]*\\n/, "").replace(/\x60\x60\x60$/, "")}</pre>;
      return <div key={i}>{chunk.split(/\\n\\n/).filter(Boolean).map((p, j) => p.startsWith("### ") ? <h3 key={j} style={{ fontSize: 17, marginTop: 24 }}>{clean(p.replace(/^### /, ""))}</h3> : <p key={j} style={{ whiteSpace: "pre-line", color: theme.text.secondary }}>{clean(p)}</p>)}</div>;
    })}</article>
    <H2>Search direct dependencies</H2>
    <input aria-label="Search library names" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by package name" style={{ ...box, background: theme.bg.editor, color: theme.text.primary, width: "100%", boxSizing: "border-box", marginBottom: 12 }}/>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>{dependencies.filter(d => d.name.toLowerCase().includes(query.toLowerCase())).map(d => <div key={d.packagePath} style={{ padding: "8px 0", borderBottom: "1px solid " + theme.stroke.secondary }}><strong>{d.name}</strong><div style={{ color: theme.text.tertiary, fontSize: 12 }}>{d.version} · {d.development ? "development" : "application"}</div></div>)}</div>
    <p style={{ color: theme.text.tertiary, fontSize: 12 }}>Dependency versions: local package-lock.json. See product-simplification.md for current verification results.</p>
  </main>;
}
`;
const canvasPath = process.argv[2];
if (canvasPath) fs.writeFileSync(canvasPath, canvas);
else fs.writeFileSync(path.join(__dirname, 'mockmate-architecture.canvas-preview.txt'), canvas);
console.log(JSON.stringify({ directDependencies: direct.length, lockedPackageEntries: entries.length, sections: sections.length, canvasPath: canvasPath ?? 'docs/mockmate-architecture.canvas-preview.txt' }));
