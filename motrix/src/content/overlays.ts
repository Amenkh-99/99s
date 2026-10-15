import { comparison, faults, gantt, ganttPeriods, loopSteps, sensorCategories, smart, software, sourceChain, systemFunctions } from './source';

/** Petites briques HTML partagées par les scènes. */

export const prov = {
  src: (t = 'Dossier du projet') => `<span class="prov prov--src" title="Information issue du dossier source">${ICONS.check}${t}</span>`,
  ill: (t: string) => `<span class="prov prov--ill" title="Représentation illustrative, non validée">${ICONS.diamond}${t}</span>`,
  gen: (t = 'Principe général') => `<span class="prov prov--gen" title="Connaissance générale, hors matériel du projet">${ICONS.book}${t}</span>`,
};

export const ICONS = {
  check: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  diamond: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l6 6-6 6-6-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.4 1.8"/></svg>',
  book: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h4.5a1.5 1.5 0 0 1 1 .5 1.5 1.5 0 0 1 1-.5h4.5v9H9a1 1 0 0 0-1 1 1 1 0 0 0-1-1H2.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  warn: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6v3.6M8 11.4v.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  fault: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  ok: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 8.2l2 2 4-4.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg class="ico ico--arrow" viewBox="0 0 24 16" aria-hidden="true"><path d="M1 8h20M15 2l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  stop: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  bell: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11zM6.5 14h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>',
};

/** Boucle Mesurer → Détecter → Décider → Protéger (diapositive 8). */
export function loopDiagram(): string {
  const w = 1060;
  const nodes = loopSteps.map((s, i) => {
    const x = 70 + i * 280;
    return `<g class="loop-node" style="--i:${i}">
      <circle cx="${x + 60}" cy="70" r="52" class="loop-node__ring"/>
      <text x="${x + 60}" y="62" class="loop-node__num" text-anchor="middle">${i + 1}</text>
      <text x="${x + 60}" y="92" class="loop-node__label" text-anchor="middle">${s}</text>
      ${i < 3 ? `<path d="M${x + 124} 70 H${x + 270}" class="loop-link" marker-end="url(#arr-loop)"/>` : ''}
    </g>`;
  });
  return `<svg class="loop" viewBox="0 0 ${w} 190" role="img" aria-label="Boucle de protection : mesurer, détecter, décider, protéger, puis reprise de la mesure.">
    <defs><marker id="arr-loop" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor"/></marker></defs>
    ${nodes.join('')}
    <path d="M970 124 V168 H130 V128" class="loop-link loop-link--return" marker-end="url(#arr-loop)"/>
    <text x="550" y="186" class="loop-caption" text-anchor="middle">surveillance continue</text>
  </svg>`;
}

export function functionsList(): string {
  return `<ul class="fn-list">${systemFunctions.map((f) => `<li>${f}</li>`).join('')}</ul>`;
}

export function smartCards(): string {
  return `<div class="smart">${smart
    .map(
      (s, i) => `<article class="smart__card" style="--i:${i}">
        <span class="smart__letter" aria-hidden="true">${s.letter}</span>
        <h3>${s.label}</h3>
        <p>${s.text}</p>
      </article>`,
    )
    .join('')}</div>`;
}

