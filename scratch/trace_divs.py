import re

def trace_divs(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        # Remove comments and strings
        clean_line = re.sub(r'//.*', '', line)
        clean_line = re.sub(r'(".*?"|\'.*?\')', '', clean_line)
        
        # Handle multiline tags by combining? No, just look for <div and </div
        # Also ignore self-closing <div ... />
        
        # Find all <div
        opens = re.findall(r'<div\b', clean_line)
        # Find all />
        self_closes = re.findall(r'/>', clean_line) # This is risky but let's see
        # Find all </div
        closes = re.findall(r'</div>', clean_line)
        
        for _ in range(len(opens)):
            stack.append(i + 1)
        
        # This is the tricky part: how many of the opens were self-closing?
        # If a line has both <div and />, it's likely self-closing.
        if '<div' in clean_line and '/>' in clean_line:
            stack.pop()
            
        for _ in range(len(closes)):
            if stack:
                stack.pop()
            else:
                print(f"Extra closing div at line {i + 1}")
    
    print(f"Remaining stack for {filename}: {stack}")

trace_divs('/Volumes/Portable/Website/crm-os/src/components/POS.tsx')
trace_divs('/Volumes/Portable/Website/crm-os/src/components/Inventory.tsx')
