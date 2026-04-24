import sys

def check_div_balance(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    balance = 0
    stack = []
    
    for i, line in enumerate(lines):
        line_num = i + 1
        # Simple parser for <div and </div>
        # This is crude but might find the general area
        pos = 0
        while True:
            start_div = line.find('<div', pos)
            end_div = line.find('</div>', pos)
            
            if start_div == -1 and end_div == -1:
                break
                
            if start_div != -1 and (end_div == -1 or start_div < end_div):
                # Check if it's really a <div (followed by space or >)
                if start_div + 4 < len(line) and line[start_div+4] in [' ', '>', '/']:
                    if line[start_div:start_div+6] == '<div/>' or (start_div + 5 < len(line) and line[start_div:start_div+7] == '<div />'):
                        # Self-closing div (rare in JSX but possible)
                        pass
                    else:
                        balance += 1
                        stack.append(line_num)
                pos = start_div + 4
            else:
                balance -= 1
                if stack:
                    stack.pop()
                else:
                    print(f"Extra </div> at line {line_num}")
                pos = end_div + 6
        
        # if line_num % 100 == 0:
        #    print(f"Line {line_num}: balance {balance}")
            
    print(f"Final balance: {balance}")
    if stack:
        print(f"Unclosed <div> tags started at lines: {stack[-10:]}")

if __name__ == "__main__":
    check_div_balance(sys.argv[1])
