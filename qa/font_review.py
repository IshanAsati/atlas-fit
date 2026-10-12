from playwright.sync_api import sync_playwright
from pathlib import Path

OUT = Path(r'C:\Users\Ishan\AppData\Local\Temp\opencode\atlas-font-review')
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:5194/', wait_until='networkidle')
    pg.get_by_label('Display Name (optional)').fill('Font QA')
    for _ in range(3):
        pg.get_by_role('button', name='Continue', exact=True).click()
    pg.get_by_role('button', name='Continue to Equipment').click()
    for _ in range(4):
        pg.get_by_role('button', name='Continue', exact=True).click()
    pg.get_by_role('button', name='Skip (No Restrictions)').click()
    pg.get_by_role('button', name='Generate Plan Preview').click()
    pg.get_by_role('button', name='Start Training').click()
    pg.get_by_role('heading', name='Today', exact=True).wait_for()
    pg.wait_for_load_state('networkidle')
    pg.evaluate('scrollTo(0,0)')
    print('HEADING-FONT', pg.evaluate("getComputedStyle(document.querySelector('.today-title')).fontFamily"))
    print('BODY-FONT', pg.evaluate("getComputedStyle(document.querySelector('.today-workout .sub')).fontFamily"))
    assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
    pg.screenshot(path=str(OUT / 'today-390.png'), full_page=True)
    pg.set_viewport_size({'width': 1440, 'height': 1000})
    pg.wait_for_timeout(300)
    assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
    pg.screenshot(path=str(OUT / 'today-1440.png'), full_page=True)
    pg.set_viewport_size({'width': 390, 'height': 844})
    pg.get_by_role('button', name='Start workout', exact=True).first.click()
    pg.locator('.active-title').wait_for()
    pg.wait_for_load_state('networkidle')
    pg.evaluate('scrollTo(0,0)')
    print('WORKOUT-H1', pg.evaluate("getComputedStyle(document.querySelector('.active-title')).fontFamily"))
    assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
    pg.screenshot(path=str(OUT / 'workout-390.png'), full_page=True)
    print('ERRORS', errs)
    assert errs == [], errs
    b.close()
print('FONT-REVIEW-OK')
