import os, glob

for filepath in glob.glob('src/modules/*.jsx'):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
        if 'НАРЯДІВ' in text or 'ОГЛЯД НАРЯДІВ' in text or 'ПОТРЕБА В ДОВИПУСКУ' in text:
            print("Found in file:", filepath)
    except Exception as e:
        pass
