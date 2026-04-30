import fs from 'fs';

const content = fs.readFileSync('/Volumes/Portable/Website/crm-os/src/components/CRM.tsx', 'utf8');
const lines = content.split('\n');

const tags = ['div', 'Button', 'Dialog', 'DialogContent', 'Card', 'Tabs', 'TabsContent', 'Badge'];
const stack = [];

lines.forEach((line, index) => {
  const lineNum = index + 1;
  
  // Find all opening tags
  const openMatches = [...line.matchAll(/<([a-zA-Z]+)(?:\s|(?=>))/g)];
  openMatches.forEach(match => {
    const tagName = match[1];
    if (tags.includes(tagName) && !line.includes(`</${tagName}>`) && !line.includes('/>')) {
      stack.push({ tag: tagName, line: lineNum });
    }
  });

  // Find all closing tags
  const closeMatches = [...line.matchAll(/<\/([a-zA-Z]+)>/g)];
  closeMatches.forEach(match => {
    const tagName = match[1];
    if (stack.length > 0 && stack[stack.length - 1].tag === tagName) {
      stack.pop();
    }
  });
});

console.log('Unclosed Tags Stack:');
console.log(JSON.stringify(stack, null, 2));
