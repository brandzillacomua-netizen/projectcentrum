import os
import re
import subprocess
import json

md_path = r"C:\Users\REBRAND STUDIO\.gemini\antigravity-ide\brain\5bc40a45-cfe7-42dc-8f57-f1c3f9a6385c\training_manual_shop2_packaging_shipping.md"
html_path = r"C:\Users\REBRAND STUDIO\.gemini\antigravity-ide\brain\5bc40a45-cfe7-42dc-8f57-f1c3f9a6385c\training_manual.html"
pdf_path = r"C:\Users\REBRAND STUDIO\.gemini\antigravity-ide\brain\5bc40a45-cfe7-42dc-8f57-f1c3f9a6385c\training_manual_shop2_packaging_shipping.pdf"

with open(md_path, 'r', encoding='utf-8') as f:
    text = f.read()

def simple_md_to_html(md):
    lines = md.split('\n')
    out = []
    in_table = False
    table_header = True
    
    for line in lines:
        l = line.strip()
        if not l:
            if in_table:
                out.append('</table>')
                in_table = False
            out.append('<br/>')
            continue
            
        if l.startswith('# '):
            out.append(f'<h1>{l[2:]}</h1>')
        elif l.startswith('## '):
            out.append(f'<h2>{l[3:]}</h2>')
        elif l.startswith('### '):
            out.append(f'<h3>{l[4:]}</h3>')
        elif l.startswith('#### '):
            out.append(f'<h4>{l[5:]}</h4>')
        elif l.startswith('---'):
            out.append('<hr/>')
        elif l.startswith('- [ ] ') or l.startswith('- [x] '):
            checked = 'checked' if '[x]' in l else ''
            out.append(f'<div class="chk-item"><input type="checkbox" {checked} /> {l[6:]}</div>')
        elif l.startswith('- '):
            out.append(f'<li>{l[2:]}</li>')
        elif l.startswith('|') and '|' in l[1:]:
            parts = [p.strip() for p in l.split('|')[1:-1]]
            if any('---' in p for p in parts):
                continue
            if not in_table:
                out.append('<table>')
                in_table = True
                cells = ''.join([f'<th>{p}</th>' for p in parts])
                out.append(f'<tr>{cells}</tr>')
            else:
                cells = ''.join([f'<td>{p}</td>' for p in parts])
                out.append(f'<tr>{cells}</tr>')
        else:
            if in_table:
                out.append('</table>')
                in_table = False
            # bold and code replacements
            l_formatted = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', l)
            l_formatted = re.sub(r'`(.*?)`', r'<code>\1</code>', l_formatted)
            out.append(f'<p>{l_formatted}</p>')

    if in_table:
        out.append('</table>')

    return '\n'.join(out)

html_body = simple_md_to_html(text)

css = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: #1e293b;
    line-height: 1.6;
    padding: 30px;
    max-width: 900px;
    margin: 0 auto;
    background-color: #ffffff;
}
h1 { color: #0f172a; border-bottom: 3px solid #6366f1; padding-bottom: 10px; font-size: 24px; font-weight: 900; margin-top: 20px; }
h2 { color: #1e1b4b; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 30px; font-size: 18px; font-weight: 800; page-break-after: avoid; }
h3 { color: #334155; font-size: 15px; font-weight: 700; margin-top: 20px; page-break-after: avoid; }
h4 { color: #475569; font-size: 13px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; page-break-inside: avoid; }
th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
th { background-color: #f1f5f9; color: #0f172a; font-weight: 800; }
tr:nth-child(even) { background-color: #f8fafc; }
code { background: #f1f5f9; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.chk-item { margin: 6px 0; font-size: 13px; }
li { margin-bottom: 4px; font-size: 13px; }
p { font-size: 13px; margin: 6px 0; }
hr { border: none; border-top: 1px dashed #cbd5e1; margin: 25px 0; }
@media print {
    body { padding: 0; max-width: 100%; }
    tr, blockquote { page-break-inside: avoid; }
}
"""

full_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Навчальний посібник Centrum MES</title>
<style>{css}</style>
</head>
<body>
{html_body}
</body>
</html>"""

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(full_html)

print("HTML generated at:", html_path)

edge_paths = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
]

edge_bin = None
for p in edge_paths:
    if os.path.exists(p):
        edge_bin = p
        break

if edge_bin:
    cmd = [
        edge_bin,
        "--headless",
        "--disable-gpu",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]
    print("Running Edge PDF generation...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(pdf_path):
        print("PDF SUCCESS:", pdf_path)
    else:
        print("Edge failed:", res.stderr)
else:
    print("MS Edge binary not found.")
