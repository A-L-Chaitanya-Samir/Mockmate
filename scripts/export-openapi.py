import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.main import app

Path('contracts/openapi.json').write_text(json.dumps(app.openapi(), indent=2) + '\n', encoding='utf-8')
