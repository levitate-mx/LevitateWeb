import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ChevronDown, Trophy, X } from "lucide-react";
import ts from "typescript";
import { normalizeAdminSearch } from "../src/components/admin/adminNavigation.ts";
import { isJudgingGroupCategory } from '../shared/judging-group.js';
import { compactJudgingCategoryTitle } from '../shared/judging-category-title.js';

function declarations(source, functions, constants) {
  const syntax = ts.createSourceFile("report.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return [
    ...constants.map((name) => syntax.statements.find((node) => ts.isVariableStatement(node)
      && node.declarationList.declarations.some((entry) => entry.name.getText(syntax) === name))),
    ...functions.map((name) => syntax.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name)),
  ].map((node) => {
    assert.ok(node, "the test must use an existing application declaration");
    return node.getText(syntax);
  }).join("\n");
}
const previous = await readFile(new URL("../src/components/admin/JudgingScoresPanel.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../src/components/judging/JudgingAdminWorkspace.tsx", import.meta.url), "utf8");
const javascript = ts.transpileModule([
  declarations(previous, ["scoreValue", "reportScoreValue", "blockKey", "blockLabel", "JudgeBreakdown", "filterReportSections", "ReleveAudienceFavorite", "DictamenEntry"], ["statusLabels", "scoreFormatter"]),
  declarations(workspace, ["Empty", "SheetReleaseControl", "ReportPanel"], ["labels", "number"]),
  "globalThis.renderReport = ReportPanel; globalThis.releaseControl = SheetReleaseControl;",
].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function fixture() {
  const judge = {
    id: "daniel", name: "DANIEL", status: "complete", subtotal: 98.25, penalty: -1.5,
    total: 96.75, maximumScore: 100,
    criteria: [{ id: 1, label: "Técnica", section: "Ejecución", value: 18.25, maximumScore: 20 }],
    feedback: "Buen trabajo <b>equipo</b>\nSigan practicando.",
  };
  const row = (id, fields = {}) => ({
    id, name: `Vuelo ${id}`, academy: "Academia Águila", state: "Estado de México", genre: "Aro",
    division: "Teen", level: "Intermedio", category: "Solo", blockId: "b1", blockName: "Bloque 1",
    status: "complete", completedJudges: 1, expectedJudges: 1, recordedScores: 1, judges: [judge], ...fields,
  });
  const standing = (routineId, score, rank) => ({ routineId, score,
    medal: ["4", "5"].includes(routineId) ? null : routineId === "1" ? "oro" : routineId === "2" ? "bronce" : "participacion",
    directCompetition: true, eligibleCount: 4,
    placement: rank == null ? null : { rank, label: `${rank}.º lugar`, isFirstPlace: rank === 1, isParticipation: false } });
  const rows = [
    row("1"),
    row("2", { name: "Danza Áurea", genre: "Tela", status: "partial", completedJudges: 0,
      judges: [{ ...judge, status: "partial", subtotal: 0, total: 0, penalty: 0,
        criteria: [...judge.criteria, { id: 2, label: "Pendiente", section: "Técnica", value: null, maximumScore: 20 }] }] }),
    row("3", { name: "Cero registrado" }),
    row("4", { name: "Sin notas", status: "pending", completedJudges: 0, recordedScores: 0, judges: [] }),
    row("5", { name: "No disponible", status: "unavailable", judges: [] }),
  ];
  const report = {
    id: "b1", name: "Bloque 1", title: "Final de prueba", isActive: true,
    sections: [
      { id: "ARO", label: "Aro", categories: [{ id: "aro-teen", title: "Teen Intermedio Solo",
        rows: [standing("4", 0, null), standing("5", null, null), standing("3", 0, 2), standing("1", 140, 1)] }] },
      { id: "TELA", label: "Tela", categories: [{ id: "tela-teen", title: "Teen Intermedio Solo", rows: [standing("2", 110, 3)] }] },
    ],
    counts: { disciplines: 2, categories: 2, scored: 3, total: 5 },
    specialAwards: [{ id: "award_1", title: "Mejor vestuario", displayValue: "Academia premiada", isAssigned: true, routineId: null }],
    topScore: { routineId: "1", score: 140 },
  };
  return { event: { id: "levitate-fixture", name: "Levitate de prueba" }, blocks: [{block_id: "b1", name: "Bloque 1", title: "Final de prueba"}, {block_id: "b2", name: "Bloque 2", title: "Segundo bloque"}], snapshot: { rows, report: { maximumScore: 210, blocks: [report] } } };
}

function findElement(element, predicate) {
  if (!element || typeof element !== "object") return null;
  if (Array.isArray(element)) {
    for (const child of element) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  return predicate(element) ? element : findElement(element.props?.children, predicate);
}

function harness(bundle = fixture(), readOnly = false) {
  const state = [];
  const selectedBlocks = [];
  let cursor = 0;
  const scope = { require: createRequire(import.meta.url), exports: {}, normalizeAdminSearch, isJudgingGroupCategory, compactJudgingCategoryTitle, ChevronDown, Trophy, X,
    useEffect() {},
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    },
  };
  vm.runInNewContext(javascript, scope);
  const tree = () => {
    cursor = 0;
    return scope.renderReport({ report: bundle.snapshot.report.blocks[0], bundle, blockId: "b1", onBlockChange: value => selectedBlocks.push(value), readOnly });
  };
  return {
    html: () => renderToStaticMarkup(tree()),
    tree,
    selectedBlocks,
    change(field, value) {
      const element = findElement(tree(), (node) => field === "query" ? node.type === "input"
        : node.type === "select" && node.props.value === state[field === "discipline" ? 1 : 2]
          && findElement(node.props.children, (option) => option.type === "option" && option.props.value === (field === "discipline" ? "TELA" : "partial")));
      assert.ok(element, `missing filter ${field}`);
      element.props.onChange({ target: { value } });
    },
    toggle(id) {
      const entry = findElement(tree(), (node) => node.props?.standing?.routineId === id);
      assert.ok(entry, `missing entry ${id}`);
      entry.props.onToggle();
    },
    clear() {
      const button = findElement(tree(), (node) => node.type === "button");
      assert.ok(button, "missing clear filters button");
      button.props.onClick();
    },
  };
}

test("the new admin reuses the existing read-only entry and filter implementations", () => {
  assert.match(workspace, /import \{ DictamenEntry, filterReportSections, ReleveAudienceFavorite \} from "\.\.\/admin\/JudgingScoresPanel"/);
  assert.match(workspace, /key=\{`\$\{eventId\}:\$\{blockId\}:\$\{view\}`\}/, "event, block and view changes reset local report filters and expanded details");
  const ui = harness().html();
  assert.match(ui, /Filtros del dictamen/);
  assert.match(ui, /Buscar coreografía/);
  assert.match(ui, /Estado de evaluación/);
  assert.match(ui, /Ver detalle de Vuelo 1/);
  assert.doesNotMatch(ui, />#[0-9]+</);
  assert.match(ui, />Intermedio</);
  assert.match(ui, />Solo</);
  assert.match(ui, /judging-scores__status is-complete/);
  assert.match(ui, /Premios especiales/);
  assert.doesNotMatch(ui, /TOP SCORE|ja-top-score/);
  assert.match(ui, /Mejor vestuario/);
});

test("report-only viewers retain results and filters without individual-sheet controls", () => {
  const view = harness(fixture(), true);
  assert.match(view.html(), /Filtros del dictamen/);
  assert.match(view.html(), /Premios especiales/);
  assert.doesNotMatch(view.html(), /TOP SCORE|ja-top-score/);
  assert.match(view.html(), /Vuelo 1|Mejor vestuario/);
  assert.doesNotMatch(view.html(), /Ver detalle|aria-expanded|Subtotal registrado|DANIEL|Buen trabajo|Enviar hojas de jueceo|Hojas de jueceo en Mi Levitate/);
  view.change("query", "aurea");
  assert.match(view.html(), /Danza Áurea/);
  assert.match(view.html(), /1 de 5 coreografías/);
  assert.doesNotMatch(view.html(), /Ver detalle|aria-expanded/);
});

test('participant counts appear only for groups in both admin and report-only views', () => {
  for (const readOnly of [false, true]) {
    const bundle = fixture();
    bundle.snapshot.rows[0].category = 'GRUPO';
    bundle.snapshot.rows[0].participantCount = 8;
    bundle.snapshot.rows[1].participantCount = 2;
    bundle.snapshot.rows[2].category = 'Grupo';
    bundle.snapshot.rows[2].participantCount = null;
    const ui = harness(bundle, readOnly).html();
    assert.equal((ui.match(/Cantidad de participantes/g) || []).length, 2);
    assert.match(ui, /judging-scores__participants.*?<strong>8<\/strong>/);
    assert.match(ui, /judging-scores__participants.*?<strong>Por confirmar<\/strong>/);
    assert.doesNotMatch(ui, /judging-scores__participants.*?<strong>2<\/strong>/);
    assert.match(ui, />1\.º lugar</);
  }
});

test("combined search, discipline and evaluation filters retain official places and do not mutate the bundle", () => {
  const bundle = fixture(), before = structuredClone(bundle), view = harness(bundle);
  view.change("query", "aurea");
  view.change("discipline", "TELA");
  view.change("status", "partial");
  const ui = view.html();
  assert.match(ui, /Danza Áurea/);
  assert.match(ui, /1 de 5 coreografías/);
  assert.match(ui, /3\.º lugar/);
  assert.doesNotMatch(ui, /Ver detalle de Vuelo 1|Ver detalle de Cero registrado/);
  assert.match(ui, /Premios especiales/);
  assert.doesNotMatch(ui, /TOP SCORE|ja-top-score/);
  assert.match(ui, /Academia premiada/);
  assert.deepEqual(bundle, before);
  view.clear();
  assert.match(view.html(), /Ver detalle de Vuelo 1/);
  assert.doesNotMatch(view.html(), /Limpiar filtros/);
});

test("search includes state, ID, level and division without recalculating scores", () => {
  for (const query of ["estado de mexico", "intermedio", "teen", "aguila"]) {
    const view = harness();
    view.change("query", query);
    assert.match(view.html(), /5 de 5 coreografías/);
  }
  const view = harness();
  view.change("query", "2");
  assert.match(view.html(), /1 de 5 coreografías/);
  assert.match(view.html(), /3\.º lugar/);
});

test("expanding a choreography shows the original criterion values, penalties, totals and escaped comments", () => {
  const view = harness();
  assert.doesNotMatch(view.html(), /Subtotal registrado/);
  view.toggle("1");
  const ui = view.html();
  assert.match(ui, /aria-expanded="true"/);
  assert.match(ui, /judging-score-detail-levitate-fixture-b1-1/);
  assert.match(ui, /DANIEL/);
  assert.match(ui, /<td>18.25<\/td>/);
  assert.match(ui, /Subtotal registrado<\/dt><dd>98.25<\/dd>/);
  assert.match(ui, /Penalización<\/dt><dd>-1.5<\/dd>/);
  assert.match(ui, /Total del juez<\/dt><dd>96.75/);
  assert.match(ui, /Escala de 210 puntos/);
  assert.match(ui, /Buen trabajo &lt;b&gt;equipo&lt;\/b&gt;/);
  assert.doesNotMatch(ui, /<b>equipo<\/b>/);
  view.toggle("1");
  assert.doesNotMatch(view.html(), /Subtotal registrado/);
});

test("changing filters closes details and incomplete sheets preserve zero versus pending criteria", () => {
  const view = harness();
  view.toggle("1");
  view.change("status", "partial");
  assert.doesNotMatch(view.html(), /Subtotal registrado/);
  view.toggle("2");
  const ui = view.html();
  assert.match(ui, /Incompleta/);
  assert.match(ui, /<td>Pendiente<\/td>/);
  assert.match(ui, /Total registrado \(parcial\)<\/dt><dd>0/);
  assert.match(ui, /0\/1 jueces completos/);
});

test("refreshing an expanded sheet reads fresh server values without changing its selection or placement", () => {
  const bundle = fixture(), view = harness(bundle);
  view.change("query", "Vuelo 1");
  view.toggle("1");
  bundle.snapshot.rows[0].judges[0].total = 95.5;
  bundle.snapshot.rows[0].judges[0].feedback = "Devolución actualizada";
  const ui = view.html();
  assert.match(ui, /aria-expanded="true"/);
  assert.match(ui, /Total del juez<\/dt><dd>95.5/);
  assert.match(ui, /Devolución actualizada/);
  assert.match(ui, /1 de 5 coreografías/);
  assert.match(ui, /1\.º lugar/);
});

test("no-note, unavailable and explicitly recorded zero routines retain distinct displays", () => {
  const view = harness();
  view.change("status", "pending");
  assert.match(view.html(), /Sin notas/);
  assert.match(view.html(), /Sin lugar asignado/);
  assert.doesNotMatch(view.html(), />0<|[123]\.º lugar/);
  view.change("status", "unavailable");
  assert.match(view.html(), /No disponible/);
  assert.doesNotMatch(view.html(), />0<|[123]\.º lugar/);
  view.change("status", "complete");
  view.change("query", "cero registrado");
  assert.match(view.html(), />0</);
  assert.match(view.html(), /2\.º lugar/);
});

test("empty filters show an explicit state without hiding block-wide awards", () => {
  const view = harness();
  view.change("query", "No existe esta coreografía");
  const ui = view.html();
  assert.match(ui, /0 de 5 coreografías/);
  assert.match(ui, /No hay coreografías que coincidan/);
  assert.match(ui, /Premios especiales/);
  assert.doesNotMatch(ui, /TOP SCORE|ja-top-score/);
  assert.match(ui, /Academia premiada/);
  assert.doesNotMatch(ui, /aria-expanded/);
});

test("the block selector and all report filters share one group, including blocks without a report", () => {
  const bundle = fixture(), view = harness(bundle);
  const group = findElement(view.tree(), node => node.props?.["aria-label"] === "Filtros del dictamen");
  const block = findElement(group, node => node.type === "select" && node.props.value === "b1");
  assert.ok(block);
  assert.ok(findElement(group, node => node.type === "input" && node.props.type === "search"));
  block.props.onChange({target: {value: "b2"}});
  assert.deepEqual(view.selectedBlocks, ["b2"]);
  assert.doesNotMatch(view.html(), /Ranking en vivo/);
  bundle.snapshot.report.blocks = [];
  const empty = harness(bundle);
  assert.match(empty.html(), /Segundo bloque/);
  assert.match(empty.html(), /No hay resultados disponibles/);
});

test('Relevé shows jury, audience votes and the five-point bonus separately, and keeps ties pending', () => {
  const bundle = fixture(), standing = bundle.snapshot.report.blocks[0].sections[0].categories[0].rows.find(row => row.routineId === '1');
  standing.juryScore = 45; standing.score = 50; standing.maximumScore = 50;
  standing.audience = { candidateId: 'estrella-mistica', votes: 28, bonus: 5, ready: true, status: 'closed' };
  const view = harness(bundle), final = view.html();
  assert.match(final, /Puntaje final/); assert.match(final, /Jurado: 45/); assert.match(final, /Público: 28 votos/); assert.match(final, /Bono: \+5/);
  assert.match(final, />50</);
  standing.audience = { ...standing.audience, bonus: 0, ready: false, status: 'tie_pending' };
  standing.score = 45; standing.placement = null;
  const tied = view.html();
  assert.match(tied, /Empate del público · bono por definir/); assert.match(tied, /Bono: Pendiente/);
  assert.doesNotMatch(tied, /Puntaje final/);
});


test("admin and report-only views show medals for solo routines and add places only for direct competition", () => {
  for (const readOnly of [false, true]) {
    const bundle = fixture();
    const result = bundle.snapshot.report.blocks[0].sections[0].categories[0].rows.find(entry => entry.routineId === "1");
    result.medal = "plata";
    result.directCompetition = false;
    result.eligibleCount = 1;
    result.placement = null;
    const view = harness(bundle, readOnly);
    view.change("query", "Vuelo 1");
    const solo = view.html();
    assert.match(solo, />Medalla<\/span><strong>Plata<\/strong>/);
    assert.match(solo, /Sin competencia directa/);
    assert.doesNotMatch(solo, />Lugar<|[123]\.º lugar|judging-scores__entry is-first/);
    result.directCompetition = true;
    result.eligibleCount = 2;
    result.placement = { rank: 2, label: "2.º lugar", isFirstPlace: false, isParticipation: false };
    const direct = view.html();
    assert.match(direct, />Medalla<\/span><strong>Plata<\/strong>/);
    assert.match(direct, />Lugar<\/span><strong>2\.º lugar<\/strong>/);
    assert.doesNotMatch(direct, /Sin competencia directa/);
  }
});

test("Relevé has its own final dictamen panel after ordinary competition in admin and reader views", () => {
  for (const readOnly of [false, true]) {
    const bundle = fixture();
    bundle.snapshot.report.blocks[0].sections[1].kind = "releve";
    bundle.snapshot.report.blocks[0].sections[1].label = "RELEVÉ";
    const view = harness(bundle, readOnly);
    const releve = findElement(view.tree(), node => node.props?.["aria-label"] === "Premio Relevé");
    assert.ok(releve, "Relevé must have its own labelled region");
    assert.equal(releve.props.className, "ja-report-releve");
    const ownPanel = renderToStaticMarkup(releve);
    assert.match(ownPanel, /<h2>Premio Relevé<\/h2><p>Premiación independiente<\/p>/);
    assert.match(ownPanel, /Danza Áurea/);
    assert.match(ownPanel, />Medalla<\/span><strong>Bronce<\/strong>/);
    assert.match(ownPanel, /3\.º lugar/);
    const ordinary = findElement(view.tree(), node => node.type === "section" && node.props?.["aria-label"] === "Aro");
    assert.ok(ordinary);
    assert.doesNotMatch(renderToStaticMarkup(ordinary), /Danza Áurea|Premio Relevé/);
    assert.ok(view.html().indexOf('aria-label="Aro"') < view.html().indexOf('aria-label="Premio Relevé"'));
    view.change("discipline", "TELA");
    assert.match(view.html(), /Premio Relevé|Premiación independiente/);
    assert.match(view.html(), /1 de 5 coreografías/);
    assert.doesNotMatch(view.html(), /Ver detalle de Vuelo 1/);
  }
});

test("the event-wide champion remains immediately before Mejor porra when dictamen rows are filtered", () => {
  for (const readOnly of [false, true]) {
    const bundle = fixture();
    bundle.snapshot.report.blocks[0].specialAwards.push(
      { id: "champion_of_champions", title: "Campeón de campeones", displayValue: "Vuelo ganador · Academia Águila · 145 puntos", isAssigned: true, routineId: "earlier-block-winner" },
      { id: "award_4", title: "Mejor porra", displayValue: "Academia del público", isAssigned: true, routineId: null },
    );
    const view = harness(bundle, readOnly);
    view.change("query", "Danza Áurea");
    const ui = view.html();
    const champion = findElement(view.tree(), node => node.type === "div" && node.props?.className?.includes("is-champion"));
    assert.ok(champion, "the champion must have visual emphasis");
    assert.match(renderToStaticMarkup(champion), /Vuelo ganador · Academia Águila · 145 puntos/);
    assert.ok(ui.indexOf("Campeón de campeones") < ui.indexOf("Mejor porra"));
    assert.ok(ui.indexOf("Mejor vestuario") < ui.indexOf("Campeón de campeones"));
    assert.match(ui, /1 de 5 coreografías/);
    assert.doesNotMatch(ui, /Ver detalle de Vuelo 1/);
    const award = bundle.snapshot.report.blocks[0].specialAwards[1];
    award.isAssigned = false;
    award.routineId = null;
    award.displayValue = "Pendiente de completar las calificaciones";
    const pending = view.html();
    assert.match(pending, /class="is-champion is-unassigned"/);
    assert.match(pending, /Pendiente de completar las calificaciones/);
    assert.doesNotMatch(pending, /Vuelo ganador/);
  }
});


test("the final ceremony goes from ordinary results to Relevé and awards ending in porra, without Top Score", () => {
  for (const readOnly of [false, true]) {
    const bundle = fixture();
    const report = bundle.snapshot.report.blocks[0];
    report.sections[1].kind = "releve";
    report.sections[1].label = "RELEVÉ";
    report.specialAwards.push(
      { id: "award_2", title: "Mejor música", displayValue: "Academia musical", isAssigned: true, routineId: null },
      { id: "award_3", title: "Mejor idea coreográfica", displayValue: "Academia creativa", isAssigned: true, routineId: null },
      { id: "champion_of_champions", title: "Campeón de campeones", displayValue: "Ganador general · 145 puntos", isAssigned: true, routineId: "earlier-block-winner" },
      { id: "award_4", title: "Mejor porra", displayValue: "Academia del público", isAssigned: true, routineId: null },
    );
    assert.ok(report.topScore, "the server can still provide block-wide score metadata");
    const before = structuredClone(bundle);
    const view = harness(bundle, readOnly);
    const ui = view.html();
    assert.ok(ui.indexOf('aria-label="Aro"') < ui.indexOf('aria-label="Premio Relevé"'));
    assert.ok(ui.indexOf('aria-label="Premio Relevé"') < ui.indexOf('<h2>Premios especiales</h2>'));
    assert.doesNotMatch(ui, /TOP SCORE|ja-top-score/);
    const awards = findElement(view.tree(), node => node.props?.className === "ja-awards-report");
    const titles = awards.props.children[1].map(row => row.props.children[0].props.children);
    assert.deepEqual(titles, ["Mejor vestuario", "Mejor música", "Mejor idea coreográfica", "Campeón de campeones", "Mejor porra"]);
    view.change("query", "Danza Áurea");
    const filtered = view.html();
    assert.match(filtered, /Premio Relevé|Ganador general · 145 puntos/);
    assert.doesNotMatch(filtered, /TOP SCORE|ja-top-score/);
    assert.ok(filtered.indexOf("Campeón de campeones") < filtered.indexOf("Mejor porra"));
    assert.deepEqual(bundle, before, "the ceremony presentation must not rewrite backend metadata or order");
  }
});


test("Relevé audience favorite precedes its ranking and survives dictamen filters without leaking to ordinary results", () => {
  for (const readOnly of [false, true]) {
    const bundle = fixture();
    const report = bundle.snapshot.report.blocks[0];
    report.sections[1].kind = "releve";
    report.sections[1].label = "RELEVÉ";
    report.releveAudienceFavorite = { status: "ready", winner: { routineId: "outside-filter", name: "Favorita del público", academy: "Academia ganadora", votes: 32 } };
    const view = harness(bundle, readOnly);
    const favorite = findElement(view.tree(), node => node.props?.favorite === report.releveAudienceFavorite);
    assert.ok(favorite);
    const ui = view.html();
    assert.ok(ui.indexOf("Premiación independiente") < ui.indexOf("Esto le otorgó 5 puntos extras sobre su calificación final dada por los jueces."));
    assert.ok(ui.indexOf("Esto le otorgó 5 puntos extras sobre su calificación final dada por los jueces.") < ui.indexOf("Danza Áurea"));
    assert.match(ui, /Favorita del público/);
    assert.match(ui, /Academia ganadora · 32 votos/);
    const ordinary = findElement(view.tree(), node => node.type === "section" && node.props?.["aria-label"] === "Aro");
    assert.doesNotMatch(renderToStaticMarkup(ordinary), /Esto le otorgó 5 puntos extras sobre su calificación final dada por los jueces.|Favorita del público/);
    view.change("query", "Danza Áurea");
    assert.match(view.html(), /Favorita del público/);
    assert.match(view.html(), /Academia ganadora · 32 votos/);
    report.releveAudienceFavorite = { status: "tie", winner: null };
    assert.match(view.html(), /Empate del público/);
    assert.doesNotMatch(view.html(), /Favorita del público/);
  }
});


test("sending block sheets only enables Mi Levitate after an explicit admin click", async () => {
  const calls = [], states = [], effects = [];
  let cursor = 0, released = false;
  const scope = { require: createRequire(import.meta.url), exports: {}, AbortController, Error,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = value; }];
    },
    useEffect(callback) { effects.push(callback); },
    async requestRegistrationApi(path, options = {}) {
      calls.push({ path, method: options.method || "GET", body: options.body });
      if (options.method === "POST") released = true;
      return { blockId: "b1", state: released ? "released" : "ready", complete: true, canRelease: !released, routines: 5, availableRoutines: 5, availableSheets: 15, releasedRoutines: released ? 5 : 0, releasedSheets: released ? 15 : 0, releasedAt: released ? "2026-11-13T19:00:00Z" : null };
    },
  };
  vm.runInNewContext(javascript, scope);
  let revision = "first";
  const tree = () => { cursor = 0; return scope.releaseControl({ eventId: "event-id", blockId: "b1", revision }); };
  const html = () => renderToStaticMarkup(tree());
  assert.match(html(), /Comprobando hojas/);
  const cleanup = effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls.map(call => call.method), ["GET"]);
  assert.match(calls[0].path, /eventId=event-id&blockId=b1/);
  assert.match(html(), /15 hojas disponibles de 5 coreografías/);
  const button = findElement(tree(), node => node.type === "button");
  assert.equal(button.props.disabled, false);
  assert.equal(button.props.children, "Enviar hojas de jueceo");
  await button.props.onClick();
  assert.deepEqual(calls.map(call => call.method), ["GET", "POST"]);
  assert.deepEqual(JSON.parse(calls[1].body), { block_id: "b1" });
  assert.match(calls[1].path, /sheet-release\?eventId=event-id$/);
  assert.match(html(), /15 hojas habilitadas de 5 coreografías en Mi Levitate/);
  assert.equal(findElement(tree(), node => node.type === "button").props.disabled, true);
  await findElement(tree(), node => node.type === "button").props.onClick();
  assert.equal(calls.filter(call => call.method === "POST").length, 1);
  cleanup();
  revision = "updated-snapshot";
  tree();
  const reloadCleanup = effects.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls.map(call => call.method), ["GET", "POST", "GET"], "refreshing only checks status");
  assert.doesNotMatch(html(), /correo|mail|Drive/i);
  reloadCleanup();
});

