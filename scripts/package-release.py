"""Package only the verified static build, never the enclosing D:/ repository."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
ARTIFACTS = ROOT / 'artifacts'
assert (DIST / 'index.html').is_file(), 'Run npm run build first'
ARTIFACTS.mkdir(exist_ok=True)
files = sorted(p for p in DIST.rglob('*') if p.is_file())
assert files and all(p.suffix in {'.html', '.js', '.css', '.svg', '.txt', '.glb', '.json'} for p in files)
assert all((DIST / 'models' / name).is_file() for name in ['hand.glb', 'spider.glb', 'SOURCES.json'])
archive = ARTIFACTS / 'quiet-human-web.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
    for path in files:
        output.write(path, path.relative_to(DIST).as_posix())
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None
    assert 'index.html' in output.namelist()
report = {
    'archive': 'artifacts/quiet-human-web.zip',
    'bytes': archive.stat().st_size,
    'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'files': [{'path': p.relative_to(DIST).as_posix(), 'bytes': p.stat().st_size,
               'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
    'public_url': None,
    'publication_status': 'Not deployed: GitHub Pages selected; remote publication not confirmed.'
}
(ARTIFACTS / 'release-manifest.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
