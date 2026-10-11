import re
import os
import json
import sys
from collections import defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

files = [
    ('vietnamHeritageData.ts', 'src/data/vietnamHeritageData.ts'),
    ('vietnamTourismPlaces.ts', 'src/data/vietnamTourismPlaces.ts'),
    ('vietnamExpandedLocations.ts', 'src/data/vietnamExpandedLocations.ts'),
    ('vietnamNationwideHeritages.ts', 'src/data/vietnamNationwideHeritages.ts')
]

all_items = []

for fname, relpath in files:
    if not os.path.exists(relpath):
        continue
    with open(relpath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match each object in array
    # A more robust regex to extract fields:
    blocks = re.findall(r"\{\s*id:\s*['\"]([^'\"]+)['\"].*?\n\s*\},?", content, re.DOTALL)
    print(f"File {fname}: found blocks regex count = {len(blocks)}")
    
    # Let's match each item by splitting or finding id:...
    item_matches = re.finditer(r"id:\s*['\"]([^'\"]+)['\"]", content)
    indices = [m.start() for m in item_matches]
    indices.append(len(content))
    
    for i in range(len(indices) - 1):
        chunk = content[indices[i]:indices[i+1]]
        id_m = re.search(r"id:\s*['\"]([^'\"]+)['\"]", chunk)
        name_m = re.search(r"name:\s*['\"]([^'\"]+)['\"]", chunk)
        prov_m = re.search(r"province:\s*['\"]([^'\"]+)['\"]", chunk)
        img_m = re.search(r"imageUrl:\s*['\"]([^'\"]+)['\"]", chunk)
        
        if id_m and name_m:
            all_items.append({
                'file': fname,
                'id': id_m.group(1),
                'name': name_m.group(1),
                'province': prov_m.group(1) if prov_m else '',
                'imageUrl': img_m.group(1) if img_m else ''
            })

print(f"Total extracted items: {len(all_items)}")

# Check duplicate IDs
id_counts = defaultdict(list)
for it in all_items:
    id_counts[it['id']].append(it)

dup_ids = {k: v for k, v in id_counts.items() if len(v) > 1}
print(f"Duplicate IDs: {len(dup_ids)}")

# Check duplicate image URLs
img_counts = defaultdict(list)
for it in all_items:
    img_counts[it['imageUrl']].append(it)

dup_imgs = {k: v for k, v in img_counts.items() if len(v) > 1}
print(f"Duplicate image URLs: {len(dup_imgs)}")

# Check image domains
domains = defaultdict(int)
for it in all_items:
    url = it['imageUrl']
    m = re.match(r'https?://([^/]+)', url)
    dom = m.group(1) if m else 'local/relative'
    domains[dom] += 1

print("\nImage domains breakdown:")
for dom, cnt in sorted(domains.items(), key=lambda x: -x[1]):
    print(f"  {dom}: {cnt}")

print("\nTop duplicated image URLs:")
sorted_dup_imgs = sorted(dup_imgs.items(), key=lambda x: -len(x[1]))
for url, items in sorted_dup_imgs:
    print(f"\nURL ({len(items)} places): {url}")
    for it in items:
        print(f"   - [{it['file']}] {it['name']} ({it['province']}) (id: {it['id']})")

with open('scripts/extracted_places.json', 'w', encoding='utf-8') as f:
    json.dump(all_items, f, ensure_ascii=False, indent=2)

print("\nSaved full extracted items to scripts/extracted_places.json")
