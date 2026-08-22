import re

with open('src/modules/MasterModule_v3.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
for i, line in enumerate(lines):
    if 'position: \'fixed\'' in line or 'position: "fixed"' in line or 'position:\'fixed\'' in line:
        print(f"Line {i+1}: {line.strip()[:100]}")
