"""Adapt sunburn's CC BY 3.0 Spider to a compact, skinned glTF for the game.
Source .blend is kept intact. Never execute scripts embedded in the source file.
Requires the isolated .asset-tools environment (bpy 5.1.2).
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'artifacts/asset-sources/spider/Spider.blend'), load_ui=False, use_scripts=False)
body = bpy.data.objects['body-6']
legs = [o for o in bpy.data.objects if o.name.startswith('leg-3') and abs(o.location.x) < 10]
keep = [body] + legs
for obj in list(bpy.data.objects):
    if obj not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.view_layer.update()
# Bake world coordinates once; source contains an off-stage duplicate leg.
for obj in keep:
    obj.data = obj.data.copy()
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    for vertex in obj.data.vertices:
        vertex.co *= 0.19
    bpy.context.view_layer.objects.active = obj
    decimate = obj.modifiers.new('Mobile retopology', 'DECIMATE')
    decimate.ratio = (4200 if obj == body else 650) / len(obj.data.polygons)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
floor = min(v.co.z for obj in legs for v in obj.data.vertices)
for obj in keep:
    for vertex in obj.data.vertices:
        vertex.co.z -= floor
# One material for the body, another for limbs. Pigment is small geometry, no image requests.
def mat(name, color, roughness=0.32):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    node = material.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    return material
shell = mat('Widow obsidian', (0.015, 0.012, 0.018))
limbs = mat('Articulated chitin', (0.028, 0.018, 0.022), 0.4)
for obj in keep:
    obj.data.materials.clear()
    obj.data.materials.append(shell if obj == body else limbs)
# Leg roots in the original mesh lie around the cephalothorax. Add two bones per limb.
arm_data = bpy.data.armatures.new('Widow skeleton')
arm = bpy.data.objects.new('WidowRig', arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
root = arm_data.edit_bones.new('body')
root.head = (0, 0, 0.35); root.tail = (0, 0, 0.5)
leg_info = []
legs.sort(key=lambda o: (o.location.x, o.name))
for i, obj in enumerate(legs):
    vertices = [v.co.copy() for v in obj.data.vertices]
    center = sum(vertices, Vector()) / len(vertices)
    side = -1 if center.x < 0 else 1
    hip = Vector((side * 0.12, center.y * 0.35, 0.42))
    outer = [v for v in vertices if abs(v.x) > 0.3]
    knee = max(outer, key=lambda v: v.z).copy()
    foot = min(outer, key=lambda v: v.z).copy()
    upper = arm_data.edit_bones.new(f'leg_{i}')
    upper.head = hip; upper.tail = knee; upper.parent = root
    lower = arm_data.edit_bones.new(f'knee_{i}')
    lower.head = knee; lower.tail = foot; lower.parent = upper
    leg_info.append((obj, hip, knee, foot))
bpy.ops.object.mode_set(mode='OBJECT')
for i, (obj, hip, knee, foot) in enumerate(leg_info):
    upper = obj.vertex_groups.new(name=f'leg_{i}')
    lower = obj.vertex_groups.new(name=f'knee_{i}')
    for v in obj.data.vertices:
        # Blend around the sculpted knee; preserve the author's limb silhouette.
        upper_distance = (v.co - hip).length
        lower_distance = (v.co - foot).length
        weight = max(0, min(1, (upper_distance / max(0.001, upper_distance + lower_distance) - 0.35) / 0.3))
        upper.add([v.index], 1 - weight, 'REPLACE')
        lower.add([v.index], weight, 'REPLACE')
    modifier = obj.modifiers.new('Skeleton', 'ARMATURE'); modifier.object = arm
body.vertex_groups.new(name='body').add(list(range(len(body.data.vertices))), 1, 'REPLACE')
body.modifiers.new('Skeleton', 'ARMATURE').object = arm
# Join material-compatible geometry into one skinned mesh (2 primitives).
bpy.ops.object.select_all(action='DESELECT')
for obj in keep: obj.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = 'WidowMesh'; body.parent = arm
# Dorsal pigment belongs to the shell surface, never floating sphere plates.
red = mat('Karakurt coral spots', (0.62, 0.055, 0.018), 0.42)
body.data.materials.append(red)
red_index = len(body.data.materials) - 1
body.data.update()
shell_faces = [p for p in body.data.polygons if body.data.materials[p.material_index] == shell and p.normal.z > 0.25]
peak = max((p.center for p in shell_faces), key=lambda p: p.z)
marks = [(0, peak.y, 0.045, 0.055), (-0.075, peak.y - 0.045, 0.035, 0.045), (0.075, peak.y - 0.045, 0.035, 0.045)]
for polygon in shell_faces:
    p = polygon.center
    if any(((p.x - x) / rx) ** 2 + ((p.y - y) / ry) ** 2 < 1 for x, y, rx, ry in marks):
        polygon.material_index = red_index
# glTF converts Blender Z-up to Three Y-up. Positive Blender Y becomes forward -Z.
arm.rotation_euler.z = math.pi
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); body.select_set(True)
path = ROOT / 'public/models/spider.glb'
bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_animations=False, export_yup=True, export_extras=True)
print('EXPORTED', path, path.stat().st_size, 'bytes', len(body.data.polygons), 'polygons', len(legs), 'legs')
