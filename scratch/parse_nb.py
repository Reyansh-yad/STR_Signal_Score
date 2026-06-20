import json

with open(r'D:\Hackathone\Wave-main\notebooks\STRL_score_V2.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

with open(r'D:\Hackathone\Wave-main\scratch\nb_cells.txt', 'w', encoding='utf-8') as out:
    for cell in nb['cells']:
        if cell['cell_type'] == 'code':
            source = "".join(cell['source'])
            if 'accounts.csv' in source or 'STR_QUALITY_RANKED_FINAL.csv' in source:
                out.write("====================================\n")
                out.write(source + "\n")
