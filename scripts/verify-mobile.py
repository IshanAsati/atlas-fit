"""Production mobile flow check. Run with the webapp-testing server helper."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:4180'
OUT = Path(__file__).resolve().parents[1] / 'qa' / 'mobile'
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='Set up Atlas Fit')).to_be_visible()

    def capture(name):
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), name + ': horizontal overflow'
        page.screenshot(path=str(OUT / (name + '.png')), full_page=False)

    capture('01-onboarding')
    page.get_by_label('Display name', exact=True).fill('UI review')
    for step in range(1, 11):
        page.locator('main .btn.primary').click()
        expect(page.locator('.topbar p')).to_contain_text('Step ' + str(step + 1) + ' of 11')
    expect(page.get_by_role('progressbar')).to_have_attribute('aria-valuenow', '100')
    page.get_by_role('button', name='Start training', exact=True).click()
    expect(page.get_by_role('heading', name='Hi, UI review')).to_be_visible()
    capture('02-home')

    # A modal traps keyboard focus and returns it to the trigger on close.
    trigger = page.get_by_role('button', name='Backup and settings')
    trigger.click()
    dialog = page.get_by_role('dialog', name='Settings & backup')
    expect(dialog).to_be_visible()
    for _ in range(12):
        page.keyboard.press('Tab')
        assert page.evaluate('document.querySelector("dialog[open]").contains(document.activeElement)')
    page.keyboard.press('Escape')
    expect(dialog).to_have_count(0)
    expect(trigger).to_be_focused()

    # Editing loads the actual profile; cancelling preserves it.
    trigger.click()
    page.get_by_role('button', name='Edit preferences', exact=True).click()
    expect(page.get_by_role('heading', name='Edit preferences')).to_be_visible()
    expect(page.get_by_label('Display name', exact=True)).to_have_value('UI review')
    page.get_by_label('Display name', exact=True).fill('Unsaved change')
    page.get_by_role('button', name='Cancel', exact=True).click()
    expect(page.get_by_role('heading', name='Hi, UI review')).to_be_visible()

    page.get_by_role('navigation', name='Main').get_by_role('button', name='Plan', exact=True).click()
    expect(page.get_by_role('heading', name='Plan generator')).to_be_visible()
    capture('03-plan')
    page.get_by_role('button', name=re.compile('^Start Full body')).first.click()
    expect(page.get_by_role('button', name='Finish', exact=True)).to_be_visible()
    capture('04-workout')
    page.get_by_label('Set 1 reps', exact=True).fill('10')
    page.get_by_role('button', name='Mark set 1 done', exact=True).click()
    expect(page.get_by_role('button', name='Mark set 1 not done', exact=True)).to_be_visible()
    page.get_by_role('button', name='Mark set 1 not done', exact=True).click()
    page.get_by_role('button', name='Mark set 1 done', exact=True).click()
    page.reload()
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('button', name='Mark set 1 not done', exact=True)).to_be_visible()
    expect(page.get_by_label('Set 1 reps', exact=True)).to_have_value('10')

    page.get_by_role('navigation', name='Main').get_by_role('button', name='Library', exact=True).click()
    expect(page.get_by_role('heading', name='Exercise library')).to_be_visible()
    capture('05-library')
    page.get_by_role('button', name='Show filters', exact=True).click()
    expect(page.get_by_label('Primary muscle', exact=True)).to_be_visible()
    page.get_by_role('button', name='Hide filters', exact=True).click()
    page.get_by_label('Search', exact=True).fill('Push-up')
    page.locator('.exrow').filter(has_text='Push-up').first.click()
    expect(page.get_by_role('heading', name='Push-up', exact=True)).to_be_visible()
    capture('05-exercise-detail')

    page.get_by_role('navigation', name='Main').get_by_role('button', name='Body', exact=True).click()
    expect(page.get_by_role('heading', name='Body & progress')).to_be_visible()
    capture('06-bodygraph')
    figure = page.locator('.body-stage .bodyfig').bounding_box()
    nav = page.get_by_role('navigation', name='Main').bounding_box()
    assert figure['y'] + figure['height'] < nav['y'], 'Bodygraph does not fit above navigation'
    page.get_by_role('button', name='Change', exact=True).click()
    picker = page.get_by_role('dialog', name='Pick an exercise')
    expect(picker).to_be_visible()
    picker.get_by_label('Search exercises', exact=True).fill('Plank')
    picker.get_by_role('button').filter(has_text='Plank').first.click()
    expect(picker).to_have_count(0)
    expect(page.locator('.body-stage [aria-label*="primary target"]').first).to_be_visible()
    page.get_by_role('button', name='Back', exact=True).click()
    expect(page.get_by_role('group', name='Cartoon muscle map, back view')).to_be_visible()
    page.get_by_role('button', name='Front', exact=True).click()
    page.locator('.body-stage [role="button"]').first.click()
    expect(page.get_by_role('dialog')).to_be_visible()
    page.get_by_role('dialog').get_by_role('button', name='Close', exact=True).click()

    for width, height in [(393, 852), (375, 812), (768, 1024)]:
        page.set_viewport_size({'width': width, 'height': height})
        capture('06-bodygraph-' + str(width))

    page.emulate_media(reduced_motion='reduce')
    assert page.locator('.flip').evaluate('(el) => parseFloat(getComputedStyle(el).transitionDuration) <= 0.001')
    assert not errors, errors
    print(json.dumps({'status': 'passed', 'screens': 6, 'viewport_widths': [390, 393, 375, 768],
                      'checks': ['onboarding', 'plan', 'modal focus', 'edit/cancel preferences',
                                 'mark/undo/reload sets', 'library filters', 'exercise detail',
                                 'bodygraph selector and views', 'horizontal overflow', 'reduced motion'],
                      'runtime_errors': errors, 'screenshots': str(OUT)}, indent=2))
    browser.close()
