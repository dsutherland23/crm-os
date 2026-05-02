import sys
import re

def check_balance(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Simple regex to find tags
    # This won't be perfect but better than line-by-line
    tags = re.findall(r'<(div|/div|motion\.div|/motion\.div)[^>]*>', content)
    
    stack = []
    for i, tag in enumerate(tags):
        if tag.startswith('/'):
            tag_name = tag[1:]
            if not stack:
                print(f"Error: Extra closing tag <{tag}> at index {i}")
                continue
            
            last_tag = stack.pop()
            if last_tag != tag_name:
                print(f"Error: Mismatched closing tag <{tag}> at index {i}, expected </{last_tag}>")
        else:
            # Check if self-closing
            # The regex above needs to be improved to catch self-closing
            pass

    # Improved regex to handle self-closing
    all_tags = re.finditer(r'<(/?)(div|motion\.div)([^>]*?)(/?)>', content)
    stack = []
    for match in all_tags:
        is_closing = match.group(1) == '/'
        tag_name = match.group(2)
        is_self_closing = match.group(4) == '/'
        
        pos = match.start()
        # Find line number
        line_num = content.count('\n', 0, pos) + 1
        
        if is_self_closing:
            continue
            
        if is_closing:
            if not stack:
                print(f"[{line_num}] Extra closing tag </{tag_name}>")
                continue
            last_tag, last_line = stack.pop()
            if last_tag != tag_name:
                print(f"[{line_num}] Mismatched </{tag_name}>, opens <{last_tag}> at {last_line}")
        else:
            stack.append((tag_name, line_num))
            
    if stack:
        print("\nUnclosed tags:")
        for tag, line in stack:
            print(f"<{tag}> at {line}")

if __name__ == "__main__":
    check_balance(sys.argv[1])
