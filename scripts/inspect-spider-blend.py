from pathlib import Path
import bpy
root = Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(root / 'artifacts/asset-sources/spider/Spider.blend'), load_ui=False, use_scripts=False)
for obj in bpy.data.objects:
    print('OBJECT', obj.name, obj.type, 'location', tuple(obj.location), 'dims', tuple(obj.dimensions))
    if obj.type == 'MESH':
        print('  vertices', len(obj.data.vertices), 'polygons', len(obj.data.polygons), 'materials', [m.name for m in obj.data.materials if m])
        from mathutils import Vector
        bounds = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        print('  world bounds', [min(v[i] for v in bounds) for i in range(3)], [max(v[i] for v in bounds) for i in range(3)])
        print('  rotation', tuple(obj.rotation_euler), 'scale', tuple(obj.scale))
        print('  groups', [(g.index, g.name) for g in obj.vertex_groups])
        print('  modifiers', [(m.type, m.name) for m in obj.modifiers])
    if obj.type == 'ARMATURE':
        print('  bones', [(b.name, tuple(b.head_local), tuple(b.tail_local)) for b in obj.data.bones])
for mat in bpy.data.materials:
    print('MATERIAL', mat.name, tuple(mat.diffuse_color))
