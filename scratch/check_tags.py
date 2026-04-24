
import sys

def check_balance(filename, tag_open, tag_close):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    balance = 0
    for i, line in enumerate(lines):
        opens = line.count(tag_open)
        closes = line.count(tag_close)
        
        # Approximate: check for self-closing
        self_closing = line.count(tag_open) and line.count('/>')
        
        balance += (opens - self_closing)
        balance -= closes
        
        if balance < 0:
            print(f"Balance for {tag_open} went negative at line {i+1}: {balance}")
            # balance = 0 # reset to find next
            
    print(f"Final balance for {tag_open}: {balance}")

if __name__ == "__main__":
    check_balance(sys.argv[1], sys.argv[2], sys.argv[3])
