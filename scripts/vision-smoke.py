"""Real provider acceptance using supplied reference images, never personal webcam capture."""
import argparse
from io import BytesIO
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from PIL import Image
from app.core.config import settings
from app.integrations.vision import normalize_frame, GroqVision, VisionUnavailable

parser=argparse.ArgumentParser()
parser.add_argument('--case',nargs=2,action='append',required=True,metavar=('EXPECTED','JPEG_PATH'))
args=parser.parse_args()
if len(args.case)>3:raise SystemExit('Use at most three cases per run to respect the vision token budget.')
for expected,file in args.case:
    if expected not in ('visible','not_visible','uncertain'):raise SystemExit('Invalid expected label')
    with Image.open(file) as image:
        image.thumbnail((640,640));out=BytesIO();image.convert('RGB').save(out,format='JPEG',quality=65)
    try:result=GroqVision().inspect(normalize_frame(out.getvalue(),'image/jpeg'),settings().vision_model).phone_visibility
    except VisionUnavailable as error:
        print('NOT VERIFIED:',error.code);raise SystemExit(2)
    print(('PASS' if result==expected else 'FAIL')+': '+Path(file).name+' -> '+result)
    if result!=expected:raise SystemExit(1)
