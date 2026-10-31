from pathlib import Path
from urllib.request import urlopen
import py7zr
import json
root = Path(__file__).resolve().parent.parent
with py7zr.SevenZipFile(root / 'artifacts/asset-sources/spider.7z', 'r') as archive:
    for item in archive.list():
        print(item.filename, item.uncompressed)
    # Archive contains data assets only; reject traversal before extraction.
    names = archive.getnames()
    if any('..' in Path(n).parts or Path(n).is_absolute() for n in names):
        raise ValueError('Unsafe asset archive path')
    archive.extractall(root / 'artifacts/asset-sources/spider')
with urlopen('https://api.github.com/repos/castle-engine/demo-models/git/trees/master?recursive=1', timeout=30) as response:
    tree = json.load(response)['tree']
for item in tree:
    if 'spider' in item['path'].lower():
        print('castle:', item['path'], item.get('size'))
