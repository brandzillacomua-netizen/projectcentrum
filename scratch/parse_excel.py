import zipfile
import xml.etree.ElementTree as ET

wb_path = r'a:\centrum\Номенклатура основних матеріалів для кулиці.xlsx'

ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

output_lines = []

with zipfile.ZipFile(wb_path) as z:
    strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in tree.findall('s:si', ns):
            # accumulate text in order
            t_elems = si.findall('.//s:t', ns)
            text = ''.join([t.text for t in t_elems if t.text])
            strings.append(text)
    
    wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
    sheets = wb_tree.findall('.//s:sheet', ns)
    sheet_name_map = {}
    for s in sheets:
        r_id = s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        sheet_name_map[r_id] = s.attrib.get('name')

    rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_target_map = {}
    for rel in rels_tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
        rel_target_map[rel.attrib.get('Id')] = rel.attrib.get('Target')

    for r_id, s_name in sheet_name_map.items():
        target = rel_target_map.get(r_id, '')
        sheet_file = 'xl/' + target if not target.startswith('xl/') else target
        output_lines.append(f"\n==================================================")
        output_lines.append(f"SHEET NAME: {s_name} ({sheet_file})")
        output_lines.append(f"==================================================")
        if sheet_file in z.namelist():
            sheet_tree = ET.fromstring(z.read(sheet_file))
            for row in sheet_tree.findall('.//s:row', ns):
                r_num = row.attrib.get('r')
                cells = []
                for c in row.findall('s:c', ns):
                    col_ref = c.attrib.get('r')
                    t_type = c.attrib.get('t')
                    v = c.find('s:v', ns)
                    val_str = v.text if v is not None else ''
                    if t_type == 's' and val_str.isdigit():
                        idx = int(val_str)
                        val_str = strings[idx] if idx < len(strings) else val_str
                    cells.append(f"{col_ref}: {val_str}")
                if cells:
                    output_lines.append(f"Row {int(r_num):3d}: " + " | ".join(cells))

with open(r'a:\centrum\scratch\excel_dump.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print(f"Dumped {len(output_lines)} lines to excel_dump.txt")
