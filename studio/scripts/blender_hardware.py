# -*- coding: utf-8 -*-
# Hinge GTV DCHCB 3D (ZM-DCHCB09, overlay, cup Ø35) and pull-out hanger GTV WSL (WW-WSL350-01) for the 3D studio.
# Sizes from the GTV cards: hinge — karta techniczna ZM-DCHCB_9.pdf (cup Ø35 × 12, screw spacing 45, K = 5, arm 19.5 wide,
# 78 from the door back face, plate H0 63 with holes 32 apart at 24 from the front edge); hanger — product card 2021 p. 203
# (L 350, C 335, height 40 = bracket 20 + loop 20, wire Ø5.5).
# Run: blender --background --python scripts/blender_hardware.py -- <out_dir> [preview]
# Every piece is a filleted 2D outline extruded to its thickness (like the sliding door profiles), then bevelled.
# Modelled in three.js coordinates (x right, y up, z to the front), converted on output: Blender (x, y, z) = three (x, -z, y).
#   hinge (left door): x from the door's outer hinge edge into the cabinet, y along the door height (0 = hinge line),
#                      z = 0 on the door's back face, negative into the cabinet.
#   hanger: x across (0 = centre), y = 0 at the shelf underside (down negative), z = 0 at the rear bracket, L at the front.
import bpy, bmesh, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0]; PREVIEW = len(argv) > 1 and argv[1] == "preview"
os.makedirs(OUT, exist_ok=True)
MM = 0.001
parts = []


def B(x, y, z):  # three mm -> Blender m
    return (x * MM, -z * MM, y * MM)


def fillet(poly, r, seg=6):
    """Round every corner of a closed polygon by radius r (clamped to half the shorter neighbouring edge)."""
    out, n = [], len(poly)
    for i in range(n):
        p0, p1, p2 = poly[i - 1], poly[i], poly[(i + 1) % n]
        a = (p0[0] - p1[0], p0[1] - p1[1]); c = (p2[0] - p1[0], p2[1] - p1[1])
        la, lc = math.hypot(*a), math.hypot(*c)
        if la < 1e-6 or lc < 1e-6: out.append(p1); continue
        rr = min(r, la / 2.01, lc / 2.01)
        ua, uc = (a[0] / la, a[1] / la), (c[0] / lc, c[1] / lc)
        cosang = max(-1, min(1, ua[0] * uc[0] + ua[1] * uc[1])); ang = math.acos(cosang)
        if ang < 1e-3 or abs(ang - math.pi) < 1e-3: out.append(p1); continue
        t = rr / math.tan(ang / 2)
        s, e = (p1[0] + ua[0] * t, p1[1] + ua[1] * t), (p1[0] + uc[0] * t, p1[1] + uc[1] * t)
        bis = (ua[0] + uc[0], ua[1] + uc[1]); lb = math.hypot(*bis); d = rr / math.sin(ang / 2)
        cen = (p1[0] + bis[0] / lb * d, p1[1] + bis[1] / lb * d)
        a0, a1 = math.atan2(s[1] - cen[1], s[0] - cen[0]), math.atan2(e[1] - cen[1], e[0] - cen[0])
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        out += [(cen[0] + rr * math.cos(a0 + da * k / seg), cen[1] + rr * math.sin(a0 + da * k / seg)) for k in range(seg + 1)]
    return out


def circle(cx, cy, r, n=40):
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def prism(poly, plane, d0, d1, bevel=0.5):
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
    o = bpy.data.objects.new("p", me); bpy.context.scene.collection.objects.link(o)
    if bevel:
        m = o.modifiers.new("b", "BEVEL"); m.width = bevel * MM; m.segments = 3; m.limit_method = "ANGLE"; m.angle_limit = math.radians(50)
    parts.append(o); return o


def cyl(r, axis, c1, c2, a0, a1, n=36, bevel=0.3):
    """Cylinder along a three.js axis ('x', 'y', 'z'); (c1, c2) = the other two coordinates in x-y-z order."""
    plane = {"x": "yz", "y": "xz", "z": "xy"}[axis]
    return prism(circle(c1, c2, r, n), plane, a0, a1, bevel)


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
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_materials="NONE", export_yup=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


CX = 22.5  # cup centre from the door hinge edge: K = 5 + R 17.5
# ---------- hinge, door part: cup, flange, hinge body (turns with the door) ----------
reset()
cyl(17.5, "z", CX, 0, 0.3, 11.8)                                   # cup Ø35, 12 deep, sunk in the door
cyl(18.2, "z", CX, 0, -0.9, 0.3, 48, 0.25)                         # cup rim
flange = fillet([(CX - 6.5, -29), (CX + 6.5, -29), (CX + 6.5, 29), (CX - 6.5, 29)], 6.4, 8)   # «spectacles»: ears with the screws 45 apart
prism(flange, "xy", -1.2, 0, 0.3)
for sy in (-22.5, 22.5):
    cyl(4.6, "z", CX, sy, -2.2, -1.2, 28, 0.6)                     # screw heads