test("blocks without finished sheets keep release disabled and failed releases show an error", async () => {
  for (const complete of [false, true]) {
    const states = [], effects = [], calls = [];
    let cursor = 0;
    const scope = { require: createRequire(import.meta.url), exports: {}, AbortController, Error,
      useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
      useEffect(callback) { effects.push(callback); },
      async requestRegistrationApi(path, options = {}) {
        calls.push(options.method || "GET");
        if (options.method === "POST") throw new Error("El bloque cambió. Actualiza antes de habilitar.");
        return { blockId: "b1", state: complete ? "ready" : "pending", complete, canRelease: complete, routines: 5, availableRoutines: complete ? 5 : 0, availableSheets: complete ? 15 : 0, releasedRoutines: 0, releasedSheets: 0, releasedAt: null };
      },
    };
    vm.runInNewContext(javascript, scope);
    const tree = () => { cursor = 0; return scope.releaseControl({ eventId: "event-id", blockId: "b1" }); };
    tree(); effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    const button = findElement(tree(), node => node.type === "button");
    assert.equal(button.props.disabled, !complete);
    await button.props.onClick();
    if (complete) {
      assert.deepEqual(calls, ["GET", "POST"]);
      assert.match(renderToStaticMarkup(tree()), /role="alert"/);
      assert.match(renderToStaticMarkup(tree()), /El bloque cambió/);
      assert.equal(findElement(tree(), node => node.type === "button").props.disabled, false);
    } else {
      assert.deepEqual(calls, ["GET"]);
      assert.match(renderToStaticMarkup(tree()), /Todavía no hay hojas terminadas para enviar/);
    }
  }
});

