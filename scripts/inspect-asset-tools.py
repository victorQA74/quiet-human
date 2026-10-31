import importlib.util
import shutil
import sys
print('Python:', sys.version)
for name in ['7z', '7za', 'blender', 'assimp']:
    print(name, shutil.which(name))
for name in ['py7zr', 'bpy']:
    print(name, importlib.util.find_spec(name))
