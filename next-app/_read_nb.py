import json, sys
sys.stdout.reconfigure(encoding='utf-8')

nb = json.load(open(r'D:\Hackathone\Wave-main\notebooks\STRL_score_V2.ipynb', 'r', encoding='utf-8'))
cells = nb['cells']
# Print only cell 0 and cell 1
for i in [0, 1]:
    c = cells[i]
    src = "".join(c["source"])
    print(f"\n{'='*80}")
    print(f"CELL {i} ({c['cell_type']}) - {len(src)} chars")
    print('='*80)
    print(src)
