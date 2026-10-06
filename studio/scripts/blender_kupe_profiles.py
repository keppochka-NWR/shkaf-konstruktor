# -*- coding: utf-8 -*-
# Profiles of Aristo sliding doors for the 3D studio: Blender headless -> GLB + preview renders.
# Run: blender --background --python scripts/blender_kupe_profiles.py -- <out_dir> [preview]
# Cross-section is built in mm in Blender XY: x = a (across), y = -b (depth, front = larger b), length along Z 0..1000 mm.
# glTF export maps Blender (x, y, z) -> three (x, z, -y), so in three.js: x = a, y = length, z = b.
# Shapes follow the catalogue illustrations (assets/sections/*.jpg); overall sizes come from the Aristo technical catalogue
# (top track 81.6 x 35 mm) and the price dims (handle face 30 mm for C/I, 12 mm for Slim/GRACE). Not a factory drawing.
import bpy, bmesh, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0]
PREVIEW = len(argv) > 1 and argv[1] == "preview"
os.makedirs(OUT, exist_ok=True)
MM = 0.001
LENGTH = 1000.0


def rect(a0, b0, a1, b1):
    return [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]


def arc_band(ca, cb, r_out, r_in, d0, d1, n=28):
    """Curved wall: outer arc from d0 to d1 degrees, then inner arc back."""
    outer = [(ca + r_out * math.cos(math.radians(d0 + (d1 - d0) * i / n)), cb + r_out * math.sin(math.radians(d0 + (d1 - d0) * i / n))) for i in range(n + 1)]
    inner = [(ca + r_in * math.cos(math.radians(d1 - (d1 - d0) * i / n)), cb + r_in * math.sin(math.radians(d1 - (d1 - d0) * i / n))) for i in range(n + 1)]
    return outer + inner


def slot(a0, a1, mid, panel=10.0, wall=1.4):
    """Two flanges that hold a panel of given thickness, centred on depth mid."""
    return [rect(a0, mid + panel / 2, a1, mid + panel / 2 + wall), rect(a0, mid - panel / 2 - wall, a1, mid - panel / 2)]


# a: across (0 = outer edge of the leaf / outer edge of the frame), b: depth (0 = back, max = front facing the room)
SHAPES = {
    # Standard C: wide face 30, C-shaped finger grip on the outer edge, chamber and panel slot toward the insert.
    "handle_c": lambda w=30.0, d=32.0: [
        arc_band(9.5, d - 9.5, 9.5, 7.9, 45, 290),
        rect(9.5, d - 1.6, w, d), rect(6.5, 0, w, 1.6), rect(6.5, 0, 8.1, d - 17.5),
        rect(15, 1.6, 16.4, d - 1.6), *slot(16.4, w, d / 2), rect(16.4, d / 2 - 6.4, 18, d / 2 + 6.4),
    ],    # Standard I / Flat: flat face, I-section, panel slot toward the insert.
    "handle_i": lambda w=30.0, d=26.0: [
        rect(0, d - 1.8, w, d), rect(0, 0, 14, 1.6), rect(2.4, 0, 4.0, d), rect(12.4, 0, 14, d),
        *slot(14, w, d / 2), rect(14, d / 2 - 6.4, 15.6, d / 2 + 6.4),
    ],
    # Slim / GRACE / NOVA: narrow 12 mm face, small rectangular tube with a slot.
    "handle_slim": lambda w=12.0, d=22.0: [
        rect(0, d - 1.4, w, d), rect(0, 0, 1.4, d), rect(0, 0, 5.5, 1.4), rect(4.2, 1.4, 5.5, d - 1.4),
        *slot(5.5, w, d / 2, wall=1.2), rect(5.5, d / 2 - 6.2, 6.8, d / 2 + 6.2),
    ],
    # Horizontal frame (top and bottom): a = along door height from the outer edge, b = depth.
    "frame": lambda h=40.0, d=16.0: [
        rect(0, 0, h - 12, 1.4), rect(0, d - 1.4, h - 12, d), rect(0, 0, 1.4, d), rect(h - 13.4, 0, h - 12, d),
        *slot(h - 12, h, d / 2), rect(10, 1.4, 11.2, d - 1.4),
    ],
    # Divider between inserts: H-section with a slot on each side.
    "divider": lambda h=20.0, d=14.0: [
        rect(0, d / 2 + 5, h, d / 2 + 6.4), rect(0, d / 2 - 6.4, h, d / 2 - 5), rect(h / 2 - 0.8, d / 2 - 6.4, h / 2 + 0.8, d / 2 + 6.4),
    ],
    # Top track: a = height (0 = lower edge, 35 = ceiling), b = depth across the opening (81.6). Two channels for two rows of doors.
    "track_top": lambda t=35.0, s=81.6: [
        rect(t - 1.8, 0, t, s), rect(0, 0, t, 1.6), rect(0, s - 1.6, t, s),
        rect(6, s / 2 - 0.8, t, s / 2 + 0.8), rect(10, s * 0.25 - 0.7, t, s * 0.25 + 0.7), rect(10, s * 0.75 - 0.7, t, s * 0.75 + 0.7),
    ],
    # Bottom track: a = height (0 = floor), b = depth. Base plate with two rounded rails.
    "track_bottom": lambda t=10.0, s=81.6: [
        rect(0, 0, 1.8, s), rect(0, 0, 4, 1.6), rect(0, s - 1.6, 4, s),
        rect(0, s * 0.3 - 1.3, t - 1.3, s * 0.3 + 1.3), arc_band(t - 1.3, s * 0.3, 1.3, 0.01, -90, 90, 12),
        rect(0, s * 0.7 - 1.3, t - 1.3, s * 0.7 + 1.3), arc_band(t - 1.3, s * 0.7, 1.3, 0.01, -90, 90, 12),
    ],
}


