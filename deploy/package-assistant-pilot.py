import pathlib,zipfile,json
root=pathlib.Path(__file__).resolve().parent.parent
build=root/'web/assistant-pilot-20261114'
with zipfile.ZipFile(root/'deploy/assistant-overlay.zip','w',zipfile.ZIP_DEFLATED) as z:
    for name in ['index.html','assets','models','tex','textures','vernissage']:
        path=build/name
        if path.is_file():z.write(path,'web/studio/'+name)
        elif path.is_dir():
            for file in path.rglob('*'):
                if file.is_file():z.write(file,'web/studio/'+str(file.relative_to(build)).replace('\\','/'))
    z.writestr('web/studio/version.json',json.dumps({'mode':'assistant-owner-pilot','date':'2026-11-14','baseCommit':'4f57c572'}))
    for name in ['studio_app.py','studio_assistant.py','test_assistant.py','test_studio.py']:
        z.write(root/'server'/name,'server/'+name)
print('Assistant overlay packaged; local-projects excluded')
