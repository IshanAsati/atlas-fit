"""Production-browser checks for the expanded offline app, with isolated data.
Run via webapp-testing's with_server.py on port 5190. No Android hardware emulation.
"""
import json
from datetime import date, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(r'C:\Users\Ishan\AppData\Local\Temp\opencode\atlas-expanded-review')
OUT.mkdir(parents=True, exist_ok=True)
READ_DB = """async table => {
  const db = await new Promise((resolve,reject) => { const req=indexedDB.open('AtlasFitDatabase'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  try { return await new Promise((resolve,reject)=>{const req=db.transaction(table).objectStore(table).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}); } finally {db.close();}
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce')
    page = context.new_page()
    errors, checks = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def rows(table): return page.evaluate(READ_DB, table)
    def capture(name):
        page.wait_for_load_state('networkidle')
        for width in [320,390,1440]:
            page.set_viewport_size({'width':width,'height':844})
            page.evaluate('scrollTo(0,0)')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{name}: overflow at {width}'
            page.screenshot(path=str(OUT / f'{name}-{width}.png'), full_page=True)
        page.set_viewport_size({'width':390,'height':844})
    def main_tab(name):
        page.get_by_role('navigation', name='Main navigation').get_by_role('button', name=name, exact=True).click()

    page.goto('http://127.0.0.1:5190/', wait_until='networkidle')
    page.get_by_label('Display Name (optional)').fill('Expanded QA')
    for _ in range(3): page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Continue to Equipment').click()
    for _ in range(4): page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Skip (No Restrictions)').click()
    page.get_by_role('button', name='Generate Plan Preview').click()
    page.get_by_role('button', name='Start Training').click()
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    expect(page.get_by_text('Health Connect is available in the Android app, not this browser.')).to_be_visible()
    assert rows('activeWorkout') == []
    capture('today-roomy')

    page.get_by_role('button', name='Cardio Log walks, runs, rides, and more').click()
    expect(page.get_by_role('heading', name='Cardio', exact=True).first).to_be_visible()
    page.get_by_text('Log cardio', exact=True).click()
    page.get_by_label('Activity', exact=True).select_option('run')
    page.get_by_label('Duration (minutes)', exact=True).fill('30')
    page.get_by_label('Distance (km, optional)', exact=True).fill('4')
    page.get_by_label('Effort', exact=True).select_option('moderate')
    page.get_by_role('button', name='Save cardio session', exact=True).click()
    expect(page.get_by_text('Cardio session saved on this device.', exact=True)).to_be_visible()
    assert rows('cardio')[0]['distanceKm'] == 4
    assert rows('sessions') == [] and rows('activeWorkout') == []
    page.reload(wait_until='networkidle')
    expect(page.get_by_text('Run · 30 min', exact=True)).to_be_visible()
    page.get_by_text('Log cardio', exact=True).click()
    capture('cardio')
    checks.append('Cardio saves/reloads separately from strength history')
    page.get_by_role('button', name='Back to Today').click()

    page.get_by_role('button', name='Diet & Nutrition Indian meal plans and nutrition calculators').click()
    expect(page.get_by_role('heading', name='Make it your diet')).to_be_visible()
    page.locator('#nutrition-age').fill('30')
    page.locator('#nutrition-weight').fill('70')
    page.locator('#nutrition-height').fill('170')
    capture('diet-settings')
    for diet in ['vegetarian','eggetarian','non-vegetarian']:
        page.locator('#nutrition-diet').select_option(diet)
        page.get_by_role('button', name='Save & generate diet', exact=True).click()
        expect(page.get_by_role('heading', name='Your meal week')).to_be_visible()
        assert rows('profiles')[0]['nutrition']['diet'] == diet
        page.locator('#nutrition-day').select_option('6')
        expect(page.get_by_role('heading', name='Day 7 totals')).to_be_visible()
        if diet == 'eggetarian': capture('indian-meals')
        page.get_by_role('button', name='Diet settings', exact=True).click()
    page.get_by_text('Food exclusions', exact=True).click()
    page.get_by_role('checkbox', name='Dairy', exact=True).check()
    page.get_by_role('button', name='Save & generate diet', exact=True).click()
    old_seed = rows('profiles')[0]['nutrition']['planSeed']
    page.get_by_role('button', name='Generate another week', exact=True).click()
    expect(page.get_by_text('Another week saved. Your workout history is unchanged.', exact=True)).to_be_visible()
    assert rows('profiles')[0]['nutrition']['planSeed'] != old_seed
    assert rows('profiles')[0]['nutrition']['foodExclusions'] == ['dairy']
    page.get_by_role('button', name='Calculators', exact=True).click()
    capture('calculators')
    checks.append('All three Indian diet modes generate; exclusions and regenerated seed persist')

    # Browser offline reload must retain cardio and diet without a backend.
    page.evaluate('navigator.serviceWorker.ready')
    page.reload(wait_until='networkidle')
    page.wait_for_function('navigator.serviceWorker.controller !== null')
    context.set_offline(True)
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading', name='Your meal week')).to_be_visible()
    assert rows('profiles')[0]['nutrition']['planSeed'] != old_seed
    assert len(rows('cardio')) == 1
    checks.append('Cardio and deterministic diet survive offline reload')
    context.set_offline(False)

    main_tab('Plan')
    page.get_by_text('Training block', exact=True).first.click()
    page.get_by_label('Enable training block').check()
    page.get_by_label('Start date', exact=True).fill((date.today() - timedelta(days=21)).isoformat())
    page.get_by_label('Block length', exact=True).select_option('4')
    page.get_by_role('button', name='Save training block', exact=True).click()
    expect(page.get_by_text('Training block saved. Applies to new workouts; history and unfinished workouts are unchanged.', exact=True)).to_be_visible()
    capture('plan-block')
    main_tab('Today')
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    page.get_by_role('button', name='Start workout', exact=True).first.click()
    expect(page.locator('.active-title')).to_be_visible()
    session = rows('activeWorkout')[0]['session']
    assert session['blockContext']['phase'] == 'deload'
    assert all(not s['done'] and s['loadKg'] is None for i in session['items'] for s in i['sets'])
    capture('workout-deload')
    first_name = page.locator('.exercise-header-row h2').inner_text()
    page.get_by_label(f'{first_name} set 1 load kg', exact=True).fill('10')
    page.get_by_label(f'{first_name} set 1 reps', exact=True).fill('8')
    page.get_by_role('button', name=f'Complete {first_name} set 1', exact=True).click()
    capture('rest-timer')
    page.get_by_role('region', name='Rest timer').get_by_role('button', name='Skip', exact=True).click()
    page.get_by_role('button', name='Save & exit', exact=True).click()
    main_tab('Plan')
    page.get_by_text('Training block · Week 4 of 4 · Deload', exact=True).click()
    page.get_by_label('Enable training block').uncheck()
    page.get_by_role('button', name='Save training block', exact=True).click()
    main_tab('Today')
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    page.get_by_role('button', name='Resume workout', exact=True).first.click()
    expect(page.get_by_label(f'{first_name} set 1 reps', exact=True)).to_have_value('8')
    assert rows('activeWorkout')[0]['session']['blockContext']['phase'] == 'deload'
    page.get_by_role('button', name='Save & exit', exact=True).click()
    checks.append('Deload applies once on start; resume preserves prescriptions and performed sets')

    page.get_by_role('button', name='Open settings', exact=True).click()
    expect(page.locator('.settings-disclosure[open]')).to_have_count(0)
    page.get_by_text('Plate calculator', exact=True).click()
    page.get_by_label('Target load (kg)', exact=True).fill('60')
    expect(page.get_by_role('heading', name='Exact load', exact=True)).to_be_visible()
    expect(page.locator('.plate-calculator-result')).to_contain_text('60 kg')
    capture('settings-plate')
    page.get_by_text('Your equipment', exact=False).first.click()
    page.get_by_label('Theme', exact=True).select_option('dark')
    capture('settings-expanded-dark')
    page.get_by_role('button', name='Back to Today', exact=True).click()
    capture('today-dark')
    assert errors == [], errors
    result = {'checks':checks,'page_errors':errors,'screenshots':str(OUT),'android_hardware_verified':False}
    (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
    browser.close()
