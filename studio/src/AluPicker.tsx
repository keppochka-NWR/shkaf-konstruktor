// Выбор алюминиевой рамки (профиль, цвет, наполнение) — общий для кухни; списки — из калькулятора фасадов ALU (alu.ts/aluData.ts).
import { ALU_PROFILES, ALU_FILLS, ALU_FILL_GROUPS, aluProfile, type AluFacade } from "./alu";

/** Наполнения рамки группами калькулятора (Стекло, Зеркала, Лакобель, Узорчатые). */
export function aluFillOptions() {
  return ALU_FILL_GROUPS.map((g) => <optgroup key={g} label={g}>{ALU_FILLS.filter((f) => f.group === g).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>);
}

export function AluPicker({ value, onChange }: { value: AluFacade; onChange: (v: AluFacade) => void }) {
  const p = aluProfile(value.profile) ?? ALU_PROFILES[0];
  return <>
    <label className="hardware-field">Профиль<select aria-label="Профиль рамки" value={value.profile} onChange={(e) => { const n = aluProfile(e.target.value)!; onChange({ ...value, profile: n.id, color: n.colors.some((c) => c.id === value.color) ? value.color : n.colors[0].id }); }}>{ALU_PROFILES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    <label className="hardware-field">Цвет профиля<select aria-label="Цвет профиля" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })}>{p.colors.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label className="hardware-field">Наполнение<select aria-label="Вставка рамки" value={value.insert} onChange={(e) => onChange({ ...value, insert: e.target.value })}>{aluFillOptions()}</select></label>
  </>;
}
