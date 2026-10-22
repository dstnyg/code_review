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

# The original helpers retain their validation and legacy-backup compatibility.
helpers = '\n'.join(lines[61:87])
# Explicitly scheduled new questions do not need the legacy D10 fallback.
helpers = helpers.replace("?p.day:10+Math.floor(s.custom.length/10)", "?p.day:validDate(p.plannedDate)?null:10+Math.floor(s.custom.length/10)")
helpers = re.sub(r'^(const|function) ', r'export \1 ', helpers, flags=re.M)
model = '\n'.join(lines[93:108])
exports = ['allProblems', 'getProblem', 'material', 'trainingDay', 'plannedDate', 'planned',
           'history', 'last', 'timeToNext', 'dueList', 'counts', 'doneOn', 'backlog']
domain_dir = root / 'src' / 'domain'
domain_dir.mkdir(parents=True, exist_ok=True)
(domain_dir / 'training.js').write_text(
    "import FIXED from '../data/problems.json';\nimport MATERIALS from '../data/materials.json';\n\n"
    + helpers + '\n\nexport function createModel(state, viewDate = TODAY()) {\n'
    + model + '\nreturn {' + ','.join(exports) + '};\n}\n', encoding='utf-8')
