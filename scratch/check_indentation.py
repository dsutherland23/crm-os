def check_indentation(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('<div') and not stripped.endswith('/>'):
            stack.append((i + 1, line))
        elif stripped.startswith('</div>'):
            if stack:
                stack.pop()
            else:
                print(f"Extra closing div at line {i + 1}")
    
    for line_num, content in stack:
        print(f"Unclosed div at line {line_num}: {content.strip()}")

check_indentation('/Volumes/Portable/Website/crm-os/src/components/POS.tsx')
