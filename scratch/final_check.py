import re

def check_divs(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Remove comments
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    # Remove self-closing tags <div ... />
    # Also handle multiline self-closing divs
    content = re.sub(r'<div[^>]*?/>', '', content, flags=re.DOTALL)
    
    div_opens = len(re.findall(r'<div\b', content))
    div_closes = len(re.findall(r'</div>', content))
    
    return div_opens, div_closes

print("POS.tsx:", check_divs('/Volumes/Portable/Website/crm-os/src/components/POS.tsx'))
print("Inventory.tsx:", check_divs('/Volumes/Portable/Website/crm-os/src/components/Inventory.tsx'))
