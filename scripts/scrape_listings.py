#!/usr/bin/env python3
"""Scrape car listings from hasznaltauto.hu, mobile.de, autoscout24.
Output: data/listings.json
"""
import json, time, re, sys, hashlib
from datetime import datetime, timezone
from pathlib import Path
import requests
from bs4 import BeautifulSoup

OUTPUT = Path(__file__).parent.parent / "data" / "listings.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}
DELAY = 1.5
MAX_PER_MAKE = 12

TOP_MAKES = [
    ("volkswagen", "Volkswagen"), ("opel", "Opel"), ("ford", "Ford"),
    ("skoda", "Skoda"), ("suzuki", "Suzuki"), ("renault", "Renault"),
    ("audi", "Audi"), ("bmw", "BMW"), ("toyota", "Toyota"),
    ("honda", "Honda"), ("kia", "Kia"), ("hyundai", "Hyundai"),
    ("mercedes-benz", "Mercedes-Benz"), ("peugeot", "Peugeot"), ("seat", "SEAT"),
]

session = requests.Session()
session.headers.update(HEADERS)

def fetch(url):
    time.sleep(DELAY)
    try:
        r = session.get(url, timeout=20)
        r.raise_for_status()
        return BeautifulSoup(r.text, "lxml")
    except Exception as e:
        print(f"  WARN {url}: {e}", file=sys.stderr)
        return None

def make_id(*parts):
    return hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()[:12]

def scrape_hasznaltauto(make_slug, make_name):
    url = f"https://www.hasznaltauto.hu/szemelyauto/{make_slug}"
    print(f"  hasznaltauto.hu -> {make_name}")
    soup = fetch(url)
    if not soup: return []
    listings = []
    cards = soup.select(".talalati-sor, .listing-item, [data-adid]")
    if not cards:
        cards = soup.select(".col-xs-12.talalati-sor")
    for card in cards[:MAX_PER_MAKE]:
        try:
            title_el = card.select_one(".cim, h3, .title, [class*=title]")
            title = title_el.get_text(strip=True) if title_el else ""
            price_el = card.select_one(".vetelar, .price, [class*=price]")
            price_text = price_el.get_text(strip=True).replace(" ", "").replace("\xa0", "") if price_el else ""
            price_num = int(re.sub(r"[^\d]", "", price_text)) if re.search(r"\d{4,}", price_text) else None
            year_el = card.select_one(".evjarat, [class*=year]")
            year_text = year_el.get_text(strip=True) if year_el else ""
            year = int(re.search(r"(19|20)\d{2}", year_text).group()) if re.search(r"(19|20)\d{2}", year_text) else None
            km_el = card.select_one(".km, [class*=km], [class*=mileage]")
            km_text = km_el.get_text(strip=True).replace(" ", "").replace("\xa0", "") if km_el else ""
            km = int(re.sub(r"[^\d]", "", km_text)) if re.search(r"\d{4,}", km_text) else None
            link_el = card.select_one("a[href*=szemelyauto]") or card.select_one("a[href]")
            link = link_el["href"] if link_el else ""
            if link and not link.startswith("http"): link = "https://www.hasznaltauto.hu" + link
            img_el = card.select_one("img[src*=kep], img[src*=photo], img[data-src]")
            img = (img_el.get("data-src") or img_el.get("src", "")) if img_el else ""
            if not title and not link: continue
            listings.append({
                "id": make_id("hu", link),
                "source": "hasznaltauto",
                "make": make_name, "make_slug": make_slug,
                "model": "", "type": "",
                "title": title, "year": year, "km": km,
                "price": price_num, "price_huf": price_num, "currency": "HUF",
                "link": link, "image": img,
            })
        except Exception as e:
            continue
    return listings

