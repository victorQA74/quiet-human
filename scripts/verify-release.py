"""Read-only integrity check of delivered artifacts and recorded production results."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
artifacts = root / 'artifacts'
manifest = json.loads((artifacts / 'release-manifest.json').read_text(encoding='utf-8'))
archive = root / manifest['archive']
assert archive.stat().st_size == manifest['bytes']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
dist_files = sorted(p.relative_to(root / 'dist').as_posix() for p in (root / 'dist').rglob('*') if p.is_file())
required_models = {'models/hand.glb', 'models/spider.glb', 'models/SOURCES.json', 'models/WEBXR-LICENSE.txt'}
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert sorted(z.namelist()) == sorted(item['path'] for item in manifest['files']) == dist_files
    assert required_models.issubset(z.namelist()), 'Character assets/licenses missing from release'
    for relative in required_models:
        assert z.read(relative) == (root / 'public' / relative).read_bytes(), f'Stale character asset: {relative}'
    for item in manifest['files']:
        disk = root / 'dist' / item['path']
        assert disk.is_file()
        content = disk.read_bytes()
        assert len(content) == item['bytes']
        assert hashlib.sha256(content).hexdigest() == item['sha256']
        assert z.read(item['path']) == content
video = json.loads((artifacts / 'video-report.json').read_text(encoding='utf-8'))
assert video['seconds'] == 30
assert (root / video['video']).stat().st_size == video['bytes'] > 100000
production = json.loads((artifacts / 'production-report.json').read_text(encoding='utf-8'))
assert production['issues'] == []
assert production['production']['externalRequests'] == []
assert all(production['production'][k] is True for k in ['html', 'diagnosticsAbsent', 'realRescue', 'web', 'pause'])
assert all(production['mobile'][k] is True for k in ['joystick', 'web', 'noOverflow'])
for name in ['README.md', 'docs/PRODUCT_SPEC.md', 'docs/TECH_SPEC.md', 'docs/CODE_MAP.md', 'docs/DECISIONS.md', 'docs/DEPLOYMENT.md', 'docs/QA_REPORT.md']:
    assert (root / name).stat().st_size > 100
assert manifest['public_url'] is None
print('PASS: ZIP CRC, SHA-256, exact dist/archive match, video size/report (30s), production report, delivery documents.')
print('PUBLIC DEPLOYMENT: BLOCKED, no public URL. Local game artifacts are ready.')
