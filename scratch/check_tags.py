import sys

def check_balance(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        # Very crude check for <div and </div
        # This doesn't handle strings or comments well, but might give a hint
        
        # Find all <div (not preceded by /)
        import re
        opens = re.findall(r'<div', line)
        for _ in opens:
            stack.append(('div', line_num))
        
        # Find all </div
        closes = re.findall(r'</div', line)
        for _ in closes:
            if not stack:
                print(f"Error: Extra </div> at line {line_num}")
            else:
                tag, start_line = stack.pop()
                if tag != 'div':
                    print(f"Error: Mismatched </div> at line {line_num}, opens {tag} at line {start_line}")
        
        # Find all <motion.div
        m_opens = re.findall(r'<motion\.div', line)
        for _ in m_opens:
            # Check if self-closing
            if not '/>' in line[line.find('<motion.div'):]:
                 stack.append(('motion.div', line_num))
        
        # Find all </motion.div
        m_closes = re.findall(r'</motion\.div', line)
        for _ in m_closes:
            if not stack:
                print(f"Error: Extra </motion.div> at line {line_num}")
            else:
                tag, start_line = stack.pop()
                if tag != 'motion.div':
                    print(f"Error: Mismatched </motion.div> at line {line_num}, opens {tag} at line {start_line}")

    if stack:
        for tag, line_num in stack:
            print(f"Error: Unclosed {tag} at line {line_num}")

if __name__ == "__main__":
    check_balance(sys.argv[1])