test("the final workspace exposes sheet release to admins and removes the email export workflow", () => {
  assert.match(harness().html(), /Hojas de jueceo en Mi Levitate/);
  assert.match(harness().html(), /Enviar hojas de jueceo/);
  assert.doesNotMatch(harness(fixture(), true).html(), /Hojas de jueceo en Mi Levitate|Enviar hojas de jueceo/);
  assert.doesNotMatch(workspace, /Enviar correos|Subir hojas a Drive|ExportRecipients|export-send|export-start|export-file|export-recipients/);
});

test("final category headings omit age explanations without merging groups or changing server ranks", () => {
  for (const readOnly of [false, true]) {
    const bundle = fixture();
    const originalRows = bundle.snapshot.report.blocks[0].sections.flatMap(section => section.categories.flatMap(category => category.rows));
    const byId = new Map(originalRows.map(result => [result.routineId, result]));
    bundle.snapshot.rows.push({ ...structuredClone(bundle.snapshot.rows[0]), id: "6", name: "Dúo senior", category: "DÚO: 2 APARATOS", level: "Intermedio", division: "Senior" });
    const categories = [
      { id: "petite-7-10-duo", title: "PETITE: 7 A 10 AÑOS DÚO", rows: [byId.get("1")] },
      { id: "petite-8-11-duo", title: "PETITE: 8 A 11 AÑOS DÚO", rows: [byId.get("3")] },
      { id: "baby-solo", title: "BABY: HASTA LOS 6 AÑOS SOLO", rows: [byId.get("2")] },
      { id: "senior-duo", title: "SENIOR INTERMEDIO DÚO: 2 APARATOS", rows: [{ ...byId.get("1"), routineId: "6" }] },
    ];
    bundle.snapshot.report.blocks[0].sections = [{ id: "MOTION", label: "Motion", categories }];
    const before = structuredClone(bundle);
    const view = harness(bundle, readOnly);
    const ui = view.html();
    assert.equal((ui.match(/<h3>PETITE DÚO<\/h3>/g) || []).length, 2, "distinct raw groups remain separate despite matching display titles");
    assert.equal((ui.match(/class="ja-report-category"/g) || []).length, 4);
    assert.match(ui, /<h3>BABY SOLO<\/h3>/);
    assert.match(ui, /<h3>SENIOR INTERMEDIO DÚO: 2 APARATOS<\/h3>/);
    assert.doesNotMatch(ui, /7 A 10 AÑOS|8 A 11 AÑOS|HASTA LOS 6 AÑOS/);
    assert.match(ui, /1\.º lugar/);
    assert.match(ui, /2\.º lugar/);
    view.change("query", "Vuelo 1");
    const filtered = view.html();
    assert.equal((filtered.match(/<h3>PETITE DÚO<\/h3>/g) || []).length, 1);
    assert.match(filtered, /1\.º lugar/);
    assert.deepEqual(bundle, before, "age descriptions, group IDs and official rankings remain unchanged in the source data");
  }
});

