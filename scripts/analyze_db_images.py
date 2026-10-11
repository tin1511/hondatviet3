import json
import sys
from collections import defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/heritage_db_items.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

print(f"Total items in HERITAGE_DATABASE: {len(items)}")

# Count unique URLs
url_to_items = defaultdict(list)
for it in items:
    url_to_items[it['imageUrl']].append(it)

print(f"Total unique imageUrls in HERITAGE_DATABASE: {len(url_to_items)}")

# Duplicated URLs
dups = {k: v for k, v in url_to_items.items() if len(v) > 1}
print(f"Duplicated URLs in HERITAGE_DATABASE: {len(dups)}")
for url, p_list in sorted(dups.items(), key=lambda x: -len(x[1])):
    print(f"\nURL ({len(p_list)} places): {url}")
    for it in p_list:
        print(f"   - [{it['id']}] {it['name']} ({it['province']})")

# Check match with VERIFIED_HERITAGE_IMAGE_REGISTRY
with open('scripts/registry_items.json', 'r', encoding='utf-8') as f:
    reg_items = json.load(f)
reg_map = {r['id']: r for r in reg_items}

unmatched = []
different_url = []
for it in items:
    if it['id'] not in reg_map:
        unmatched.append(it)
    else:
        reg = reg_map[it['id']]
        if reg['imageUrl'] != it['imageUrl']:
            different_url.append({'item': it, 'registry': reg})

print(f"\nItems NOT in VERIFIED_HERITAGE_IMAGE_REGISTRY: {len(unmatched)}")
for u in unmatched:
    print(f"   - [{u['id']}] {u['name']} ({u['province']}) -> {u['imageUrl']}")

print(f"\nItems in registry but with DIFFERENT imageUrl in HERITAGE_DATABASE: {len(different_url)}")
for d in different_url:
    print(f"   - [{d['item']['id']}] {d['item']['name']}")
    print(f"       DB:       {d['item']['imageUrl']}")
    print(f"       Registry: {d['registry']['imageUrl']}")
