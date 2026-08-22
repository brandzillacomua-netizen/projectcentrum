import re

with open('src/modules/MasterModule_v3.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Find all overlay or popup containers (e.g., fixed position or modal wrappers)
fixed_containers = re.findall(r'<div[^>]*position:\s*[\'"]fixed[\'"][^>]*>', text)
print("Fixed position divs in MasterModule_v3.jsx:")
for fc in fixed_containers:
    print("  ", fc)

# Find form or detail modals
modal_states = re.findall(r'(show\w*Modal|is\w*Open|createModal|detailModal|activeModal|selectedTask|selectedOrder)', text)
print("\nModal-related state keywords found:")
for ms in set(modal_states):
    print("  ", ms)
