import re

def check_file(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Remove comments
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    # Remove self-closing <div ... />
    content = re.sub(r'<div[^>]*?/>', '', content, flags=re.DOTALL)
    
    # Find all <div and </div>
    tokens = re.findall(r'<(div|/div)\b', content)
    
    stack_count = 0
    for token in tokens:
        if token == 'div':
            stack_count += 1
        else:
            stack_count -= 1
            if stack_count < 0:
                print(f"Extra closing div found in {filename}")
                stack_count = 0
    
    if stack_count > 0:
        print(f"{filename} has {stack_count} unclosed divs")
    else:
        print(f"{filename} is balanced")

check_file('/Volumes/Portable/Website/crm-os/src/components/POS.tsx')
check_file('/Volumes/Portable/Website/crm-os/src/components/Inventory.tsx')
