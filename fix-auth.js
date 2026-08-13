const { join } = require('path');
const { readdirSync, readFileSync, writeFileSync, statSync } = require('fs');

function walk(dir) {
  let results = [];
  const list = readdirSync(dir);
  list.forEach((file) => {
    file = join(dir, file);
    const stat = statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src/app/api');
files.forEach(f => {
  if (!f.endsWith('.ts')) return;
  let text = readFileSync(f, 'utf8');
  let changed = false;

  if (text.includes('requireAuth(["ADMIN", "OWNER"]')) {
    text = text.replace(/requireAuth\(\["ADMIN", "OWNER"\]/g, 'requireAuth(["OWNER"]');
    changed = true;
  }
  
  if (text.includes('requireAuth(["ADMIN"], { module: "shift_config", action: "EDIT" })')) {
    text = text.replace(/requireAuth\(\["ADMIN"\], \{ module: "shift_config", action: "EDIT" \}\)/g, 'requireAuth(["OWNER"], { module: "shift_config", action: "EDIT" })');
    changed = true;
  }

  if (text.includes('requireAuth(["ADMIN", "SCHEDULER"], [')) {
    text = text.replace(/requireAuth\(\["ADMIN", "SCHEDULER"\], \[/g, 'requireAuth(["OWNER"], [');
    changed = true;
  }
  
  if (f.includes('/stores/')) {
    if (text.includes('requireAuth(["ADMIN"])')) {
      text = text.replace(/requireAuth\(\["ADMIN"\]\)/g, 'requireAuth(["OWNER"], { module: "store", action: "EDIT" })');
      changed = true;
    }
    if (text.includes('requireAuth()')) {
      text = text.replace(/requireAuth\(\)/g, 'requireAuth(["OWNER"], { module: "store", action: "VIEW" })');
      changed = true;
    }
  }

  if (f.includes('/employees')) {
    if (text.includes('requireAuth(["ADMIN", "SCHEDULER"])')) {
      text = text.replace(/requireAuth\(\["ADMIN", "SCHEDULER"\]\)/g, 'requireAuth(["OWNER"], { module: "employees", action: "VIEW" })');
      changed = true;
    }
    if (text.includes('requireAuth(["ADMIN"])')) {
      text = text.replace(/requireAuth\(\["ADMIN"\]\)/g, 'requireAuth(["OWNER"], { module: "employees", action: "EDIT" })');
      changed = true;
    }
  }
  
  if (changed) {
    writeFileSync(f, text);
    console.log("Updated", f);
  }
});
