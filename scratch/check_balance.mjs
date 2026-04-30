import fs from 'fs';

const content = fs.readFileSync('/Volumes/Portable/Website/crm-os/src/components/CRM.tsx', 'utf8');

const tags = ['div', 'Dialog', 'DialogContent', 'Button', 'Card', 'CardHeader', 'CardContent', 'CardTitle', 'Badge'];
const counts = {};

tags.forEach(tag => {
  const open = (content.match(new RegExp(`<${tag}(\\s|>)`, 'g')) || []).length;
  const close = (content.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  counts[tag] = open - close;
});

const braces = (content.match(/\{/g) || []).length - (content.match(/\}/g) || []).length;
const parens = (content.match(/\(/g) || []).length - (content.match(/\)/g) || []).length;

console.log('Tag Imbalances (Open - Close):');
console.log(JSON.stringify(counts, null, 2));
console.log('Braces Imbalance:', braces);
console.log('Parens Imbalance:', parens);
