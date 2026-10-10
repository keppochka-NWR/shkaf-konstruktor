# -*- coding: utf-8 -*-
# Rafix shelf connector for the 3D studio (n5-hardware3d): housing + connecting pin, two GLB in MILLIMETRES
# (like the Bazis library in models/hardware/bazis: placed natively by Part.model origin + quat, no scale).
# Sizes: drilling from the Bazis kitchens (kitchenRafix.ts RAFIX: housing D20 x 13 in the shelf underside, centre 9.5 from the shelf end;
# pin D5 x 13 into the side panel, 8 above the shelf underside) and Hafele Rafix 20 catalogue (drill D20, depth 12.7, dim. A 8.0
# for 16 mm boards). Housing height 12.5, rim, PZ cross and the pin head are ESTIMATES (no manufacturer drawing at hand).
# Run: blender --background --python scripts/blender_n5_hardware.py -- <out_dir> [preview]
# Local axes (three.js / glTF, mm) = Bazis instance axes of the Rafix record (quat left [0,1,0,0], right [0,0,0,1]):
#   x = 0 at the side panel face, +x into the shelf; y = 0 at the shelf underside, -y UP into the shelf (local Y looks down);
#   z along the shelf depth, 0 = the Bazis point.
import bpy, bmesh, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0]; PREVIEW = len(argv) > 1 and argv[1] == "preview"
os.makedirs(OUT, exist_ok=True)
MM = 1.0  # GLB in millimetres
parts = []


def B(x, y, z):  # three mm -> Blender units (glTF export with +Y up gives back three coordinates)
    return (x * MM, -z * MM, y * MM)


