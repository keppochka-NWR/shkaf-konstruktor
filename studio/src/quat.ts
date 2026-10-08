// Кватернионы [w, x, y, z] для расстановки фурнитуры Базиса (поворот локальных осей фурнитуры в оси модуля).
export type Quat = [number, number, number, number];
/** Произведение a·b (сначала поворот b, затем a). */
export function qmul(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a, [bw, bx, by, bz] = b;
  return [aw * bw - ax * bx - ay * by - az * bz, aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw];
}
/** Поворот вектора кватернионом. */
export function qrot(q: Quat, v: [number, number, number]): [number, number, number] {
  const [w, x, y, z] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