test("division-based section headings and filter labels omit ages while filter identities remain raw", () => {
  for (const readOnly of [false, true]) {
    const bundle = fixture();
    bundle.snapshot.report.blocks[0].sections[0].id = "raw-petite-division";
    bundle.snapshot.report.blocks[0].sections[0].label = "PETITE: 7 A 10 AÑOS";
    const before = structuredClone(bundle);
    const view = harness(bundle, readOnly);
    const option = findElement(view.tree(), node => node.type === "option" && node.props.value === "raw-petite-division");
    assert.ok(option);
    assert.equal(option.props.children, "PETITE");
    const section = findElement(view.tree(), node => node.type === "section" && node.props?.["aria-label"] === "PETITE");
    assert.ok(section);
    assert.match(renderToStaticMarkup(section), /<h2>PETITE<\/h2>/);
    assert.doesNotMatch(view.html(), /7 A 10 AÑOS/);
    view.change("discipline", "raw-petite-division");
    assert.match(view.html(), /4 de 5 coreografías/);
    assert.match(view.html(), /1\.º lugar/);
    assert.deepEqual(bundle, before);
  }
});

test("admin and reader display raw server totals, and admin details use each routine's own maximum", () => {
  for (const readOnly of [false, true]) {
    const bundle = fixture(), report = bundle.snapshot.report.blocks[0];
    const first = report.sections[0].categories[0].rows.find(result => result.routineId === "1");
    first.score = 19; first.maximumScore = 210; first.directCompetition = false; first.eligibleCount = 1; first.placement = null; first.medal = "participacion";
    const second = report.sections[1].categories[0].rows[0];
    second.score = 43; second.maximumScore = 210;
    const before = structuredClone(bundle), view = harness(bundle, readOnly);
    const firstEntry = findElement(view.tree(), node => node.props?.standing?.routineId === "1");
    assert.equal(firstEntry.props.maximumScore, 210);
    let html = view.html();
    assert.match(html, />Puntaje<\/span><strong>19<\/strong>/);
    assert.match(html, />Puntaje<\/span><strong>43<\/strong>/);
    assert.match(html, /Sin competencia directa/);
    assert.deepEqual(bundle, before);
    if (!readOnly) {
      view.toggle("1");
      assert.match(view.html(), /Escala de 210 puntos/);
    }
    second.score = 50; second.maximumScore = 50; second.juryScore = 45;
    second.audience = { candidateId: "candidate", votes: 30, bonus: 5, ready: true, status: "closed" };
    const secondEntry = findElement(view.tree(), node => node.props?.standing?.routineId === "2");
    assert.equal(secondEntry.props.maximumScore, 50);
    html = view.html();
    assert.match(html, />Puntaje final<\/span><strong>50<\/strong>/);
    assert.match(html, /Jurado: 45 · Público: 30 votos · Bono: \+5/);
    if (!readOnly) {
      view.toggle("2");
      html = view.html();
      assert.match(html, /Escala de 50 puntos/);
      assert.doesNotMatch(html, /Escala de 210 puntos|Escala de 150 puntos|Escala de 155 puntos/);
      second.maximumScore = null;
      html = view.html();
      assert.match(html, /Escala no disponible/);
      assert.doesNotMatch(html, /Escala de 210 puntos|Escala de 50 puntos/);
    }
  }
});

