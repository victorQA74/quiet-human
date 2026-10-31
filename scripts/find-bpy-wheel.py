from urllib.request import urlopen
import json
with urlopen('https://pypi.org/pypi/bpy/json', timeout=30) as response:
    meta = json.load(response)
for version, files in meta['releases'].items():
    for item in files:
        if 'win_amd64' in item['filename']:
            print(version, item['filename'], item['size'])
