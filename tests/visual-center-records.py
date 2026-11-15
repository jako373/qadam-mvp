from pathlib import Path
from playwright.sync_api import sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    for width in (375, 768, 1440):
        page = browser.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
        page.goto("http://localhost:3000/tests/fixtures/center-records-visual.html?language=kk", wait_until="networkidle")
        page.locator("#center-records").wait_for()
        overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        clipped = page.evaluate("[...document.querySelectorAll('.center-record-section')].some(el => el.scrollWidth > el.clientWidth + 2)")
        screenshot = Path(__file__).parent / f"center-records-{width}.png"
        page.screenshot(path=str(screenshot), full_page=True)
        print(f"{width}px: overflow={overflow}, clipped={clipped}, screenshot={screenshot}")
        assert not overflow and not clipped
        page.close()
    browser.close()
