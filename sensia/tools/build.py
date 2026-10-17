#!/usr/bin/env python3
"""
Assemble les présentations SENSIA en fichiers HTML UNIQUES et autonomes.

  python3 tools/build.py                 # depuis le dossier sensia/ : toutes les présentations
  python3 tools/build.py soutenance      # une seule

Pour chaque présentation, produit dans ../telechargement/ :
  - <nom>.html             Three.js chargé depuis jsDelivr (Internet requis),
                           code de l'application lisible et commenté.
  - <nom>-hors-ligne.html  Variante sans Internet (Three.js inclus, code minifié).
                           Nécessite Node.js (npx esbuild).

Les sources modulaires restent la référence : modifiez-les, puis relancez ce script.
"""
import base64
import mimetypes
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT.parent / 'telechargement'
THREE_VERSION = '0.170.0'
CDN = f'https://cdn.jsdelivr.net/npm/three@{THREE_VERSION}'

COMMON = [
    'js/util.js',
    'js/models/effects.js',
    'js/models/glasses.js',
    'js/models/modules.js',
]

TARGETS = {
    # Présentation des trois fonctions (10 diapositives)
    'presentation': {
        'out': 'SENSIA-presentation-3D',
        'dir': '.',
        'html': 'index.html',
        'css': 'css/style.css',
        'entry': 'js/main.js',
        'modules': COMMON + [
            'js/models/props.js',
            'js/models/person.js',
            'js/engine.js',
            'js/scenes/base.js',
            'js/scenes/intro.js',
            'js/scenes/hero.js',
            'js/scenes/exploded.js',
            'js/scenes/obstacle.js',
            'js/scenes/darkness.js',
            'js/scenes/color.js',
            'js/ui/hud.js',
            'js/ui/speech.js',
            'js/ui/synoptic.js',
            'js/main.js',
        ],
        'title': 'présentation des fonctions',
    },
    # Soutenance (14 diapositives, structure du PowerPoint)
    'soutenance': {
        'out': 'SENSIA-soutenance-3D',
        'dir': 'soutenance',
        'html': 'soutenance/index.html',
        'css': 'soutenance/css/deck.css',
        'entry': 'soutenance/js/deck.js',
        'modules': COMMON + [
            'js/engine.js',
            'soutenance/js/showroom.js',
            'soutenance/js/gantt.js',
            'soutenance/js/deck.js',
        ],
        'title': 'soutenance',
    },
}

# import … from '…'; (y compris sur plusieurs lignes)
IMPORT_RE = re.compile(r"^import\s[^;]*?from\s+'([^']+)';[ \t]*$", re.M)
EXPORT_RE = re.compile(r'^export\s+(?:async\s+)?(?:function\*?|class|const|let)\s+(\w+)', re.M)


def bundle_readable(modules) -> str:
    """Concatène les modules : chaque fichier devient une fonction isolée
    qui renvoie ses exports (pas de collision de noms entre fichiers)."""
    hoisted, body = [], []
    for rel in modules:
        src = (ROOT / rel).read_text(encoding='utf-8')
        for m in IMPORT_RE.finditer(src):
            line = ' '.join(m.group(0).split())
            if m.group(1).startswith('three') and line not in hoisted:
                hoisted.append(line)
        code = IMPORT_RE.sub('', src).strip('\n')
        exports = EXPORT_RE.findall(code)
        code = re.sub(r'^export\s+', '', code, flags=re.M)
        name = '__' + re.sub(r'\W', '_', rel[:-3])
        bar = '═' * 70
        if exports:
            inner = '\n'.join('  ' + l if l else '' for l in code.split('\n'))
            body.append(
                f'// {bar}\n// {rel}\n// {bar}\n'
                f'const {name} = (() => {{\n{inner}\n  return {{ {", ".join(exports)} }};\n}})();\n'
                f'const {{ {", ".join(exports)} }} = {name};\n'
            )
        else:  # point d'entrée
            body.append(f"// {bar}\n// {rel} (point d'entrée)\n// {bar}\n{code}\n")
    return '\n'.join(hoisted) + '\n\n' + '\n'.join(body)


def bundle_offline(entry) -> str | None:
    """Bundle minifié incluant Three.js (via esbuild, si Node.js est présent)."""
    npx = shutil.which('npx')
    if not npx:
        return None
    out = ROOT / 'tools' / '.offline.js'
    cmd = [npx, '--yes', 'esbuild@0.24.0', entry, '--bundle', '--format=iife', '--minify',
           '--alias:three=./vendor/three/three.module.min.js', '--alias:three/addons=./vendor/three/addons',
           f'--outfile={out}']
    try:
        subprocess.run(cmd, cwd=ROOT, check=True, capture_output=True)
    except (subprocess.CalledProcessError, OSError) as e:
        print('esbuild indisponible, variante hors ligne ignorée :', e, file=sys.stderr)
        return None
    js = out.read_text(encoding='utf-8')
    out.unlink()
    return js


def data_uri(path: pathlib.Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()


def page(t, js: str, module: bool, importmap: bool) -> str:
    html = (ROOT / t['html']).read_text(encoding='utf-8')
    css = (ROOT / t['css']).read_text(encoding='utf-8')
    base = ROOT / t['dir']
    html = re.sub(r'<link rel="stylesheet" href="css/[^"]+">', lambda _: f'<style>\n{css}\n</style>', html)
    imap = (f'<script type="importmap">\n{{ "imports": {{ "three": "{CDN}/build/three.module.min.js", '
            f'"three/addons/": "{CDN}/examples/jsm/" }} }}\n</script>') if importmap else ''
    html = re.sub(r'<script type="importmap">.*?</script>', lambda _: imap, html, flags=re.S)
    tag = '<script type="module">' if module else '<script>'
    js = js.replace('</script', '<\\/script')
    html = re.sub(r'<script type="module" src="js/[^"]+"></script>', lambda _: f'{tag}\n{js}\n</script>', html)
    html = re.sub(r'src="(assets/[^"]+)"', lambda m: f'src="{data_uri(base / m.group(1))}"', html)
    html = html.replace('<!--BODY-->\n', '').replace('<!--/BODY-->\n', '')
    html = html.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    return html


def build(key):
    t = TARGETS[key]
    banner = (f'/*\n * SENSIA — Lunettes intelligentes · {t["title"]} interactive en 3D\n'
              ' * Fichier unique généré par tools/build.py à partir des sources de sensia/.\n'
              f' * Three.js r{THREE_VERSION.split(".")[1]} chargé depuis jsDelivr (connexion Internet requise).\n */\n')
    target = OUT / f'{t["out"]}.html'
    target.write_text(page(t, banner + bundle_readable(t['modules']), True, True), encoding='utf-8')
    print('→', target)
    offline = bundle_offline(t['entry'])
    if offline:
        target = OUT / f'{t["out"]}-hors-ligne.html'
        target.write_text(page(t, offline, False, False), encoding='utf-8')
        print('→', target)


def main():
    OUT.mkdir(exist_ok=True)
    keys = sys.argv[1:] or list(TARGETS)
    for k in keys:
        build(k)


if __name__ == '__main__':
    main()
