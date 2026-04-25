import re

def check_pos_divs_robust(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Start from authorized section
    if "return (" in content:
        content = content[content.find("return (", 1300):]
    
    # Remove comments
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    # Remove self-closing tags <div ... />
    content = re.sub(r'<div[^>]*?/>', '', content)
    
    div_opens = len(re.findall(r'<div\b', content))
    div_closes = len(re.findall(r'</div>', content))
    
    return div_opens, div_closes

print(check_pos_divs_robust('/Volumes/Portable/Website/crm-os/src/components/POS.tsx'))
