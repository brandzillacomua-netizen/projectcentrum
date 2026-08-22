with open('src/modules/MasterModule_v3.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'isDrawerOpen' in line or 'worksheet-modal-overlay' in line or 'showCreateDrawer' in line or 'showPrepModal' in line or 'showCustomCardModal' in line:
        print(f"Line {i+1}: {line.strip()[:120]}")
