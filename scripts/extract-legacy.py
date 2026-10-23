"""Extract the original data and pure rules without changing the source HTML."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = (root.parent / 'LeetCode_Hot100_智能复习训练台.html').read_text(encoding='utf-8-sig')
lines = source.splitlines()
data_dir = root / 'src' / 'data'
data_dir.mkdir(parents=True, exist_ok=True)
for name, filename in [('FIXED', 'problems.json'), ('MATERIALS', 'materials.json')]:
    match = re.search(r'^const ' + name + r'=(.*);\s*$', source, re.M)
    value = json.loads(match.group(1))
    (data_dir / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{filename}: {len(value)} entries')