test("finished judge sheets can be sent manually from an incomplete block regardless of its summary state", async () => {
  for (const state of ["pending", "changed", "released"]) {
    const states = [], effects = [], calls = [];
    let cursor = 0, sent = false;
    const scope = { require: createRequire(import.meta.url), exports: {}, AbortController, Error,
      useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
      useEffect(callback) { effects.push(callback); },
      async requestRegistrationApi(path, options = {}) {
        calls.push({ method: options.method || "GET", path, body: options.body });
        if (options.method === "POST") sent = true;
        return { blockId: "b1", state: sent ? "released" : state, complete: false, canRelease: !sent,
          routines: 5, availableRoutines: 1, availableSheets: 1, releasedRoutines: sent ? 1 : 0,
          releasedSheets: sent ? 1 : 0, releasedAt: sent ? "2026-11-13T19:00:00Z" : null };
      },
    };
    vm.runInNewContext(javascript, scope);
    const tree = () => { cursor = 0; return scope.releaseControl({ eventId: "event-id", blockId: "b1" }); };
    tree(); const cleanup = effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.map(call => call.method), ["GET"]);
    const button = findElement(tree(), node => node.type === "button");
    assert.equal(button.props.disabled, false, `canRelease must govern ${state} even when complete=false`);
    assert.match(renderToStaticMarkup(tree()), /1 hoja disponible de 1 coreografía/);
    await button.props.onClick();
    assert.deepEqual(calls.map(call => call.method), ["GET", "POST"]);
    assert.deepEqual(JSON.parse(calls[1].body), { block_id: "b1" });
    const html = renderToStaticMarkup(tree());
    assert.match(html, /1 hoja habilitada de 1 coreografía en Mi Levitate/);
    assert.match(html, /Las nuevas hojas requieren otro envío/);
    assert.equal(findElement(tree(), node => node.type === "button").props.disabled, true);
    assert.doesNotMatch(html, /Completa todas|correo|mail|Drive/i);
    cleanup();
  }
});

