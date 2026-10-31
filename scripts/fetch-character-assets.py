"""Download public, redistributable source assets. Never uses login or viewer caches."""
from pathlib import Path
from urllib.request import Request, urlopen
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    ('public/models/hand.glb', 'https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/assets/profiles/generic-hand/right.glb'),
    ('artifacts/asset-sources/spider.7z', 'https://opengameart.org/sites/default/files/spider.7z'),
    ('public/models/WEBXR-LICENSE.txt', 'https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/assets/LICENSE.md'),
]

if __name__ == '__main__':
    for name, url in SOURCES:
        path = ROOT / name
        if path.exists():
            print(f'Kept {name}: {path.stat().st_size} bytes')
            continue
        with urlopen(Request(url, headers={'User-Agent': 'QuietHumanAssetImport/1.0'}), timeout=60) as response:
            data = response.read(40_000_000)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(json.dumps({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'url': url}))
