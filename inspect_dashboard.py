import re

with open('src/modules/DashboardModule.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

inline_bg = re.findall(r'background:\s*[\'"][^\'"]+[\'"]', text)
print("Unique background inline styles in DashboardModule.jsx:", set(inline_bg))

inline_colors = re.findall(r'color:\s*[\'"][^\'"]+[\'"]', text)
print("Unique color inline styles in DashboardModule.jsx:", set(inline_colors))
