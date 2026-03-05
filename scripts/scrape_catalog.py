#!/usr/bin/env python3
"""Scrape car catalog from katalogus.hasznaltauto.hu
Output: data/catalog.json (updates the existing file)
"""
import json, time, re, sys
from pathlib import Path
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://katalogus.hasznaltauto.hu"
OUTPUT = Path(__file__).parent.parent / "data" / "catalog.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
DELAY = 1.2

def slugify(text):
    s = text.lower().strip()
    s = re.sub(r"[áÁ]", "a", s); s = re.sub(r"[éÉ]", "e", s)
    s = re.sub(r"[íÍ]", "i", s); s = re.sub(r"[óöőÓÖŐ]", "o", s)
    s = re.sub(r"[úüűÚÜŰ]", "u", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def fetch(url, session):
    time.sleep(DELAY)
    try:
        r = session.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        return BeautifulSoup(r.text, "lxml")
    except Exception as e:
        print(f"  WARN: {url} -> {e}", file=sys.stderr)
        return None

def get_links(soup, pattern):
    results = []
    if not soup: return results
    for a in soup.find_all("a", href=True):
        href = a["href"]
        name = a.get_text(strip=True)
        if pattern in href and name and len(name) > 1:
            results.append((name, href))
    return results

def main():
    session = requests.Session()
    print(f"Fetching catalog from {BASE_URL} ...")
    soup = get_soup(session)
    if not soup:
        print("ERROR: Could not fetch main page", file=sys.stderr)
        sys.exit(1)
    makes_links = extract_makes(soup)
    if not makes_links:
        print("ERROR: No makes found. Check page structure.", file=sys.stderr)
        print("Sample links from page:")
        for a in soup.find_all("a", href=True)[:30]:
            print(f"  {a['href']!r:50} -> {a.get_text(strip=True)!r}")
        sys.exit(1)
    catalog = []
    for make_name, make_href in makes_links:
        make_url = make_href if make_href.startswith("http") else BASE_URL + make_href
        make_slug = slugify(make_name)
        print(f"  Make: {make_name}")
        make_soup = fetch(make_url, session)
        models = []
        for model_name, model_href in extract_models(make_soup, make_href):
            model_url = model_href if model_href.startswith("http") else BASE_URL + model_href
            model_slug = slugify(model_name)
            model_soup = fetch(model_url, session)
            types = extract_types(model_soup, model_href)
            models.append({"name": model_name, "slug": model_slug, "types": types})
        catalog.append({"name": make_name, "slug": make_slug, "models": models})
        print(f"    -> {len(models)} models")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(catalog)} makes to {OUTPUT}")
    js_output = OUTPUT.parent / "catalog-data.js"
    with open(js_output, "w", encoding="utf-8") as f:
        f.write("window.CATALOG_DATA = " + json.dumps(catalog, ensure_ascii=False, indent=2) + ";
")
    print(f"Also wrote {js_output}")

def get_soup(session):
    return fetch(BASE_URL, session)

def extract_makes(soup):
    makes = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        name = a.get_text(strip=True)
        if not name or len(name) < 2: continue
        if "/marka/" in href or re.match(r"^/[a-z0-9\-]+/?$", href):
            if name not in seen and not any(skip in name.lower() for skip in ["kezd", "oldal", "search", "back", "katalog"]):
                makes.append((name, href))
                seen.add(name)
    return makes

def extract_models(soup, make_href):
    models = []
    seen = set()
    if not soup: return models
    for a in soup.find_all("a", href=True):
        href = a["href"]
        name = a.get_text(strip=True)
        if not name or len(name) < 1: continue
        if make_href.rstrip("/") in href and href != make_href:
            parts = href.strip("/").split("/")
            if len(parts) >= 2 and name not in seen:
                models.append((name, href))
                seen.add(name)
    return models

def extract_types(soup, model_href):
    types = []
    seen = set()
    if not soup: return types
    for a in soup.find_all("a", href=True):
        href = a["href"]
        name = a.get_text(strip=True)
        if not name or len(name) < 1: continue
        if model_href.rstrip("/") in href and href != model_href:
            parts = href.strip("/").split("/")
            if len(parts) >= 3 and name not in seen:
                slug = parts[-1]
                types.append({"name": name, "slug": slug})
                seen.add(name)
    return types

if __name__ == "__main__":
    main()