def scrape_mobile_de(make_name):
    from urllib.parse import urlencode
    params = {"isSearchRequest": "true", "makeModelVariant1.make": make_name, "pageSize": "20"}
    url = "https://suchen.mobile.de/fahrzeuge/search.html?" + urlencode(params)
    print(f"  mobile.de -> {make_name}")
    soup = fetch(url)
    if not soup: return []
    listings = []
    cards = soup.select("[class*=result-item], [class*=listing], article[data-listing-id]")
    for card in cards[:MAX_PER_MAKE]:
        try:
            title_el = card.select_one("h2, h3, [class*=headline], [class*=title]")
            title = title_el.get_text(strip=True) if title_el else ""
            price_el = card.select_one("[class*=price], [class*=Price]")
            price_text = price_el.get_text(strip=True).replace("\xa0", "").replace(" ", "") if price_el else ""
            price_num = int(re.sub(r"[^\d]", "", price_text)) if re.search(r"\d{3,}", price_text) else None
            price_huf = int(price_num * 400) if price_num else None
            year_match = re.search(r"(19|20)\d{2}", card.get_text())
            year = int(year_match.group()) if year_match else None
            km_match = re.search(r"(\d[\d\.]+)\s*km", card.get_text(), re.I)
            km = int(re.sub(r"\.", "", km_match.group(1))) if km_match else None
            link_el = card.select_one("a[href*=mobile.de], a[href*=/fahrzeuge/]") or card.select_one("a[href]")
            link = link_el["href"] if link_el else ""
            if link and not link.startswith("http"): link = "https://suchen.mobile.de" + link
            img_el = card.select_one("img[src], img[data-src]")
            img = (img_el.get("data-src") or img_el.get("src", "")) if img_el else ""
            if not title and not link: continue
            listings.append({
                "id": make_id("mob", link),
                "source": "mobile",
                "make": make_name, "make_slug": "",
                "model": "", "type": "",
                "title": title, "year": year, "km": km,
                "price": price_num, "price_huf": price_huf, "currency": "EUR",
                "link": link, "image": img,
            })
        except Exception:
            continue
    return listings

def scrape_autoscout24(make_name, make_slug):
    url = f"https://www.autoscout24.com/lst/{make_slug}"
    print(f"  autoscout24 -> {make_name}")
    soup = fetch(url)
    if not soup: return []
    listings = []
    cards = soup.select("article, [data-testid*=listing], [class*=ListItem]")
    for card in cards[:MAX_PER_MAKE]:
        try:
            title_el = card.select_one("h2, h3, [class*=Title], [class*=title]")
            title = title_el.get_text(strip=True) if title_el else ""
            price_el = card.select_one("[class*=Price], [class*=price], [data-testid*=price]")
            price_text = price_el.get_text(strip=True).replace("\xa0", "").replace(" ", "").replace(".", "").replace(",", "") if price_el else ""
            price_num = int(re.sub(r"[^\d]", "", price_text)) if re.search(r"\d{3,}", price_text) else None
            price_huf = int(price_num * 400) if price_num else None
            year_match = re.search(r"(19|20)\d{2}", card.get_text())
            year = int(year_match.group()) if year_match else None
            km_text = card.get_text()
            km_match = re.search(r"([\d,\.]+)\s*km", km_text, re.I)
            km_raw = re.sub(r"[,\.]", "", km_match.group(1)) if km_match else None
            km = int(km_raw) if km_raw and km_raw.isdigit() else None
            link_el = card.select_one("a[href]")
            link = link_el["href"] if link_el else ""
            if link and not link.startswith("http"): link = "https://www.autoscout24.com" + link
            img_el = card.select_one("img[src], img[data-src]")
            img = (img_el.get("data-src") or img_el.get("src", "")) if img_el else ""
            if not title and not link: continue
            listings.append({
                "id": make_id("asc", link),
                "source": "autoscout",
                "make": make_name, "make_slug": make_slug,
                "model": "", "type": "",
                "title": title, "year": year, "km": km,
                "price": price_num, "price_huf": price_huf, "currency": "EUR",
                "link": link, "image": img,
            })
        except Exception:
            continue
    return listings

def main():
    all_listings = []
    for make_slug, make_name in TOP_MAKES:
        print(f"Scraping: {make_name}")
        all_listings += scrape_hasznaltauto(make_slug, make_name)
        all_listings += scrape_mobile_de(make_name)
        all_listings += scrape_autoscout24(make_name, make_slug)
    seen_ids = set()
    unique = []
    for l in all_listings:
        if l["id"] not in seen_ids:
            seen_ids.add(l["id"])
            unique.append(l)
    result = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "count": len(unique),
        "listings": unique,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Done. {len(unique)} listings saved to {OUTPUT}")

if __name__ == "__main__":
    main()