/** Schéma de principe — symboles simplifiés, aucun repère de borne ni calibre. */
export function schemaDiagram(): string {
  const ys = [118, 150, 182];
  const phase = ['L1', 'L2', 'L3'];
  const seg = (x0: number, x1: number) => ys.map((y) => `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" class="sch-wire"/>`).join('');
  // symbole d'interrupteur : lame inclinée entre deux bornes
  const blade = (x: number, y: number, kind: 'q' | 'km') => {
    const fixed = kind === 'q'
      ? `<path d="M${x + 40} ${y - 6} l10 12 M${x + 50} ${y - 6} l-10 12" class="sch-sym"/>`
      : `<path d="M${x + 38} ${y} a7 7 0 0 1 14 0" class="sch-sym"/>`;
    return `<line x1="${x}" y1="${y}" x2="${x + 6}" y2="${y}" class="sch-wire"/><line x1="${x + 6}" y1="${y}" x2="${x + 46}" y2="${y - 18}" class="sch-sym"/>${fixed}<line x1="${x + 46}" y1="${y}" x2="${x + 60}" y2="${y}" class="sch-wire"/>`;
  };
  const thermal = (x: number, y: number) =>
    `<rect x="${x + 8}" y="${y - 9}" width="44" height="18" class="sch-sym"/><path d="M${x} ${y} h14 v-6 h12 v12 h12 v-6 h22" class="sch-sym"/>`;
  const qx = 300;
  const kx = 590;
  const tx = 880;
  return `<svg class="schema" viewBox="0 0 1600 640" role="img" aria-label="Schéma de principe. Puissance : réseau triphasé, disjoncteur Q1, contacteur KM1, relais thermique RT1, moteur M1. Commande : capteurs vers automate, commande de protection vers le contacteur et l'alarme.">
    <defs>
      <marker id="sch-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor"/></marker>
      <marker id="sch-arr-c" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="sch-fill-cyan"/></marker>
    </defs>
    <g class="sch-power" data-draw>
      <text x="40" y="70" class="sch-title">Circuit de puissance</text>
      ${ys.map((y, i) => `<text x="40" y="${y + 6}" class="sch-phase">${phase[i]}</text>`).join('')}
      ${seg(80, qx)}
      ${ys.map((y) => blade(qx, y, 'q')).join('')}
      <line x1="${qx + 26}" y1="${ys[0] - 8}" x2="${qx + 26}" y2="${ys[2] + 10}" class="sch-mech"/>
      <text x="${qx + 30}" y="${ys[0] - 34}" class="sch-tag" text-anchor="middle">Q1</text>
      <text x="${qx + 30}" y="${ys[2] + 44}" class="sch-name" text-anchor="middle">Disjoncteur</text>
      ${seg(qx + 60, kx)}
      ${ys.map((y) => blade(kx, y, 'km')).join('')}
      <line x1="${kx + 26}" y1="${ys[0] - 8}" x2="${kx + 26}" y2="${ys[2] + 10}" class="sch-mech"/>
      <text x="${kx + 30}" y="${ys[0] - 34}" class="sch-tag" text-anchor="middle">KM1</text>
      <text x="${kx + 30}" y="${ys[2] + 44}" class="sch-name" text-anchor="middle">Contacteur</text>
      ${seg(kx + 60, tx)}
      ${ys.map((y) => thermal(tx, y)).join('')}
      <text x="${tx + 30}" y="${ys[0] - 34}" class="sch-tag" text-anchor="middle">RT1</text>
      <text x="${tx + 30}" y="${ys[2] + 44}" class="sch-name" text-anchor="middle">Relais thermique</text>
      ${ys.map((y, i) => `<path d="M${tx + 60} ${y} H${1150 + i * 8} L1232 ${150 + (i - 1) * 26}" class="sch-wire"/>`).join('')}
      <circle cx="1300" cy="150" r="70" class="sch-sym"/>
      <text x="1300" y="146" class="sch-motor" text-anchor="middle">M</text>
      <text x="1300" y="182" class="sch-motor-sub" text-anchor="middle">3~</text>
      <text x="1300" y="${ys[0] - 74}" class="sch-tag" text-anchor="middle">M1</text>
      <text x="1300" y="262" class="sch-name" text-anchor="middle">Moteur asynchrone</text>
    </g>
    <g class="sch-control" data-step="1">
      <text x="40" y="358" class="sch-title">Relation de commande (conceptuelle)</text>
      <rect x="40" y="392" width="300" height="150" rx="6" class="sch-block"/>
      <text x="190" y="424" class="sch-block-title" text-anchor="middle">Capteurs</text>
      ${sensorCategories.map((s, i) => `<text x="${70 + (i % 2) * 140}" y="${462 + Math.floor(i / 2) * 40}" class="sch-chip">${s}</text>`).join('')}
      <path d="M340 467 H452" class="sch-ctrl" marker-end="url(#sch-arr-c)"/>
      <rect x="460" y="402" width="300" height="130" rx="6" class="sch-block sch-block--plc"/>
      <text x="610" y="456" class="sch-block-title" text-anchor="middle">Automate</text>
      <text x="610" y="490" class="sch-block-sub" text-anchor="middle">PLC Siemens</text>
      <path d="M760 467 H872" class="sch-ctrl" marker-end="url(#sch-arr-c)"/>
      <rect x="880" y="402" width="300" height="130" rx="6" class="sch-block"/>
      <text x="1030" y="456" class="sch-block-title" text-anchor="middle">Commande</text>
      <text x="1030" y="490" class="sch-block-sub" text-anchor="middle">de protection</text>
      <path d="M1030 402 V300 H${kx + 26} V${ys[2] + 64}" class="sch-ctrl sch-ctrl--dash" marker-end="url(#sch-arr-c)"/>
      <text x="${kx + 44}" y="292" class="sch-note">ouverture de KM1 (principe)</text>
      <path d="M1180 467 H1292" class="sch-ctrl" marker-end="url(#sch-arr-c)"/>
      <rect x="1300" y="402" width="240" height="130" rx="6" class="sch-block"/>
      <text x="1420" y="456" class="sch-block-title" text-anchor="middle">Alarme</text>
      <text x="1420" y="490" class="sch-block-sub" text-anchor="middle">et voyants</text>
      <path d="M1300 222 V330 H18 V467 H32" class="sch-meas" marker-end="url(#sch-arr)"/>
      <text x="204" y="322" class="sch-note">mesure (grandeurs surveillées)</text>
    </g>
    <g class="sch-legend" transform="translate(40 590)">
      <line x1="0" y1="0" x2="44" y2="0" class="sch-wire"/><text x="56" y="6" class="sch-leg">puissance</text>
      <line x1="190" y1="0" x2="234" y2="0" class="sch-ctrl"/><text x="246" y="6" class="sch-leg">signal / commande</text>
      <line x1="440" y1="0" x2="484" y2="0" class="sch-ctrl sch-ctrl--dash"/><text x="496" y="6" class="sch-leg">action conceptuelle</text>
      <line x1="700" y1="0" x2="744" y2="0" class="sch-meas"/><text x="756" y="6" class="sch-leg">mesure</text>
      <text x="960" y="6" class="sch-leg sch-leg--strong">Q1, KM1, RT1, M1 : repères illustratifs, non issus du schéma réel</text>
    </g>
  </svg>`;
}

