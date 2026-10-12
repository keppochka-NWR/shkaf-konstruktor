"""Extract original triangular CAD components for inspection, NOT whole mechanisms.

Profiles/CSG/animation require a separate converter. Never label a partial mesh
as a complete lift. Source FR3D files are read only. Uses the existing local
Bazis decoder (path overridable on command line).
"""
from pathlib import Path
import sys, json, hashlib, collections
import numpy as np

sys.path.insert(0, sys.argv[1] if len(sys.argv)>1 else r'C:\Users\My PC\Desktop\Claude Project\Bazis\b3d-tools')
sys.path.insert(0, sys.argv[2] if len(sys.argv)>2 else r'C:\Users\My PC\Desktop\Claude Project\Кухни\scripts')
from extract import load_b3d
from tri2glb import mesh_geometry, write_glb, read_glb

root=Path(__file__).resolve().parents[1]/'reports/premial-source'
out=root/'components';out.mkdir(exist_ok=True)
inventory=json.loads((root/'inventory.json').read_text(encoding='utf-8'))
assets={}; errors=[]
# A representative of each archive is an inspection sample, not coverage of all 314 files.
representatives=[next(r for r in inventory if r['archive']==a) for a in sorted(set(r['archive'] for r in inventory))]
for row in representatives:
    try:
        body=load_b3d(str(root/row['file']))[-1]
        furn=body.get('FurnList')
        for f in (furn.children if furn else []):
            raw=f.v('TriData')
            if not isinstance(raw,bytes) or len(raw)<=4:continue
            sha=hashlib.sha256(raw).hexdigest();key=sha[:16]
            if key in assets:continue
            pieces,stats=mesh_geometry(raw)
            groups=[(cl,tr,n,[mat]) for mat,cl,tr,n in pieces]
            if not groups:continue
            dest=out/(key+'.glb')
            write_glb(str(dest),groups,{'mesh':key,'sourceFile':row['file'],'sourceSha256':row['sha256'],'componentOnly':True})
            check,doc,problems=read_glb(str(dest))
            vertices=np.concatenate([p[2].reshape(-1,3) for p in check])
            record=[f.v(k) for k in ('MinX','MinY','MinZ','MaxX','MaxY','MaxZ')]
            actual=[*vertices.min(0).tolist(),*vertices.max(0).tolist()]
            delta=max(abs(a-b) for a,b in zip(actual,record)) if all(isinstance(x,(int,float)) for x in record) else None
            assets[key]=dict(name=f.v('Name'),source=row['file'],sourceName=row['sourceName'],triSha256=sha,file=dest.name,
                             box=actual,recordBox=record,maxBoxDelta=delta,finite=bool(np.isfinite(vertices).all()),
                             triangles=sum(len(p[2]) for p in check),formatProblems=problems,normalRepair=stats,
                             status='component-only; whole assembly and visual QC pending')
    except Exception as e:errors.append(dict(source=row['file'],error=str(e)))
report=dict(sampledFiles=len(representatives),totalSourceFiles=len(inventory),components=list(assets.values()),errors=errors,
            limitation='Component meshes only. No complete assembly claim; profiles, boolean solids, placement, and animation not converted.')
(root/'component-inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(samples=len(representatives),components=len(assets),errors=errors),ensure_ascii=False))
