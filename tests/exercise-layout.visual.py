"""Run via webapp-testing/with_server.py with PYTHONPATH pointing at Playwright."""
from pathlib import Path
from tempfile import gettempdir
from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:8765/tests/fixtures/exercise-layout.html"
OUT = Path(gettempdir()) / "qadam-layout-visual"
OUT.mkdir(exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        headless=True,
    )
    for mode in ("center", "parent"):
        page = browser.new_page(viewport={"width": 375, "height": 900}, device_scale_factor=1)
        page.goto(f"{BASE}?mode={mode}")
        page.wait_for_load_state("networkidle")
        page.locator('html[data-ready="true"]').wait_for()
        for width in (375, 768, 1024, 1440, 1920):
            page.set_viewport_size({"width": width, "height": 900})
            root = ".center-main" if mode == "center" else ".daily-exercise"
            steps = ".center-lesson-detail ol li" if mode == "center" else ".three-steps li"
            image = ".center-lesson-detail img" if mode == "center" else ".daily-exercise img"
            metrics = page.evaluate("""({root, steps, image}) => {
              const box = (selector) => document.querySelector(selector)?.getBoundingClientRect();
              const img = document.querySelector(image);
              return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
                rootWidth: box(root)?.width, stepWidth: box(steps)?.width,
                imageWidth: box(image)?.width, imageLoaded: img?.naturalWidth > 0 };
            }""", {"root": root, "steps": steps, "image": image})
            page.screenshot(path=str(OUT / f"{mode}-{width}.png"), full_page=True)
            assert metrics["pageWidth"] <= width + 1, (mode, width, metrics)
            assert metrics["stepWidth"] >= (220 if width < 768 else 330), (mode, width, metrics)
            assert metrics["imageWidth"] >= (240 if width < 768 else 300), (mode, width, metrics)
            assert metrics["imageLoaded"], (mode, width, metrics)
            if mode == "center" and width >= 1440:
                assert metrics["rootWidth"] >= width * .9, metrics
            print(mode, width, metrics)
        page.close()
    browser.close()
