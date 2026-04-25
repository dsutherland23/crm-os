import re

def check_pos_divs(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    # Start counting from line 1344
    content = "".join(lines[1343:])
    
    # Remove comments
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    div_opens = len(re.findall(r'<div\b', content))
    div_closes = len(re.findall(r'</div>', content))
    
    return div_opens, div_closes

print(check_pos_divs('/Volumes/Portable/Website/crm-os/src/components/POS.tsx'))
