#!/usr/bin/env python3
"""
Assemble la présentation SENSIA en UN SEUL fichier HTML autonome.

  python3 tools/build.py            # depuis le dossier sensia/

Produit dans ../telechargement/ :
  - SENSIA-presentation-3D.html             Three.js chargé via CDN (jsDelivr),
                                             code de l'application lisible et commenté.
  - SENSIA-presentation-3D-hors-ligne.html  Variante sans Internet (Three.js inclus,
                                             code minifié). Nécessite Node.js (npx esbuild).

Les sources modulaires (js/, css/) restent la référence : modifiez-les,
puis relancez ce script.
"""
import base64
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT.parent / 'telechargement'
THREE_VERSION = '0.170.0'
CDN = f'https://cdn.jsdelivr.net/npm/three@{THREE_VERSION}'

# Ordre des modules : chaque module ne dépend que des précédents.
MODULES = [
    'js/util.js',
    'js/models/effects.js',
    'js/models/glasses.js',
    'js/models/modules.js',
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
]

IMPORT_RE = re.compile(r"^import\s.+?from\s+'([^']+)';\s*$", re.M)
EXPORT_RE = re.compile(r'^export\s+(?:async\s+)?(?:function\*?|class|const|let)\s+(\w+)', re.M)


def bundle_readable() -> str:
    """Concatène les modules : chaque fichier devient une fonction isolée
    qui renvoie ses exports (pas de collision de noms entre fichiers)."""
    hoisted, body = [], []
    for rel in MODULES:
        src = (ROOT / rel).read_text(encoding='utf-8')
        for m in IMPORT_RE.finditer(src):
            line = m.group(0).strip()
            if m.group(1).startswith('three') and line not in hoisted:
                hoisted.append(line)
        code = IMPORT_RE.sub('', src).strip('\n')
        exports = EXPORT_RE.findall(code)
        code = re.sub(r'^export\s+', '', code, flags=re.M)
        name = '__' + re.sub(r'\W', '_', rel[3:-3])
        bar = '═' * 70
        if exports:
            inner = '\n'.join('  ' + l if l else '' for l in code.split('\n'))
            body.append(
                f'// {bar}\n// {rel}\n// {bar}\n'
                f'const {name} = (() => {{\n{inner}\n  return {{ {", ".join(exports)} }};\n}})();\n'
                f'const {{ {", ".join(exports)} }} = {name};\n'
            )
        else:  # point d'entrée (main.js)
            body.append(f'// {bar}\n// {rel} (point d\'entrée)\n// {bar}\n{code}\n')
    return '\n'.join(hoisted) + '\n\n' + '\n'.join(body)


def bundle_offline() -> str | None:
    """Bundle minifié incluant Three.js (via esbuild, si Node.js est présent)."""
    npx = shutil.which('npx')
    if not npx:
        return None
    out = ROOT / 'tools' / '.offline.js'
    cmd = [npx, '--yes', 'esbuild@0.24.0', 'js/main.js', '--bundle', '--format=iife', '--minify',
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


def page(js: str, module: bool, importmap: bool) -> str:
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'css/style.css').read_text(encoding='utf-8')
    img = base64.b64encode((ROOT / 'assets/prototype-sensia.jpg').read_bytes()).decode()
    html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>\n{css}\n</style>')
    imap = (f'<script type="importmap">\n{{ "imports": {{ "three": "{CDN}/build/three.module.min.js", '
            f'"three/addons/": "{CDN}/examples/jsm/" }} }}\n</script>') if importmap else ''
    html = re.sub(r'<script type="importmap">.*?</script>', lambda _: imap, html, flags=re.S)
    tag = '<script type="module">' if module else '<script>'
    js = js.replace('</script', '<\\/script')
    html = html.replace('<script type="module" src="js/main.js"></script>', f'{tag}\n{js}\n</script>')
    html = html.replace('src="assets/prototype-sensia.jpg"', f'src="data:image/jpeg;base64,{img}"')
    html = html.replace('<!--BODY-->\n', '').replace('<!--/BODY-->\n', '')
    html = html.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    return html


def main():
    OUT.mkdir(exist_ok=True)
    readable = bundle_readable()
    banner = ('/*\n * SENSIA — Lunettes intelligentes · présentation technique interactive en 3D\n'
              ' * Fichier unique généré par tools/build.py à partir des sources de sensia/.\n'
              f' * Three.js r{THREE_VERSION.split(".")[1]} chargé depuis jsDelivr (connexion Internet requise).\n */\n')
    (OUT / 'SENSIA-presentation-3D.html').write_text(page(banner + readable, True, True), encoding='utf-8')
    print('→', OUT / 'SENSIA-presentation-3D.html')
    offline = bundle_offline()
    if offline:
        (OUT / 'SENSIA-presentation-3D-hors-ligne.html').write_text(page(offline, False, False), encoding='utf-8')
        print('→', OUT / 'SENSIA-presentation-3D-hors-ligne.html')


if __name__ == '__main__':
    main()
