# -*- coding: utf-8 -*-
# Two renders of a profile model for the check sheets: straight end view (orthographic) and a 3/4 view of a 150 mm piece.
# blender --background --python scripts/blender_profile_views.py -- <model.glb> <out_dir> <name>
# End view image: x = a, y up = -b (Blender Y); profile_sheet.py turns it to the drawing orientation.
import bpy, mathutils, sys

glb, out, name = sys.argv[sys.argv.index("--") + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
obj = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
mat = bpy.data.materials.new("alu"); mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.62, 0.64, 0.66, 1)  # linear
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.3
obj.data.materials.clear(); obj.data.materials.append(mat)
dims = obj.dimensions
ax = max(range(3), key=lambda i: dims[i])
s = [1, 1, 1]; s[ax] = 0.15 / dims[ax]; obj.scale = s
bpy.context.view_layer.update()
bb = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
centre = sum(bb, mathutils.Vector()) / 8
size = max(d for i, d in enumerate(obj.dimensions) if i != ax)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.samples = 96; sc.cycles.device = "CPU"
sc.render.resolution_x, sc.render.resolution_y = 1400, 1000
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.93, 0.94, 0.96, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
axis = mathutils.Vector([1 if i == ax else 0 for i in range(3)])
up = mathutils.Vector((0, 1, 0)) if ax == 2 else mathutils.Vector((0, 0, 1))
side = axis.cross(up)
end = centre + axis * 0.075
for off, e in ((axis * 0.3 + up * 0.25 + side * 0.2, 60), (axis * 0.3 - side * 0.25, 30), (-axis * 0.2 + up * 0.3, 20)):
    bpy.ops.object.light_add(type="AREA", location=centre + off)
    l = bpy.context.active_object; l.data.energy = e; l.data.size = 0.25
    l.rotation_euler = (centre - l.location).to_track_quat("-Z", "Y").to_euler()


def shoot(loc, target, path, ortho):
    bpy.ops.object.camera_add(location=loc); cam = bpy.context.active_object; sc.camera = cam
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    if ortho:
        cam.data.type = "ORTHO"; cam.data.ortho_scale = size * 1.25 * 1.4  # frame is 1400 x 1000: fit the larger section side in the shorter frame side
    else:
        cam.data.lens = 70
        bpy.context.view_layer.update()
        loc2, _ = cam.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), [v for c in bb for v in c])
        cam.location = centre + (loc2 - centre) * 1.12
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


shoot(end + axis * 0.2, end, f"{out}/{name}_end.png", True)
shoot(centre + axis * 0.22 + up * 0.12 + side * 0.16, centre, f"{out}/{name}_iso.png", False)
