from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 800},
        locale="hu-HU",
        timezone_id="Europe/Budapest"
    )
    page = ctx.new_page()
    stealth_sync(page)
    print("Navigating with stealth...")
    page.goto("https://katalogus.hasznaltauto.hu/", wait_until="domcontentloaded", timeout=30000)
    print("Title after load:", page.title())
    time.sleep(10)
    print("Title after 10s:", page.title())
    print("URL:", page.url)
    print("HTML length:", len(page.content()))
    links = page.eval_on_selector_all("a[href]", "els => els.map(a => ({href: a.href, text: a.textContent.trim()}))")
    count = 0
    for l in links:
        if l["text"] and len(l["text"]) > 1 and "cloudflare" not in l["href"].lower():
            print("  " + str(l["href"]).ljust(70) + " -> " + l["text"])
            count += 1
            if count >= 100:
                break
    if count == 0:
        print("No links found. Page snippet:")
        print(page.content()[:1000])
    browser.close()