def circle(cx, cy, r, n=40):
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def prism(poly, plane, d0, d1, mat, bevel=0.3):
    """Extrude a 2D outline. plane: 'yz' (u = y, v = z, depth along x), 'xz' (u = x, v = z, depth y), 'xy' (u = x, v = y, depth z)."""
    def P(u, v, w):
        if plane == "yz": return B(w, u, v)
        if plane == "xz": return B(u, w, v)
        return B(u, v, w)
    bm = bmesh.new()
    f0 = bm.faces.new([bm.verts.new(P(u, v, d0)) for u, v in poly])
    f1 = bm.faces.new([bm.verts.new(P(u, v, d1)) for u, v in poly][::-1])
    n = len(poly); vs0, vs1 = f0.verts, list(f1.verts)[::-1]
    for i in range(n):
        bm.faces.new([vs0[i], vs0[(i + 1) % n], vs1[(i + 1) % n], vs1[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("p"); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new("p", me); bpy.context.scene.collection.objects.link(o)
    if bevel:
        m = o.modifiers.new("b", "BEVEL"); m.width = bevel * MM; m.segments = 2; m.limit_method = "ANGLE"; m.angle_limit = math.radians(50)
    parts.append(o); return o


def cyl(r, axis, c1, c2, a0, a1, mat, n=36, bevel=0.3):
    plane = {"x": "yz", "y": "xz", "z": "xy"}[axis]
    return prism(circle(c1, c2, r, n), plane, a0, a1, mat, bevel)


def material(name, rgb_linear, metallic, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb_linear, 1); b.inputs["Metallic"].default_value = metallic; b.inputs["Roughness"].default_value = rough
    return m


def join(name):
    global parts
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    parts = []
    return o


def export(o, path):
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_materials="EXPORT", export_yup=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# Base Color in LINEAR space (sRGB 0.93 white plastic -> 0.85; sRGB 0.80 zinc -> 0.60; dark recess sRGB 0.25 -> 0.05)
def mats():
    return (material("rafix_plastic", (0.85, 0.85, 0.83), 0.0, 0.5), material("rafix_zinc", (0.60, 0.62, 0.64), 0.8, 0.38),
            material("rafix_dark", (0.05, 0.05, 0.055), 0.0, 0.6))


CX, H = 9.5, 12.5  # housing centre from the side panel, housing height (drilling 13)
# ---------- housing: D20 body sunk into the shelf from the underside, rim on the face, PZ cross + cam window ----------
reset(); white, zinc, dark = mats()
cyl(9.9, "y", CX, 0, -H, -0.6, white, 48, 0.4)                    # body D19.8 (hole D20)
cyl(10.0, "y", CX, 0, -0.6, 0.0, white, 48, 0.2)                  # face rim D20, flush with the shelf underside
cyl(6.2, "y", CX, 0, -0.05, 0.25, zinc, 40, 0.2)                  # zinc cam disc in the face
prism([(CX - 4.2, -0.6), (CX + 4.2, -0.6), (CX + 4.2, 0.6), (CX - 4.2, 0.6)], "xz", 0.2, 0.32, dark, 0)   # PZ cross
prism([(CX - 0.6, -4.2), (CX + 0.6, -4.2), (CX + 0.6, 4.2), (CX - 0.6, 4.2)], "xz", 0.2, 0.32, dark, 0)
prism([(CX + 6.6, -1.2), (CX + 8.8, 0), (CX + 6.6, 1.2)], "xz", -0.02, 0.06, dark, 0)               # arrow mark to the shelf
prism([(0.4, -3.3), (CX - 3, -3.3), (CX - 3, 3.3), (0.4, 3.3)], "xz", -10.6, -5.4, dark, 0.2)       # window for the pin head
export(join("rafix_housing"), os.path.join(OUT, "rafix_housing.glb"))

# ---------- connecting pin: D5 thread 13 in the side panel, collar on the panel face, neck + head caught by the cam ----------
reset(); white, zinc, dark = mats()
Y = -8.0  # pin axis: 8 above the shelf underside (local -y is up)
cyl(2.1, "x", Y, 0, -13, -0.6, zinc, 24, 0.3)                     # thread core
for k in range(11):
    x0 = -12.6 + k * 1.1
    cyl(2.5, "x", Y, 0, x0, x0 + 0.5, zinc, 24, 0.15)             # thread crests D5
cyl(3.5, "x", Y, 0, -0.6, 0.8, zinc, 32, 0.3)                     # collar on the panel face
cyl(2.0, "x", Y, 0, 0.8, CX - 2.2, zinc, 24, 0.2)                 # neck
cyl(3.2, "x", Y, 0, CX - 2.2, CX + 0.4, zinc, 32, 0.6)            # head in the cam
export(join("rafix_pin"), os.path.join(OUT, "rafix_pin.glb"))

if PREVIEW:
    import mathutils
    for name in ("rafix_housing", "rafix_pin"):
        reset()
        bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, name + ".glb"))
        o = [x for x in bpy.context.scene.objects if x.type == "MESH"][0]
        sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 48; sc.render.resolution_x, sc.render.resolution_y = 700, 560
        w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
        w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.82, 0.85, 1); w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
        bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]; c = sum(bb, mathutils.Vector()) / 8
        size = max((bb[6] - bb[0]).length, 5)
        for off, e in (((1, -1, -1.2), 8), ((-1, -0.6, 0.6), 3)):
            bpy.ops.object.light_add(type="AREA", location=c + mathutils.Vector(off) * size); l = bpy.context.active_object
            l.data.energy = e * (size / 0.1) ** 2; l.data.size = size  # scene in mm: same formula as blender_hardware.py with size in mm
            l.rotation_euler = (c - l.location).to_track_quat("-Z", "Y").to_euler()
        view = mathutils.Vector((1.0, -1.2, -0.9))
        bpy.ops.object.camera_add(location=c + view * size); cam = bpy.context.active_object; sc.camera = cam
        cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler(); cam.data.lens = 60; cam.data.clip_end = 10000
        bpy.context.view_layer.update()
        loc, _ = cam.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), [v for p in bb for v in p]); cam.location = c + (loc - c) * 1.2
        sc.render.filepath = os.path.join(OUT, "preview_" + name + ".png"); bpy.ops.render.render(write_still=True)
print("done")
