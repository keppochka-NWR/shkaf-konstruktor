import { useEffect, useState } from "react";
import { HANDLE_SHAPE_LABELS, handleSpec, type Handle } from "./handles";
import { handlePreviewUrl, requestHandlePreview } from "./handlePreview";

/** Миниатюра ручки в окне выбора: процедурная 3D-модель (как в сцене); пока не отрисована или без WebGL — полоска по межосевому. */
export function HandleThumb({ h }: { h: Handle }) {
  const [url, setUrl] = useState(() => handlePreviewUrl(h));
  useEffect(() => {
    let alive = true;
    const hit = handlePreviewUrl(h);
    if (hit) { setUrl(hit); return; }
    setUrl(undefined);
    requestHandlePreview(h, (u) => { if (alive && u) setUrl(u); });
    return () => { alive = false; };
  }, [h.id]);
  const spec = handleSpec(h), title = `${HANDLE_SHAPE_LABELS[spec.shape]} · межосевое ${spec.cc} мм · длина ≈ ${spec.total} мм · вынос ≈ ${spec.projection} мм`;
  return url
    ? <img className="handle-thumb" src={url} alt={title} title={title} width={110} height={44} data-handle-shape={spec.shape} />
    : <span className="handle-bar" title={title} data-handle-shape={spec.shape} style={{ width: Math.min(100, Math.max(14, h.len / 12)) + "px" }} />;
}
