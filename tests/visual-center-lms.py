import os
from pathlib import Path
from playwright.sync_api import sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    for width in (375, 768, 1440):
        page = browser.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
        page.goto(f"http://localhost:{os.environ.get('PORT', '3000')}/tests/fixtures/center-lms-visual.html", wait_until="networkidle")
        page.locator(".center-nav-button").first.wait_for()
        for view, filename in (("students", "students"), ("payments", "payments")):
            page.locator(f'.center-nav [data-view="{view}"]').click()
            assert not page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
            path = Path(__file__).parent / f"center-lms-{filename}-{width}.png"
            page.screenshot(path=str(path), full_page=True)
            print(path)
        page.locator('.center-nav [data-view="students"]').click()
        page.locator('[data-records]').first.click()
        page.locator(".center-record-calendar").wait_for()
        assert page.locator('.center-record-day.is-present').count() == 1
        assert not page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        path = Path(__file__).parent / f"center-lms-attendance-{width}.png"
        page.screenshot(path=str(path), full_page=True)
        print(path)
        page.close()
    browser.close()
