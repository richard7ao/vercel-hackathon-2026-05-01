#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DT="$(cat "$ROOT/.demo-target-path")"
WATERMARK="$(cat "$ROOT/.demo-watermark")"

echo "// reset-demo · watermark=$WATERMARK"

# ── 1. KV reset ──────────────────────────────────────────────────
# Delete post-watermark deploy records, verdicts, threats, investigators
# Keep seeded history intact
node -e "
const { config } = require('dotenv');
config({ path: '$ROOT/.env.local' });
const { createClient } = require('redis');

async function main() {
  const client = createClient({ url: process.env.REDIS_URL });
  client.on('error', () => {});
  await client.connect();

  // Delete deploys that are not seeded
  const deployKeys = [];
  for await (const key of client.scanIterator({ MATCH: 'deploys:*', COUNT: 100 })) {
    if (typeof key === 'string') deployKeys.push(key);
    else deployKeys.push(...key);
  }
  for (const key of deployKeys) {
    if (key.startsWith('deploys:raw:')) continue;
    const raw = await client.get(key);
    if (!raw) continue;
    try {
      const rec = JSON.parse(raw);
      if (rec.seeded) continue;
      await client.del(key);
    } catch { await client.del(key); }
  }

  // Delete verdicts
  for await (const key of client.scanIterator({ MATCH: 'verdicts:*', COUNT: 100 })) {
    const k = typeof key === 'string' ? key : key[0];
    if (k) await client.del(k);
  }

  // Delete threats
  for await (const key of client.scanIterator({ MATCH: 'threats:*', COUNT: 100 })) {
    const k = typeof key === 'string' ? key : key[0];
    if (k) await client.del(k);
  }

  // Delete investigators
  for await (const key of client.scanIterator({ MATCH: 'investigator:*', COUNT: 100 })) {
    const k = typeof key === 'string' ? key : key[0];
    if (k) await client.del(k);
  }

  // Delete pause states
  for await (const key of client.scanIterator({ MATCH: 'pause_state:*', COUNT: 100 })) {
    const k = typeof key === 'string' ? key : key[0];
    if (k) await client.del(k);
  }

  // Delete signal keys
  for await (const key of client.scanIterator({ MATCH: 'signal:*', COUNT: 100 })) {
    const k = typeof key === 'string' ? key : key[0];
    if (k) await client.del(k);
  }

  // Restore history snapshot if available
  const fs = require('fs');
  const snapshotPath = '$ROOT/.demo-history-snapshot.json';
  if (fs.existsSync(snapshotPath)) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    for (const [key, value] of Object.entries(snapshot)) {
      await client.set(key, JSON.stringify(value));
    }
  }

  await client.quit();
  console.log('  KV reset complete');
}
main().catch(e => { console.error(e); process.exit(1); });
" || echo "  KV reset skipped (redis unavailable)"

# ── 2. Demo-target git reset ─────────────────────────────────────
cd "$DT"
git checkout main 2>/dev/null || true
git reset --hard "$WATERMARK" 2>/dev/null
# Only force-push if origin exists
if git remote get-url origin &>/dev/null; then
  git push --force-with-lease origin main 2>/dev/null || echo "  push skipped (no remote or rejected)"
fi
echo "  demo-target main → $WATERMARK"

# ── 3. Discord reset message ─────────────────────────────────────
if [ -n "${DISCORD_BOT_TOKEN:-}" ] && [ -n "${DISCORD_CHANNEL_ID:-}" ]; then
  curl -s -X POST "https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages" \
    -H "Authorization: Bot ${DISCORD_BOT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"content":"// demo reset · ready ·"}' > /dev/null 2>&1 \
    && echo "  // demo reset · ready · (Discord notified)" \
    || echo "  // demo reset · ready · (Discord notification failed)"
else
  echo "  // demo reset · ready · (Discord skipped — no token)"
fi

# ── 4. Sentinel ──────────────────────────────────────────────────
date -u +%Y-%m-%dT%H:%M:%SZ > "$ROOT/.last-reset-at"
echo "// reset complete · $(cat "$ROOT/.last-reset-at")"
