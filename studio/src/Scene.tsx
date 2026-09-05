import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { boxes, parts, type Module } from "./model";
export type View = "iso" | "front" | "side" | "top";
type Props = {
  module: Module;
  selected: string;
  onSelect: (id: string) => void;
  texture?: string;
  facadeTexture?: string;
  view: View;
  fit: number;
  openDoors: boolean;
  exploded: boolean;
  dimensions: boolean;
};
export function Scene(p: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(p);
  current.current = p;
  const [error, setError] = useState("");
  const api = useRef<{ rebuild: () => void; fit: () => void } | null>(null);
  useEffect(() => {
    const target = host.current!;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(
        "Не удалось включить 3D. Откройте редактор в Chrome или Edge с аппаратным ускорением. Ваш модуль сохранён.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xeaf0f2, 0);
    renderer.domElement.setAttribute(
      "aria-label",
      "3D-модель шкафа. Перетаскивание — поворот, колесо — масштаб.",
    );
    renderer.domElement.setAttribute("role", "img");
    target.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(34, 1, 5, 50000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 350;
    controls.maxDistance = 14000;
    controls.maxPolarAngle = Math.PI * 0.91;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8991, 2.1));
    const sun = new THREE.DirectionalLight(0xfff8ed, 3.1);
    sun.position.set(-2200, 5000, 4200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -2500,
      right: 2500,
      top: 3500,
      bottom: -2500,
      near: 100,
      far: 12000,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 2;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc7e2f2, 1.4);
    fill.position.set(2500, 1600, -2000);
    scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30000, 30000),
      new THREE.ShadowMaterial({ opacity: 0.15 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(18000, 72, 0xbacbd1, 0xd4dfe3);
    grid.position.y = -5;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.38;
    scene.add(grid);
    let modelGroup = new THREE.Group();
    scene.add(modelGroup);
    const loader = new THREE.TextureLoader();
    let generation = 0;
    function disposeGroup(group: THREE.Group) {
      group.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Sprite
        ) {
          o.geometry?.dispose();
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          for (const mat of materials) {
            if ("map" in mat && (mat as THREE.MeshStandardMaterial).map)
              (mat as THREE.MeshStandardMaterial).map?.dispose();
            mat.dispose();
          }
        }
      });
      scene.remove(group);
    }
    function label(text: string, pos: THREE.Vector3) {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 128;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#f6fafb";
      ctx.beginPath();
      ctx.roundRect(8, 8, 496, 112, 22);
      ctx.fill();
      ctx.fillStyle = "#234754";
      ctx.font = "600 58px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 256, 66);
      const map = new THREE.CanvasTexture(c);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map, depthTest: false }),
      );
      sprite.position.copy(pos);
      sprite.scale.set(530, 132.5, 1);
      modelGroup.add(sprite);
    }
    function line(points: THREE.Vector3[]) {
      modelGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: 0x71919d, depthTest: false }),
        ),
      );
    }
    function rebuild() {
      const state = current.current,
        m = state.module;
      generation++;
      const gen = generation;
      disposeGroup(modelGroup);
      modelGroup = new THREE.Group();
      scene.add(modelGroup);
      for (const part of parts(m)) {
        const isMetal = part.material === "metal",
          isBack = part.material === "hdf";
        const wood = part.decor.includes("Дуб") || part.decor.includes("Орех");
        const mat = new THREE.MeshStandardMaterial({
          color: isMetal
            ? 0xbecad0
            : isBack
              ? 0xd7d5cc
              : wood
                ? 0xd2b68d
                : part.decor === "Графит"
                  ? 0x505653
                  : 0xe6e4dc,
          roughness: isMetal ? 0.24 : 0.73,
          metalness: isMetal ? 0.8 : 0,
        });
        const texture =
          part.role === "door" ? state.facadeTexture : state.texture;
        if (texture && !isBack && !isMetal) {
          loader.load(
            texture,
            (map) => {
              if (disposed || gen !== generation) {
                map.dispose();
                return;
              }
              map.colorSpace = THREE.SRGBColorSpace;
              map.anisotropy = Math.min(
                8,
                renderer.capabilities.getMaxAnisotropy(),
              );
              mat.map = map;
              mat.color.set(0xffffff);
              mat.needsUpdate = true;
            },
            undefined,
            () => {},
          );
        }
        const geometry =
          part.role === "rod"
            ? new THREE.CylinderGeometry(
                part.size[1] / 2,
                part.size[1] / 2,
                part.size[0],
                24,
              )
            : new THREE.BoxGeometry(...part.size);
        const mesh = new THREE.Mesh(geometry, mat);
        if (part.role === "rod") mesh.rotation.z = Math.PI / 2;
        mesh.position.set(
          part.position[0] - m.width / 2,
          part.position[1],
          part.position[2] - m.depth / 2,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { sectionId: part.sectionId, partId: part.id };
        if (state.exploded) {
          mesh.position.x *= 1.3;
          mesh.position.y =
            (mesh.position.y - m.height / 2) * 1.18 + m.height / 2;
          mesh.position.z *= 1.6;
        }
        if (part.role === "door" && state.openDoors) {
          const pivot = new THREE.Group();
          pivot.position.copy(mesh.position);
          pivot.position.x -= part.size[0] / 2;
          mesh.position.set(part.size[0] / 2, 0, 0);
          pivot.add(mesh);
          pivot.rotation.y = -Math.PI * 0.58;
          modelGroup.add(pivot);
        } else modelGroup.add(mesh);
        if (!isMetal) {
          const edge = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({
              color: 0x4a4b40,
              transparent: true,
              opacity: 0.16,
            }),
          );
          mesh.add(edge);
        }
      }
      const b = boxes(m).find((b) => b.id === state.selected);
      if (b) {
        const geo = new THREE.BoxGeometry(
          b.width,
          b.top - b.bottom,
          m.depth - 20,
        );
        const highlight = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({
            color: 0x24899b,
            transparent: true,
            opacity: 0.72,
          }),
        );
        geo.dispose();
        highlight.position.set(
          b.x + b.width / 2 - m.width / 2,
          (b.top + b.bottom) / 2,
          5,
        );
        modelGroup.add(highlight);
      }
      if (state.dimensions) {
        const z = m.depth / 2 + 110,
          x = -m.width / 2 - 150;
        line([
          new THREE.Vector3(-m.width / 2, -90, z),
          new THREE.Vector3(m.width / 2, -90, z),
        ]);
        for (const dx of [-m.width / 2, m.width / 2])
          line([new THREE.Vector3(dx, -55, z), new THREE.Vector3(dx, -125, z)]);
        label(`${m.width} мм`, new THREE.Vector3(0, -110, z));
        line([new THREE.Vector3(x, 0, z), new THREE.Vector3(x, m.height, z)]);
        label(`${m.height} мм`, new THREE.Vector3(x - 30, m.height / 2, z));
      }
    }
    function fit() {
      const m = current.current.module;
      const aspect = target.clientWidth / Math.max(1, target.clientHeight);
      const height = m.height + 380;
      const width = m.width + m.depth + 650;
      const dist =
        (Math.max(height, width / aspect) /
          (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
        1.1;
      const center = new THREE.Vector3(0, m.height / 2 - 50, 0);
      controls.target.copy(center);
      const view = current.current.view;
      const dir =
        view === "front"
          ? new THREE.Vector3(0, 0, 1)
          : view === "side"
            ? new THREE.Vector3(1, 0, 0.001)
            : view === "top"
              ? new THREE.Vector3(0, 1, 0.001)
              : new THREE.Vector3(1, 0.55, 1.7).normalize();
      camera.up.set(0, 1, 0);
      camera.position.copy(center).addScaledVector(dir, dist);
      controls.update();
    }
    let initial = true;
    const observer = new ResizeObserver(() => {
      if (!target.clientWidth || !target.clientHeight) return;
      renderer.setSize(target.clientWidth, target.clientHeight);
      camera.aspect = target.clientWidth / target.clientHeight;
      camera.updateProjectionMatrix();
      fit();
      if (initial) {
        initial = false;
      }
    });
    observer.observe(target);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = [0, 0];
    function pointerDown(e: PointerEvent) {
      down = [e.clientX, e.clientY];
    }
    function pointerUp(e: PointerEvent) {
      if (
        e.button !== 0 ||
        Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5
      )
        return;
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray
        .intersectObjects(modelGroup.children, true)
        .find((h) => h.object instanceof THREE.Mesh);
      if (hit) {
        const sid =
          hit.object.userData.sectionId ||
          boxes(current.current.module).find(
            (b) =>
              hit.point.x + current.current.module.width / 2 >= b.x &&
              hit.point.x + current.current.module.width / 2 <= b.x + b.width,
          )?.id;
        if (sid) current.current.onSelect(sid);
      }
    }
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const loss = (e: Event) => {
      e.preventDefault();
      setError(
        "3D-представление остановлено. Сохраните модуль в файл и обновите страницу.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", loss);
    rebuild();
    fit();
    api.current = { rebuild, fit };
    let frame = 0;
    function animate() {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeGroup(modelGroup);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);
  useEffect(
    () => api.current?.rebuild(),
    [
      p.module,
      p.selected,
      p.texture,
      p.facadeTexture,
      p.openDoors,
      p.exploded,
      p.dimensions,
    ],
  );
  useEffect(
    () => api.current?.fit(),
    [p.view, p.fit, p.module.width, p.module.height, p.module.depth],
  );
  return (
    <div className="scene" ref={host} data-testid="scene">
      {error && (
        <div className="scene-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