test("new finished sheets require another explicit block send even after a previous release", async () => {
  const states = [], effects = [], calls = [];
  let cursor = 0, availableSheets = 1, releasedSheets = 1, revision = "first";
  const scope = { require: createRequire(import.meta.url), exports: {}, AbortController, Error,
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
    useEffect(callback) { effects.push(callback); },
    async requestRegistrationApi(path, options = {}) {
      calls.push(options.method || "GET");
      if (options.method === "POST") releasedSheets = availableSheets;
      return { blockId: "b1", state: "released", complete: false, canRelease: availableSheets > releasedSheets,
        routines: 5, availableRoutines: availableSheets, availableSheets, releasedRoutines: releasedSheets,
        releasedSheets, releasedAt: "2026-11-13T19:00:00Z" };
    },
  };
  vm.runInNewContext(javascript, scope);
  const tree = () => { cursor = 0; return scope.releaseControl({ eventId: "event-id", blockId: "b1", revision }); };
  tree(); let cleanup = effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(findElement(tree(), node => node.type === "button").props.disabled, true);
  availableSheets = 2; revision = "new-completed-judge-sheet";
  cleanup(); tree(); cleanup = effects.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ["GET", "GET"], "finishing another sheet and refreshing must not send automatically");
  assert.match(renderToStaticMarkup(tree()), /2 hojas disponibles de 2 coreografías/);
  const button = findElement(tree(), node => node.type === "button");
  assert.equal(button.props.disabled, false);
  assert.equal(button.props.children, "Enviar hojas de jueceo");
  await button.props.onClick();
  assert.deepEqual(calls, ["GET", "GET", "POST"]);
  assert.match(renderToStaticMarkup(tree()), /2 hojas habilitadas de 2 coreografías/);
  assert.equal(findElement(tree(), node => node.type === "button").props.disabled, true);
  cleanup();
});
