"""Production-build smoke test. Uses an isolated Chromium profile; no user records.
Run with the webapp-testing with_server.py helper on port 5190.
"""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5190/'
OUT = Path(r'C:\Users\Ishan\AppData\Local\Temp\opencode\atlas-training-review')
OUT.mkdir(exist_ok=True)
READ_DB = """async table => {
  const db = await new Promise((resolve,reject) => { const req = indexedDB.open('AtlasFitDatabase'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  try { return await new Promise((resolve,reject)=> {const req=db.transaction(table).objectStore(table).getAll(); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);}); }
  finally {db.close();}
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    checks = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def rows(table):
        return page.evaluate(READ_DB, table)

    def snapshot(name):
        page.evaluate('window.scrollTo(0,0)')
        page.wait_for_load_state('networkidle')
        page.screenshot(path=str(OUT / (name + '.png')), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), name + ' horizontal overflow'

    def both(name):
        snapshot('mobile-' + name)
        page.set_viewport_size({'width':1440,'height':1000})
        snapshot('desktop-' + name)
        for width in [320, 375, 768]:
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), name + f' overflow at {width}'
        page.set_viewport_size({'width':390,'height':844})

    def tab(name):
        page.get_by_role('navigation', name='Main navigation').get_by_role('button', name=name, exact=True).click()

    page.goto(BASE, wait_until='networkidle')
    expect(page.get_by_role('heading', name='Welcome to Atlas Fit')).to_be_visible()
    both('onboarding')
    page.get_by_label('Display Name (optional)').fill('Test Lifter')
    page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Continue to Equipment').click()
    page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Skip (No Restrictions)').click()
    page.get_by_role('button', name='Generate Plan Preview').click()
    page.get_by_role('button', name='Start Training').click()
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    assert rows('activeWorkout') == [], 'Onboarding silently started a workout'
    assert rows('sessions') == [], 'Onboarding silently wrote a session'
    checks.append('Onboarding creates preferences and plan, never an active session')
    both('today')
    page.get_by_role('button', name='Save offline images').click()
    # A reviewed exercise can legitimately have written instructions but no
    # licensed image. Require an honest pack result; the decoded start/end
    # images for the logged exercise are still asserted strictly below.
    expect(page.get_by_text(re.compile(r'\d+ images saved(?: for offline use|; \d+ unavailable)'))).to_be_visible()
    page.evaluate('navigator.serviceWorker.ready')
    page.reload(wait_until='networkidle')
    page.wait_for_function('navigator.serviceWorker.controller !== null')
    page.get_by_role('button', name='Start workout', exact=True).click()
    expect(page.locator('.active-title')).to_be_visible()
    assert page.get_by_role('navigation', name='Main navigation').count() == 0
    name = page.locator('.exercise-header-row h2').inner_text()
    session = rows('activeWorkout')[0]['session']
    session_id = session['id']
    exercise_id = session['items'][0]['exerciseId']
    page.get_by_label(f'{name} set 1 load kg', exact=True).fill('5')
    page.get_by_label(f'{name} set 1 reps', exact=True).fill('5')
    page.get_by_label(f'Options for {name} set 1', exact=True).click()
    page.get_by_label(f'{name} set 1 type', exact=True).select_option('warmup')
    page.get_by_role('button', name=f'Complete {name} set 1', exact=True).click()
    page.get_by_role('region', name='Rest timer').get_by_role('button', name='Skip', exact=True).click()
    page.get_by_label(f'{name} set 2 load kg', exact=True).fill('20')
    page.get_by_label(f'{name} set 2 reps', exact=True).fill('8')
    page.get_by_role('button', name=f'Complete {name} set 2', exact=True).click()
    page.get_by_role('region', name='Rest timer').get_by_role('button', name='Skip', exact=True).click()
    page.get_by_label(f'Options for {name} set 2', exact=True).click()
    page.get_by_role('group', name=f'{name} set 2 effort', exact=True).get_by_role('button', name='Right', exact=True).click()
    page.get_by_label(f'Options for {name} set 2', exact=True).click()
    page.get_by_label('Load unit', exact=True).select_option('lb')
    expect(page.get_by_label(f'{name} set 2 load lb', exact=True)).to_have_value('44.09')
    expect(page.get_by_text('Saved on device', exact=True)).to_be_visible()
    page.get_by_role('button', name='Exercise details', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(1)
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).to_have_count(0)
    expect(page.get_by_label(f'{name} set 2 reps', exact=True)).to_have_value('8')
    page.evaluate('window.scrollTo(0,0)')
    pending = page.get_by_label(f'{name} set 3 reps', exact=True).bounding_box()
    toolbar = page.locator('.action-toolbar').bounding_box()
    assert pending and toolbar and pending['y'] + pending['height'] < toolbar['y'], 'Incomplete set is below toolbar on first viewport'
    both('workout')
    page.get_by_role('button', name='Save & exit', exact=True).click()
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    assert rows('activeWorkout')[0]['session']['pausedAt'] > 0
    page.reload(wait_until='networkidle')
    page.get_by_role('button', name='Resume workout', exact=True).first.click()
    expect(page.get_by_label(f'{name} set 2 load lb', exact=True)).to_have_value('44.09')
    assert rows('activeWorkout')[0]['session']['id'] == session_id
    assert rows('activeWorkout')[0]['session']['items'][0]['sets'][1]['loadKg'] == 20
    checks.append('Set values, kg/lb conversion, warm-up kind, effort, and pause survive reload')

    context.set_offline(True)
    page.reload(wait_until='networkidle')
    expect(page.get_by_label(f'{name} set 2 reps', exact=True)).to_have_value('8')
    page.get_by_text('Illustrations & form guidance', exact=True).click()
    images = page.locator('.workout-figure img')
    # Check whichever demonstration images the current exercise supplies.
    assert images.count() > 0, 'Offline exercise illustration is missing'
    for image in images.all():
        expect(image).to_be_visible()
        expect(image).to_have_js_property('complete', True)
        expect(image).not_to_have_js_property('naturalWidth', 0)
        assert image.evaluate('(img)=>img.complete && img.naturalWidth>0'), 'Offline image failed to decode'
    page.get_by_role('button', name='End position', exact=True).click()
    end_image = page.get_by_alt_text(f'{name}, end position', exact=True)
    expect(end_image).to_be_visible()
    # Changing src can leave a visible image waiting for cached bytes to
    # decode. Retry the same strict assertion instead of racing that decode.
    expect(end_image).to_have_js_property('complete', True)
    expect(end_image).not_to_have_js_property('naturalWidth', 0)
    assert end_image.evaluate('(img)=>img.complete && img.naturalWidth>0')
    page.evaluate('document.fonts.ready')
    assert page.evaluate('document.fonts.check("700 20px \'Source Sans 3\'")'), 'Offline heading font unavailable'
    page.get_by_text('Illustrations & form guidance', exact=True).click()
    page.get_by_role('button', name='Finish workout', exact=True).click()
    expect(page.get_by_role('dialog', name='Finish workout')).to_be_visible()
    page.get_by_role('button', name='Save workout', exact=True).click()
    expect(page.get_by_role('heading', name='Workout saved')).to_be_visible()
    assert rows('activeWorkout') == []
    done = [row for row in rows('sessions') if row['id'] == session_id][0]
    assert done['state'] == 'done'
    assert done['items'][0]['sets'][0]['kind'] == 'warmup'
    assert done['items'][0]['sets'][1]['loadKg'] == 20
    page.get_by_label('Routine name', exact=True).fill('Training smoke routine')
    page.get_by_role('button', name='Save as routine', exact=True).click()
    expect(page.get_by_role('button', name='Routine saved', exact=True)).to_be_visible()
    page.get_by_role('button', name='Back to Today', exact=True).click()
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    checks.append('Production app reloads and finishes offline; finished session cannot be resurrected')
    context.set_offline(False)

    tab('Progress')
    expect(page.locator('.progress-session-toggle')).to_have_count(1)
    page.locator('.progress-session-toggle').click()
    expect(page.get_by_text('excluded from working sets', exact=False)).to_be_visible()
    expect(page.locator('.progress-session-toggle')).to_contain_text('1 working set')
    both('history')
    page.get_by_role('button', name='Strength', exact=True).click()
    expect(page.get_by_text('44.09 lb', exact=False).first).to_be_visible()
    both('strength')
    page.get_by_role('button', name='Muscles', exact=True).click()
    expect(page.locator('.bodygraph-card')).to_be_visible()
    both('muscles-front')
    page.get_by_role('button', name='Back View', exact=True).click()
    snapshot('mobile-muscles-back')
    page.get_by_role('button', name='Front View', exact=True).click()
    page.locator('#chest path').first.click()
    expect(page.get_by_role('dialog', name='Chest (pectorals)')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).to_have_count(0)
    checks.append('History, strength in preferred units, and interactive front/back muscle map')

    tab('Plan')
    expect(page.get_by_role('heading', name='Your week', exact=True)).to_be_visible()
    both('plan')
    before = {'profile':rows('profiles'), 'plan':rows('plans')}
    page.get_by_text('Adjust plan', exact=True).click()
    page.get_by_role('button', name='Travel', exact=True).click()
    expect(page.get_by_role('heading', name='Change preview', exact=True)).to_be_visible()
    assert before == {'profile':rows('profiles'), 'plan':rows('plans')}, 'Preview wrote changes'
    page.get_by_role('button', name='Discard changes', exact=True).click()
    page.get_by_role('button', name='Saved routines (1)', exact=True).click()
    page.get_by_role('button', name='Edit Training smoke routine', exact=True).click()
    page.get_by_label('Routine name', exact=True).fill('Edited training routine')
    page.get_by_role('button', name='Save routine', exact=True).click()
    expect(page.get_by_text('Routine saved on this device.', exact=True)).to_be_visible()
    both('routines')
    page.get_by_role('button', name='Close editor', exact=True).click()
    page.get_by_role('button', name='Create custom workout', exact=True).click()
    expect(page.get_by_role('heading', name='Create custom workout', exact=True)).to_be_visible()
    expect(page.get_by_text('No saved routines yet', exact=True)).to_have_count(0)
    page.get_by_label('Routine name', exact=True).fill('My home workout with a longer name')
    expect(page.get_by_role('button', name='Save routine', exact=True)).to_be_disabled()
    both('custom-workout')
    page.once('dialog', lambda dialog: dialog.accept())
    page.get_by_role('button', name='Close editor', exact=True).click()
    page.get_by_role('button', name='Start Edited training routine', exact=True).click()
    expect(page.locator('.active-title')).to_have_text('Edited training routine')
    repeat = rows('activeWorkout')[0]['session']
    assert all(not s['done'] and s['reps'] is None and s['loadKg'] is None for i in repeat['items'] for s in i['sets'])
    page.get_by_role('button', name='Save & exit', exact=True).click()
    tab('Plan')
    page.get_by_role('button', name='Saved routines (1)', exact=True).click()
    page.get_by_role('button', name='Resume workout instead of Edited training routine', exact=True).click()
    expect(page.locator('.active-title')).to_have_text('Edited training routine')
    assert rows('activeWorkout')[0]['session']['id'] == repeat['id']
    page.get_by_role('button', name='Save & exit', exact=True).click()
    checks.append('Plan previews are read-only; routines edit, start empty, and protect unfinished sessions')

    tab('Library')
    page.get_by_role('button', name='Filters', exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(1)
    page.keyboard.press('Escape')
    both('library')
    page.locator('.ex-card-main').first.click()
    expect(page.get_by_role('dialog')).to_have_count(1)
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).to_have_count(0)
    entry = {'exerciseId':'qaExternal','name':'sample bench press','gifUrl':None,'bodyParts':['chest'],'equipments':['barbell'],'targetMuscles':['pectorals'],'secondaryMuscles':['triceps'],'instructions':['Step:1 Lie on a bench.']}
    page.route('https://oss.exercisedb.dev/api/v1/exercises?*', lambda route: route.fulfill(json={'success':True,'meta':{'total':1,'hasNextPage':False},'data':[entry]}))
    page.get_by_role('button', name='ExerciseDB', exact=True).click()
    page.get_by_label('ExerciseDB search', exact=True).fill('bench press')
    page.get_by_role('button', name='Search', exact=True).click()
    page.get_by_role('button', name='sample bench press', exact=False).click()
    page.get_by_role('button', name='Save for offline browsing', exact=True).click()
    expect(page.get_by_text('Exercise details saved for offline browsing.', exact=True)).to_be_visible()
    page.keyboard.press('Escape')
    both('exercisedb')
    context.set_offline(True)
    page.reload(wait_until='networkidle')
    page.get_by_role('button', name='ExerciseDB', exact=True).click()
    page.get_by_role('button', name='sample bench press', exact=False).click()
    expect(page.get_by_text('Lie on a bench.', exact=True)).to_be_visible()
    page.keyboard.press('Escape')
    context.set_offline(False)
    checks.append('One detail dialog; ExerciseDB contract fixture saves written details for offline browsing')

    tab('Today')
    page.get_by_role('button', name='Open settings', exact=True).click()
    both('settings')
    with page.expect_download() as downloaded:
        page.get_by_role('button', name='Export backup', exact=True).click()
    backup_path = OUT / 'backup.json'
    downloaded.value.save_as(str(backup_path))
    doc = json.loads(backup_path.read_text(encoding='utf-8'))
    assert doc['activeWorkout']['id'] == repeat['id'] and len(doc['routines']) == 1
    assert len([s for s in doc['sessions'] if s['state']=='done']) == 1
    invalid = OUT / 'invalid-backup.json'
    invalid.write_text(json.dumps({'schema':1,'exportedAt':100,'profile':None,'plans':[],'sessions':[{'id':'bad'}],'feedback':[]}),encoding='utf-8')
    page.get_by_label('Choose backup file').set_input_files(str(invalid))
    page.get_by_role('button', name='Replace and restore', exact=True).click()
    expect(page.get_by_role('dialog').get_by_role('alert')).to_be_visible()
    assert rows('activeWorkout')[0]['session']['id'] == repeat['id']
    page.get_by_role('button', name='Cancel', exact=True).click()
    page.get_by_label('Choose backup file').set_input_files(str(backup_path))
    page.get_by_role('button', name='Replace and restore', exact=True).click()
    expect(page.get_by_text('Backup restored, including saved routines.', exact=True)).to_be_visible()
    assert rows('activeWorkout')[0]['session']['id'] == repeat['id']
    assert len(rows('routines')) == 1
    checks.append('Export includes routines and active session; malformed restore leaves records untouched')

    for width in [320,375,390,768,1440]:
        page.set_viewport_size({'width':width,'height':900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Settings overflow at {width}'
    assert not errors, 'Browser runtime errors: ' + repr(errors)
    result = {'checks':checks,'page_errors':errors,'screenshots':str(OUT),'exercise':name,'mocked_ExerciseDB':True,'actual_iPhone_verified':False}
    (OUT / 'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
    browser.close()
