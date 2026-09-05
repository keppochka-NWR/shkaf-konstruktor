import os
import sys
from pathlib import Path
root=Path(__file__).resolve().parent
sys.path.insert(0,str(root/'.studio-deps'))
from studio_app import create_app
import uvicorn
if __name__=='__main__':
    uvicorn.run(create_app(),host='127.0.0.1',port=int(os.environ.get('STUDIO_PORT','8104')))
