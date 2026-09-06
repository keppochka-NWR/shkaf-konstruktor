# -*- coding: utf-8 -*-
# Модели мебельных ручек для 3D-студии: Blender headless -> GLB.
# Запуск: blender --background --python scripts/blender_handles.py -- <kinds.json> <out_dir>
# Система координат модели (мм, до экспорта делим на 1000): X — вдоль ручки (межосевое по центру),
# Y — вверх по фасаду, Z — от плоскости фасада наружу. Начало — на поверхности фасада между отверстиями.
# Экспорт glTF переводит Y-up как есть (Blender Z-up -> glTF Y-up делает сам экспортёр), поэтому строим в Blender
# с осью Z вверх по фасаду и Y — наружу, а экспортёр отдаст в three.js Y вверх, Z наружу.
import bpy, bmesh, json, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
KINDS, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)
MM = 0.001


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def cylinder(name, r, length, axis, at):
    """Цилиндр радиуса r длиной length вдоль оси axis ('x'|'y'|'z'), центр at (мм)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r * MM, depth=length * MM, location=[v * MM for v in at])
    o = bpy.context.active_object
    o.name = name
    if axis == "x":
        o.rotation_euler = (0, math.pi / 2, 0)
    elif axis == "y":
        o.rotation_euler = (math.pi / 2, 0, 0)
    return o


def box(name, size, at, bevel=1.5):
    bpy.ops.mesh.primitive_cube_add(size=1, location=[v * MM for v in at])
    o = bpy.context.active_object
    o.name = name
    o.scale = [v * MM for v in size]
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width = bevel * MM
        m.segments = 3
        m.limit_method = "ANGLE"
    return o


def sphere(name, r, at):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r * MM, location=[v * MM for v in at])
    o = bpy.context.active_object
    o.name = name
    return o


def shade_smooth_all():
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            bpy.context.view_layer.objects.active = o
            o.select_set(True)
            bpy.ops.object.shade_smooth()
            o.select_set(False)


# В Blender: X вдоль, Y — наружу от фасада (глубина), Z — вверх по фасаду.
def bracket(L):
    """Скоба: две ножки Ø9 высотой 20 и перекладина 11×11 длиной L+20 со скруглением."""
    for s in (-1, 1):
        cylinder("leg" + ("L" if s < 0 else "R"), 4.5, 20, "y", (s * L / 2, 10, 0))
    box("bar", (L + 20, 11, 11), (0, 25.5, 0), bevel=3)


def rail(L):
    """Рейлинг: две круглые стойки Ø12 высотой 24 и труба Ø12 длиной L+30."""
    for s in (-1, 1):
        cylinder("post" + ("L" if s < 0 else "R"), 6, 24, "y", (s * L / 2, 12, 0))
    cylinder("bar", 6, L + 30, "x", (0, 30, 0))
    for s in (-1, 1):
        sphere("cap" + ("L" if s < 0 else "R"), 6, (s * (L + 30) / 2, 30, 0))


def knob():
    """Кнопка: ножка Ø10 высотой 10 и шляпка Ø28 высотой 14 со скруглением."""
    cylinder("stem", 5, 10, "y", (0, 5, 0))
    cap = cylinder("cap", 14, 14, "y", (0, 17, 0))
    m = cap.modifiers.new("bevel", "BEVEL")
    m.width = 3 * MM
    m.segments = 4


def profile(L):
    """Торцевая профиль-ручка: планка L+40 × 22 высотой, 9 наружу, с губкой под пальцы сверху."""
    box("plate", (L + 40, 9, 22), (0, 4.5, 0), bevel=1)
    box("lip", (L + 40, 16, 4), (0, 8, 13), bevel=1)


def export(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_materials="NONE", export_yup=True)


kinds = json.load(open(KINDS, encoding="utf-8"))
made = []
for k in kinds:
    reset()
    kind, L = k["kind"], k["len"]
    if kind == "bracket":
        bracket(L)
    elif kind == "rail":
        rail(L)
    elif kind == "knob":
        knob()
    else:
        profile(L)
    shade_smooth_all()
    name = "knob.glb" if kind == "knob" else f"{kind}_{L}.glb"
    export(os.path.join(OUT, name))
    made.append(name)
print("EXPORTED", len(made), made)