def prism(name, poly, length=LENGTH):
    bm = bmesh.new()
    verts = [bm.verts.new((a * MM, -b * MM, 0)) for a, b in poly]
    face = bm.faces.new(verts)
    bmesh.ops.recalc_face_normals(bm, faces=[face])
    if face.normal.z < 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0, 0, length * MM))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build(name, polys):
    parts = [prism(f"{name}_{i}", p) for i, p in enumerate(polys)]
    base = parts[0]
    bpy.context.view_layer.objects.active = base
    for other in parts[1:]:
        mod = base.modifiers.new("union", "BOOLEAN")
        mod.operation = "UNION"
        mod.solver = "EXACT"
        mod.object = other
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(other, do_unlink=True)
    bev = base.modifiers.new("bevel", "BEVEL")
    bev.width = 0.25 * MM
    bev.segments = 2
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier=bev.name)
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    base.name = name
    return base


def export(obj, path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_materials="NONE", export_yup=True)


def render_preview(obj, path):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.device = "CPU"
    scene.render.resolution_x, scene.render.resolution_y = 640, 480
    scene.render.film_transparent = True
    mat = bpy.data.materials.new("alu")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.62, 0.64, 0.66, 1)  # linear values (see Blender pipeline note)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.32
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    import mathutils
    obj.scale = (1, 1, 0.12)  # short 120 mm piece, lying along X like the catalogue pictures
    obj.rotation_euler = (math.pi if obj.name == "track_top" else 0, math.pi / 2, 0)
    bpy.context.view_layer.update()
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.9, 0.92, 0.95, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    bb = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    centre = sum(bb, mathutils.Vector()) / 8
    for off, energy in (((0.25, -0.3, 0.35), 90), ((-0.3, -0.25, 0.2), 45), ((0.05, 0.3, 0.3), 30)):
        bpy.ops.object.light_add(type="AREA", location=centre + mathutils.Vector(off))
        light = bpy.context.active_object
        light.data.energy = energy
        light.data.size = 0.3
        light.rotation_euler = (centre - light.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=centre + mathutils.Vector((0.32, -0.42, 0.30)))
    cam = bpy.context.active_object
    scene.camera = cam
    cam.data.lens = 60
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    coords = [v for c in bb for v in c]
    loc, _scale = cam.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), coords)
    cam.location = centre + (loc - centre) * 1.18
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


for name, shape in SHAPES.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = build(name, shape())
    export(obj, os.path.join(OUT, f"{name}.glb"))
    print("exported", name, len(obj.data.vertices), "verts")
    if PREVIEW and (name.startswith("handle") or name == "track_top"):
        render_preview(obj, os.path.join(OUT, f"preview_{name}.png"))
        print("rendered", name)