/** Matrice défauts × catégories de capteurs. */
export function faultMatrix(): string {
  // Correspondances PROPOSÉES (inférées), à vérifier : non confirmées par le dossier.
  const proposed: Record<string, string[]> = {
    Surcharge: ['Courant'],
    'Perte de phase': ['Courant', 'Tension'],
    Surchauffe: ['Température'],
    'Vibration anormale': ['Vibration'],
    'Tension anormale': ['Tension'],
  };
  const head = sensorCategories.map((s) => `<th scope="col">${s}</th>`).join('');
  const rows = faults
    .map(
      (f) => `<tr><th scope="row">${f}</th>${sensorCategories
        .map((s) => {
          const on = proposed[f].includes(s);
          return `<td>${on ? `<span class="mx-mark" data-step="1" role="img" aria-label="Relation proposée, à vérifier"></span>` : ''}</td>`;
        })
        .join('')}</tr>`,
    )
    .join('');
  return `<table class="matrix">
    <caption class="sr-only">Défauts étudiés et catégories de capteurs ; les marques en pointillé sont des correspondances proposées, non confirmées.</caption>
    <thead><tr><th scope="col" class="matrix__corner">Défaut étudié</th>${head}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function comparisonGrid(): string {
  const chips = [
    ['Disjoncteur', 'Relais thermique'],
    ['Relais électronique'],
    ['Capteurs', 'PLC', 'Contacteur', 'Alarme'],
  ];
  const added = new Set(['Capteurs', 'PLC', 'Alarme']);
  return `<div class="cmp">${comparison
    .map(
      (c, i) => `<article class="cmp__col${i === 2 ? ' cmp__col--focus' : ''}" data-step="${i}">
        <h3>${c.solution}</h3>
        <div class="cmp__chips" aria-label="Constituants">${chips[i].map((ch) => `<span class="chip${i === 2 && added.has(ch) ? ' chip--new' : ''}">${ch}</span>`).join('')}</div>
        <dl>
          <dt>Principe</dt><dd>${c.principle}</dd>
          <dt>Avantages</dt><dd>${c.advantages}</dd>
          <dt>Inconvénients</dt><dd>${c.drawbacks}</dd>
        </dl>
      </article>`,
    )
    .join('')}</div>`;
}

export function softwareFlow(): string {
  const tool = (name: string, role: string, glyph: string, cls = '') =>
    `<article class="tool ${cls}"><div class="tool__glyph" aria-hidden="true">${glyph}</div><h3>${name}</h3><p>${role}</p></article>`;
  const g = {
    tia: '<svg viewBox="0 0 48 48"><path d="M8 10v28M40 10v28M8 18h8M24 18h16M8 30h16M32 30h8" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M16 14v8M24 14v8M24 26v8M32 26v8" stroke="currentColor" stroke-width="2.2"/></svg>',
    sim: '<svg viewBox="0 0 48 48"><rect x="6" y="9" width="36" height="26" rx="3" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M20 16v12l10-6z" fill="currentColor"/><path d="M16 41h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    cad: '<svg viewBox="0 0 48 48"><path d="M4 24h9l4-8 6 16 5-8h16" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="40" cy="24" r="4" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
  };
  const [tia, plcsim, cade] = software;
  return `<div class="sw">
    <div class="sw__track">
      <h4 class="sw__track-title">Programme de l'automate</h4>
      <div class="sw__row">
        ${tool(tia.name, tia.role, g.tia)}
        <div class="sw__link" aria-hidden="true">${ICONS.arrow}<span>programme à tester</span></div>
        ${tool(plcsim.name, plcsim.role, g.sim)}
      </div>
    </div>
    <div class="sw__track">
      <h4 class="sw__track-title">Circuit électrique</h4>
      <div class="sw__row">${tool(cade.name, cade.role, g.cad)}</div>
    </div>
  </div>`;
}

export function chainStrip(items: readonly string[], cls = ''): string {
  return `<ol class="chain ${cls}">${items.map((s) => `<li>${s}</li>`).join('')}</ol>`;
}

export function sourceChainStrip(): string {
  return chainStrip(sourceChain, 'chain--quote');
}

/** Planificateur : valeurs exactes du dossier + barres. */
export function ganttChart(): string {
  const cell = (v: number | undefined, suffix = '') => (v === undefined ? '<td class="gt-na">—</td>' : `<td>${v}${suffix}</td>`);
  const periods = Array.from({ length: ganttPeriods }, (_, i) => `<span>${i + 1}</span>`).join('');
  const rows = gantt
    .map((t) => {
      const plan = `<span class="gt-bar gt-bar--plan" style="--s:${t.planStart};--d:${t.planDuration}" title="Plan : début ${t.planStart}, durée ${t.planDuration}"></span>`;
      const act =
        t.actualStart !== undefined && t.actualDuration !== undefined
          ? `<span class="gt-bar gt-bar--act" data-step="1" style="--s:${t.actualStart};--d:${t.actualDuration}" title="Réel : début ${t.actualStart}, durée ${t.actualDuration}, ${t.percent} % accompli"></span>`
          : '';
      return `<tr>
        <th scope="row">${t.name}</th>
        ${cell(t.planStart)}${cell(t.planDuration)}
        ${cell(t.actualStart)}${cell(t.actualDuration)}${t.percent === undefined ? '<td class="gt-na">—</td>' : `<td class="gt-pct">${t.percent} %</td>`}
        <td class="gt-track"><div class="gt-lane">${plan}${act}</div></td>
      </tr>`;
    })
    .join('');
  return `<table class="gantt">
    <caption class="sr-only">Planificateur du projet : valeurs reprises du document source ; l'unité des périodes n'y est pas précisée.</caption>
    <thead>
      <tr class="gt-groups"><th></th><th colspan="2" scope="colgroup">Plan</th><th colspan="3" scope="colgroup">Réel</th><th class="gt-axis-cap">Périodes de planification (unité non précisée)</th></tr>
      <tr><th scope="col">Tâche</th><th scope="col">Début</th><th scope="col">Durée</th><th scope="col">Début</th><th scope="col">Durée</th><th scope="col">Accompli</th><th scope="col" class="gt-axis"><div class="gt-ticks">${periods}</div></th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}
