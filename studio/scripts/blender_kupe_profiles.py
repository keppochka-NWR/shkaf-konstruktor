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


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kupe_profile_shapes import SHAPES, FACTORY_NAMES, loops as factory_loops  # noqa: E402


def build_factory(name, loops, length=LENGTH):
    """Exact contour with holes: 2D curve with fill (even-odd keeps the chambers hollow), extruded, converted to mesh."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = length * MM / 2
    for loop in loops:
        sp = cu.splines.new("POLY")
        sp.points.add(len(loop) - 1)
        for i, (a, b) in enumerate(loop):
            sp.points[i].co = (a * MM, -b * MM, 0, 1)
        sp.use_cyclic_u = True
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    for v in obj.data.vertices:
        v.co.z += length * MM / 2
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
    obj.name = name
    return obj


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
    # handles: face up, end face toward the camera (like the catalogue pictures); top track: channels down
    obj.rotation_euler = (math.pi, math.pi / 2, 0) if obj.name == "track_top" else (-math.pi / 2, 0, 0)
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


for name in [*FACTORY_NAMES, *SHAPES.keys()]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = build_factory(name, factory_loops(name)) if name in FACTORY_NAMES else build(name, SHAPES[name]())
    export(obj, os.path.join(OUT, f"{name}.glb"))
    print("exported", name, len(obj.data.vertices), "verts")
    if PREVIEW and (name.startswith("handle") or name == "track_top"):
        render_preview(obj, os.path.join(OUT, f"preview_{name}.png"))
        print("rendered", name)
