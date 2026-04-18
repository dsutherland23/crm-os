import fs from 'fs';
import path from 'path';

const srcDir = '/Volumes/Portable/Website/crm-os/src';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (fullPath.endsWith('firebase.ts') || fullPath.endsWith('firebase-demo.ts') || fullPath.endsWith('seed.ts')) continue;
      
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Replace static imports
      // From: import { ... } from "firebase/firestore";
      // To: import { ... } from "@/lib/firebase";
      if (content.includes('from "firebase/firestore"')) {
        content = content.replace(/from "firebase\/firestore"/g, 'from "@/lib/firebase"');
        changed = true;
      }

      // Replace dynamic imports
      // From: await import("firebase/firestore")
      // To: await import("@/lib/firebase")
      if (content.includes('import("firebase/firestore")')) {
        content = content.replace(/import\("firebase\/firestore"\)/g, 'import("@/lib/firebase")');
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

walk(srcDir);
