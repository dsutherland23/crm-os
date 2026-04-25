import re

def find_unclosed_tags(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        # Remove comments
        line = re.sub(r'//.*', '', line)
        
        # Find all tags in line
        tags = re.findall(r'<(div|/div)\b', line)
        for tag in tags:
            if tag == 'div':
                stack.append(i + 1)
            else:
                if stack:
                    stack.pop()
                else:
                    print(f"Extra closing div at line {i + 1}")
    
    for line_num in stack:
        print(f"Unclosed div starting at line {line_num}")

find_unclosed_tags('/Volumes/Portable/Website/crm-os/src/components/POS.tsx')