# hinge body over the cup, seen from the side (x-z): rounded block rising from the cup to the arm
body = fillet([(13, -1), (33, -1), (33, -7), (27, -15.5), (13, -15.5)], 3.2, 8)
prism(body, "xz", -9.75, 9.75, 0.8)
cyl(2.4, "y", 24, -12.5, -10.2, 10.2, 24, 0.3)                     # pivot pin through the body
export(join("hinge_cup"), os.path.join(OUT, "hinge_cup.glb"))

# ---------- hinge, cabinet part: arm on the side panel + cruciform mounting plate H0 ----------
reset()
# plate on the side face (y-z outline, 2.5 thick from x = 14): centre bar along the depth + wings 63 along the height at the screws
bar = fillet([(-8, -76), (8, -76), (8, -16), (-8, -16)], 7.5, 8)
prism(bar, "yz", 14, 16.5, 0.6)
wings = fillet([(-31.5, -61), (31.5, -61), (31.5, -47), (-31.5, -47)], 6.8, 8)
prism(wings, "yz", 14, 16.5, 0.6)
for sy in (-25, 25):
    cyl(3.6, "x", sy, -54, 16.5, 17.8, 24, 0.5)                    # plate screws (holes 32 apart along the depth at 24 / 56)
# arm: side profile in x-z — 10.5 high over the plate, rises to the hinge body, rounded nose at the front
arm = fillet([(16.5, -78), (24.5, -78), (27.5, -60), (27.5, -16), (33, -9), (33, -1.5), (24, -1.5), (16.5, -12)], 4.5, 8)
prism(arm, "xz", -9.75, 9.75, 1.0)
for sz in (-40, -62):
    cyl(3.4, "x", 0, sz, 27.5, 29.3, 24, 0.5)                      # depth / side adjustment screws
    cyl(1.0, "x", 0, sz, 29.2, 29.6, 8, 0)                         # screw slot hint
export(join("hinge_plate"), os.path.join(OUT, "hinge_plate.glb"))

# ---------- pull-out hanger GTV WSL 350 ----------
reset()
L = 350.0
for z0, z1 in ((0, 16), (L - 16, L)):
    prism(fillet([(-15, z0), (15, z0), (15, z1), (-15, z1)], 3, 6), "xz", -2.2, 0, 0.4)           # plate under the shelf
    prism(fillet([(-5.5, -2), (5.5, -2), (5.5, -20), (-5.5, -20)], 2.2, 6), "xy", z0 + 3, z1 - 3, 0.6)   # bracket body
prism(fillet([(-4, -10.5), (4, -10.5), (4, -16.5), (-4, -16.5)], 1.2, 4), "xy", 8, L - 8, 0.4)     # fixed rail (C = 335)
prism(fillet([(-6, -9), (6, -9), (6, -19.5), (-6, -19.5)], 2.5, 6), "xy", L - 90, L - 30, 0.6)    # slider carriage
cyl(2.75, "z", 0, -37.25, 18, L - 18, 24, 0.2)                     # hanger loop: bottom wire Ø5.5
cyl(2.75, "z", 0, -14, 18, L - 18, 24, 0.2)                        # top wire
for zz in (18, L - 18):
    cyl(2.75, "y", 0, zz, -40, -11.25, 24, 0.2)                    # loop ends
prism(fillet([(-10, -25), (10, -25), (10, -42), (-10, -42)], 4, 6), "xy", L - 14, L - 2, 0.8)   # front grip
export(join("trempel_wsl"), os.path.join(OUT, "trempel_wsl.glb"))

if PREVIEW:
    import mathutils
    for name in ("hinge_cup", "hinge_plate", "trempel_wsl"):
        reset()
        bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, name + ".glb"))
        o = [x for x in bpy.context.scene.objects if x.type == "MESH"][0]
        mat = bpy.data.materials.new("m"); mat.use_nodes = True; bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (0.42, 0.44, 0.46, 1); bsdf.inputs["Metallic"].default_value = 1; bsdf.inputs["Roughness"].default_value = 0.3
        o.data.materials.append(mat)
        sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 64; sc.render.resolution_x, sc.render.resolution_y = 900, 700
        w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
        w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.82, 0.85, 1); w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
        bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]; c = sum(bb, mathutils.Vector()) / 8
        size = max((bb[6] - bb[0]).length, 0.05)
        for off, e in (((1, -1, 1.2), 8), ((-1, -0.6, 0.6), 3)):
            bpy.ops.object.light_add(type="AREA", location=c + mathutils.Vector(off) * size); l = bpy.context.active_object
            l.data.energy = e * (size / 0.1) ** 2; l.data.size = size
            l.rotation_euler = (c - l.location).to_track_quat("-Z", "Y").to_euler()
        view = mathutils.Vector((1.2, -1.0, 0.8)) if name != "hinge_cup" else mathutils.Vector((1.2, 1.3, 0.7))
        bpy.ops.object.camera_add(location=c + view * size); cam = bpy.context.active_object; sc.camera = cam
        cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler(); cam.data.lens = 60
        bpy.context.view_layer.update()
        loc, _ = cam.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), [v for p in bb for v in p]); cam.location = c + (loc - c) * 1.15
        sc.render.filepath = os.path.join(OUT, "preview_" + name + ".png"); bpy.ops.render.render(write_still=True)
print("done")
