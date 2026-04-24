
import sys

def check_balance(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    balance = 0
    for i, line in enumerate(lines):
        opens = line.count('<div')
        closes = line.count('</div>')
        self_closing = line.count('/>')
        
        # Approximate: check for self-closing div
        div_self_closing = line.count('<div') and line.count('/>')
        
        balance += (opens - div_self_closing)
        balance -= closes
        
        if balance < 0:
            print(f"Balance went negative at line {i+1}: {balance}")
            # balance = 0 # reset to find next
            
    print(f"Final balance: {balance}")

if __name__ == "__main__":
    check_balance(sys.argv[1])
