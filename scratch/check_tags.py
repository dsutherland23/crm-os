import re

def check_tags(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Remove comments
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    # Simple tag counting (very rough for JSX but can give a hint)
    div_opens = len(re.findall(r'<div\b', content))
    div_closes = len(re.findall(r'</div>', content))
    
    scroll_opens = len(re.findall(r'<ScrollArea\b', content))
    scroll_closes = len(re.findall(r'</ScrollArea>', content))
    
    return {
        'div': (div_opens, div_closes),
        'ScrollArea': (scroll_opens, scroll_closes)
    }

print(check_tags('/Volumes/Portable/Website/crm-os/src/components/POS.tsx'))
