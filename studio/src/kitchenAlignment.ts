import type { Module } from "./model";
import type { PlacedModule, Project } from "./project";

// Virtual closed facade plane excludes handles and is shared by doors and drawer fronts.
export const kitchenFaceOffset = (m: Module) => m.depth + (m.faceAir ?? 2) + (m.facadeT ?? 16);
export const kitchenRearClearance = (m: Module) => m.backType === "nailed" ? 3 : 0;
export function kitchenRowZ(p: Project, m: Module, y: number): number {
  const peers = p.modules.filter(a => a.module.kitchen?.role === m.kitchen?.role && (a.rotation ?? 0) === 0 && Math.abs((a.y ?? 0) - y) < 1);
  const face = peers.length ? peers[peers.length - 1].z + kitchenFaceOffset(peers[peers.length - 1].module) : kitchenRearClearance(m) + kitchenFaceOffset(m);
  return Math.max(kitchenRearClearance(m), face - kitchenFaceOffset(m));
}
/** Only the connected straight row of the selected cabinet; other rows/islands stay intact. */
export function alignKitchenRow(p: Project, selectedId: string): Project {
  const selected = p.modules.find(a => a.id === selectedId);
  if (!selected?.module.kitchen || (selected.rotation ?? 0) !== 0) return p;
  const peers = p.modules.filter(a => a.module.kitchen?.role === selected.module.kitchen?.role && (a.rotation ?? 0) === 0 && Math.abs((a.y ?? 0) - (selected.y ?? 0)) < 1 && Math.abs(a.z - selected.z) < 600);
  const connected = new Set([selectedId]);
  let grew = true;
  while (grew) { grew = false; for (const a of peers) if (!connected.has(a.id) && peers.some(b => connected.has(b.id) && (Math.abs(a.x - b.x - b.module.width) < 2 || Math.abs(b.x - a.x - a.module.width) < 2))) { connected.add(a.id); grew = true; } }
  const row = peers.filter(a => connected.has(a.id));
  const face = Math.max(selected.z + kitchenFaceOffset(selected.module), ...row.map(a => kitchenRearClearance(a.module) + kitchenFaceOffset(a.module)));
  return { ...p, modules: p.modules.map(a => connected.has(a.id) ? { ...a, z: face - kitchenFaceOffset(a.module) } : a) };
}
