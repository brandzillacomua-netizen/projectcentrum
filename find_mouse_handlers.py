import re

with open('src/modules/ForemanDashboardModule.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r'onMouse\w+=\{[^}]+\}', text)
print("Found mouse handlers in ForemanDashboardModule.jsx:")
for m in set(matches):
    print("  ", m)
