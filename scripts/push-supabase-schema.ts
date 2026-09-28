// Push the Prisma-generated SQL to Supabase Management API
// Splits SQL into statements and sends in batches
import { readFileSync } from 'fs';

const PROJECT_REF = 'ujsrzmxmmfrxiwwpmgfc';
const SB_TOKEN = process.env.SB_TOKEN!;
const QUERY_ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

function splitSql(sql: string): string[] {
  // First strip comments (both -- and /* */)
  const stripped = sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      // Don't strip if -- is inside a string (basic heuristic)
      const singleQuotes = (line.slice(0, idx === -1 ? undefined : idx).match(/'/g) || []).length;
      if (idx >= 0 && singleQuotes % 2 === 0) {
        return line.slice(0, idx);
      }
      return line;
    })
    .join('\n');

  const statements: string[] = [];
  let current = '';
  let inString = false;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    current += c;
    if (inString) {
      if (c === "'") {
        if (stripped[i + 1] === "'") {
          current += stripped[i + 1];
          i++;
          continue;
        }
        inString = false;
      }
    } else {
      if (c === "'") {
        inString = true;
      } else if (c === ';') {
        const trimmed = current.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }
        current = '';
      }
    }
  }
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }
  return statements;
}

async function executeSql(stmt: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(QUERY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: stmt }),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    // The endpoint returns the result rows as JSON array
    // Empty results come back as `[]`
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  const sql = readFileSync('/tmp/opera-migration.sql', 'utf-8');
  const statements = splitSql(sql);
  console.log(`Split into ${statements.length} statements`);

  let passed = 0;
  let failed = 0;
  const errors: string[] = [];
  const seenErrors = new Set<string>();

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Skip CREATE SCHEMA (public exists)
    if (stmt.startsWith('CREATE SCHEMA')) {
      passed++;
      continue;
    }
    const res = await executeSql(stmt);
    if (res.ok) {
      passed++;
    } else {
      // Some "errors" are harmless — e.g., "already exists" during retry
      if (res.error && (res.error.includes('already exists') || res.error.includes('duplicate'))) {
        passed++;
      } else {
        failed++;
        const errKey = (res.error || '').slice(0, 100);
        if (!seenErrors.has(errKey)) {
          seenErrors.add(errKey);
          errors.push(`Stmt #${i + 1}: ${errKey}`);
        }
      }
    }
    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${i + 1}/${statements.length} (passed=${passed}, failed=${failed})`);
    }
  }

  console.log(`\nFinal: ${passed}/${statements.length} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('First few errors:');
    errors.slice(0, 10).forEach((e) => console.log(`  ${e}`));
  }
}

main().catch(console.error);
