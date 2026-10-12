"""TrainingPreferences regression check: onboarding Step 9 + Settings.

Covers the new optional TrainingPreferences slice (targetMuscles, avoidEquipment,
restrictions) end to end in an isolated Chromium profile: drives UI, asserts
IndexedDB + generated-plan data, and takes screenshots. Never edits source or
uses the user's browser profile.

Run via the webapp-testing helper (port 5192, isolated from any dev server):
  python "C:/Users/Ishan/.agents/skills/webapp-testing/scripts/with_server.py" \
    --server "npm run dev -- --port 5192 --host 127.0.0.1 --strictPort" --port 5192 -- python qa/preferences_check.py
"""
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5192/'
OUT = Path(r'C:\Users\Ishan\AppData\Local\Temp\opencode\atlas-preferences')
OUT.mkdir(parents=True, exist_ok=True)

READ_DB = """async table => {
  const db = await new Promise((resolve,reject) => { const req = indexedDB.open('AtlasFitDatabase'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  try { return await new Promise((resolve,reject)=> {const req=db.transaction(table).objectStore(table).getAll(); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);}); }
  finally {db.close();}
}"""

FOCUS_MUSCLES = ['abs', 'obliques', 'quads', 'hamstrings', 'glutes', 'calves']


def rows(page, table):
    return page.evaluate(READ_DB, table)


def no_overflow(page, label):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), label


def snapshot(page, name):
    page.evaluate('window.scrollTo(0,0)')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(OUT / (name + '.png')), full_page=True)


def check_widths(page, name):
    for width in [320, 390, 1440]:
        page.set_viewport_size({'width': width, 'height': 900})
        page.wait_for_timeout(250)
        no_overflow(page, f'{name} horizontal overflow at {width}px')
        snapshot(page, f'{name}-{width}')
    page.set_viewport_size({'width': 390, 'height': 844})


def catalog_map(page):
    """Live equipment/primary mapping from the dev-served catalog module.

    Uses the app's own source so the check stays correct if another agent edits
    the catalog or equipment mapping concurrently.
    """
    return page.evaluate("""async () => {
      const cat = await import('/src/data/catalog.ts');
      const map = {};
      for (const [id, ex] of Object.entries(cat.CATALOG_BY_ID)) {
        map[id] = { equipmentIds: ex.equipmentIds ?? [], primary: ex.primary ?? [] };
      }
      return map;
    }""")


def planned_ids(plan):
    return [item['exerciseId'] for day in plan['days'] for item in day['exercises']]


def assert_plan_excludes(page, plan, label, require_mapping=True):
    ids = planned_ids(plan)
    assert 'push-up' not in ids, f'{label}: avoided push-up was planned: {ids}'
    try:
        cmap = catalog_map(page)
    except Exception as exc:
        if require_mapping:
            raise AssertionError(f'{label}: could not load live catalog mapping: {exc!r}')
        return {'mapping': 'fallback-explanation-only'}
    bad_gear = sorted({i for i in ids if set(cmap.get(i, {}).get('equipmentIds', [])) & {'barbell', 'smith-machine'}})
    assert not bad_gear, f'{label}: planned exercises needing avoided gear: {bad_gear}'
    unknown = sorted(set(ids) - set(cmap))
    assert not unknown, f'{label}: planned ids missing from live catalog: {unknown}'
    covered = sorted(set(FOCUS_MUSCLES) & {m for i in ids for m in cmap[i]['primary']})
    assert covered, f'{label}: no focus muscle covered as primary: {ids}'
    return {'mapping': 'live-catalog', 'covered': covered}


def main():
    checks = []
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
        page = ctx.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))

        def tab(name):
            page.get_by_role('navigation', name='Main navigation').get_by_role('button', name=name, exact=True).click()

        # ---------- Onboarding: reach Step 9 with gym as the training location ----------
        page.goto(BASE, wait_until='networkidle')
        expect(page.get_by_role('heading', name='Welcome to Atlas Fit')).to_be_visible()
        page.get_by_label('Display Name (optional)').fill('Pref QA')
        page.get_by_role('button', name='Continue', exact=True).click()  # -> 2 goal
        page.get_by_role('button', name='Continue', exact=True).click()  # -> 3 experience
        page.get_by_role('button', name='Continue', exact=True).click()  # -> 4 location
        gym_tile = page.locator('.tiles .tile').nth(1)
        expect(gym_tile).to_contain_text('Commercial gym')
        gym_tile.click()
        expect(gym_tile).to_have_attribute('aria-pressed', 'true')
        # Gym inventory owns a barbell, so avoiding it proves avoidance != availability.
        page.get_by_role('button', name='Continue to Equipment').click()  # -> 5 inventory
        expect(page.get_by_text('Active training location:')).to_contain_text('Gym')
        page.get_by_role('tab', name=re.compile(r'Gym Gear')).click()
        page.get_by_placeholder('Search equipment (e.g. barbell, bands)...').fill('bodyweight')
        bodyweight = page.get_by_role('button', name=re.compile(r'Bodyweight'))
        if bodyweight.get_attribute('aria-pressed') != 'true':
            bodyweight.click()
        # Push-up needs bodyweight: now it is eligible at gym, so only the
        # restriction can keep it out of the plan.
        page.get_by_placeholder('Search equipment (e.g. barbell, bands)...').fill('barbell')
        assert page.get_by_role('button', name=re.compile(r'Barbell \+ plates')).get_attribute('aria-pressed') == 'true', \
            'barbell must stay owned in gym inventory for the independence check'
        page.get_by_placeholder('Search equipment (e.g. barbell, bands)...').fill('')
        page.get_by_role('button', name='Continue', exact=True).click()  # -> 6 days
        page.get_by_role('button', name='Continue', exact=True).click()  # -> 7 duration
        page.get_by_role('button', name='Continue', exact=True).click()  # -> 8 weekdays
        page.get_by_role('button', name='Continue', exact=True).click()  # -> 9 discomfort
        expect(page.get_by_role('heading', name='Movement Comfort')).to_be_visible()
        checks.append('Onboarding reaches Step 9 with gym location and bodyweight added to gym gear')

        # ---------- Step 9: TrainingPreferences controls ----------
        for heading in ['Target muscles', 'Equipment to avoid', 'Specific exercises to avoid']:
            expect(page.get_by_role('heading', name=heading)).to_be_visible()
        # Search inputs are keyboard-accessible via associated labels.
        page.get_by_label('Search equipment to avoid').fill('barbell')
        page.get_by_role('button', name=re.compile(r'Barbell \+ plates')).click()
        page.get_by_label('Search equipment to avoid').fill('smith')
        page.get_by_role('button', name=re.compile(r'Smith machine')).click()
        page.get_by_label('Search equipment to avoid').fill('')
        page.get_by_role('button', name='Abs / core').click()
        page.get_by_role('button', name='Legs').click()
        expect(page.get_by_text('Emphasising:')).to_be_visible()
        page.get_by_label('Search exercises to avoid').fill('push-up')
        page.get_by_role('button', name=re.compile(r'^\+ Push-up$')).click()
        expect(page.get_by_role('button', name='Remove Push-up from avoided exercises')).to_be_visible()
        avoiding = page.get_by_text('Avoiding:').inner_text()
        assert 'Barbell + plates' in avoiding and 'Smith machine' in avoiding, f'avoid summary missing gear: {avoiding}'
        native_buttons = page.evaluate("""() => {
          const secs = [...document.querySelectorAll('section[aria-labelledby^="tp-"]')];
          return secs.map((s) => [...s.querySelectorAll('button')].every((b) => b.tagName === 'BUTTON' && b.textContent.trim().length > 0));
        }""")
        assert native_buttons and all(native_buttons), 'preference chips must be native labelled buttons (keyboard focusable)'
        checks.append('Step 9: Abs/core + Legs targets, Barbell + Smith avoidance, push-up restriction all selectable with labels')

        # Back then forward retains the selection (state lives in the parent step).
        page.get_by_role('button', name='Go back one step').click()
        expect(page.get_by_role('heading', name='Preferred Weekdays')).to_be_visible()
        page.get_by_role('button', name='Continue', exact=True).click()
        expect(page.get_by_role('heading', name='Movement Comfort')).to_be_visible()
        expect(page.get_by_text('Emphasising:')).to_be_visible()
        retaining = page.get_by_text('Avoiding:').inner_text()
        assert 'Barbell + plates' in retaining and 'Smith machine' in retaining, f'selection lost across Back/forward: {retaining}'
        expect(page.get_by_role('button', name='Remove Push-up from avoided exercises')).to_be_visible()
        assert page.get_by_role('button', name=re.compile(r'Smith machine')).get_attribute('aria-pressed') == 'true'
        checks.append('Step 9 selections survive Back navigation and forward return')
        check_widths(page, 'onboarding-step9')

        # ---------- Step 10 -> preview: exclusions visible before saving ----------
        page.get_by_role('button', name='Continue', exact=True).click()
        expect(page.get_by_role('heading', name='Other Activities')).to_be_visible()
        page.get_by_role('button', name=re.compile(r'Generate Plan Preview')).click()
        expect(page.get_by_text('Adaptive Plan Generated')).to_be_visible()
        if page.get_by_text('▼ Details').count():
            page.get_by_text('▼ Details').click()
        explanation_text = page.locator('.panel').first.inner_text() + '\n' + page.content()
        assert 'Equipment excluded' in explanation_text, 'preview must explain avoided gear'
        assert 'restricted exercise(s)' in explanation_text, 'preview must explain restricted exercises'
        preview_names = [n.strip().lower() for n in page.locator('.daycard').all_inner_texts()]
        assert preview_names, 'preview shows no day cards'
        assert not any(re.split(r'\n+', t) == ['push-up'] or '\nPush-up\n' in f'\n{t}\n' for t in preview_names), \
            'preview lists the avoided Push-up'
        snapshot(page, 'onboarding-preview-390')
        checks.append('Plan preview explains gear + exercise exclusions and lists no exact Push-up')

        # ---------- Finish: optional fields saved to IndexedDB ----------
        page.get_by_role('button', name=re.compile(r'Start Training')).click()
        expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
        profiles = rows(page, 'profiles')
        assert len(profiles) == 1, f'expected one profile, got {len(profiles)}'
        profile = profiles[0]
        assert set(FOCUS_MUSCLES) <= set(profile.get('targetMuscles') or []), f"targets not saved: {profile.get('targetMuscles')}"
        assert set(['barbell', 'smith-machine']) <= set(profile.get('avoidEquipment') or []), f"avoid list not saved: {profile.get('avoidEquipment')}"
        assert 'push-up' in (profile.get('restrictions') or []), f"restriction not saved: {profile.get('restrictions')}"
        assert profile.get('activeLocation') == 'gym', f"expected gym location, got {profile.get('activeLocation')}"
        assert 'barbell' in (profile.get('equipment') or {}).get('gym', []), 'avoidance must not remove owned inventory'
        checks.append('Onboarding saves targetMuscles + avoidEquipment + restrictions; owned barbell stays in gym inventory')

        plans = rows(page, 'plans')
        assert plans, 'no plan saved after onboarding'
        saved = max(plans, key=lambda d: d.get('createdAt', 0))
        evidence = assert_plan_excludes(page, saved, 'saved onboarding plan')
        expl = ' '.join(saved.get('explanation', []))
        assert 'Equipment excluded' in expl and 'restricted exercise(s)' in expl, f'saved plan explanation missing exclusions: {expl[:300]}'
        checks.append(f"Saved plan data excludes avoided gear + push-up and covers focus ({evidence['mapping']}, {evidence['covered']})")
        snapshot(page, 'today-390')

        # ---------- Settings: values retained, edits save across reload ----------
        tab('Today')
        page.get_by_role('button', name='Open settings', exact=True).click()
        expect(page.get_by_text('Emphasising:')).to_be_visible()
        expect(page.get_by_role('button', name='Remove Push-up from avoided exercises')).to_be_visible()
        assert page.get_by_role('button', name=re.compile(r'Barbell \+ plates')).get_attribute('aria-pressed') == 'true'
        assert page.get_by_role('button', name=re.compile(r'Smith machine')).get_attribute('aria-pressed') == 'true'
        checks.append('Settings shows the onboarding preference selections')
        # Edit: drop the Smith-machine avoidance, keep everything else.
        page.get_by_role('button', name=re.compile(r'Smith machine')).click()
        assert page.get_by_role('button', name=re.compile(r'Smith machine')).get_attribute('aria-pressed') == 'false'
        page.get_by_role('button', name='Save preferences').click()
        expect(page.get_by_text(re.compile(r'Preferences saved'))).to_be_visible()
        page.reload(wait_until='networkidle')
        after = rows(page, 'profiles')[0]
        assert after.get('avoidEquipment') == ['barbell'], f"settings edit not retained: {after.get('avoidEquipment')}"
        assert 'push-up' in (after.get('restrictions') or []), 'restriction lost by settings save'
        assert set(FOCUS_MUSCLES) <= set(after.get('targetMuscles') or []), 'targets lost by settings save'
        tab('Today')
        page.get_by_role('button', name='Open settings', exact=True).click()
        expect(page.get_by_role('button', name='Remove Push-up from avoided exercises')).to_be_visible()
        checks.append('Settings edit (drop Smith avoidance) saves and retains across reload')
        # Appearance still works.
        page.get_by_label('Theme').select_option('dark')
        assert page.evaluate('document.documentElement.dataset.theme') == 'dark', 'dark theme not applied'
        page.get_by_label('Theme').select_option('light')
        assert page.evaluate('document.documentElement.dataset.theme') == 'light', 'light theme not applied'
        page.get_by_label('Theme').select_option('system')
        assert page.evaluate('document.documentElement.dataset.theme') in ('light', 'dark'), 'system theme unresolved'
        checks.append('Appearance system/dark/light switching still applies')
        check_widths(page, 'settings')

        # ---------- Plan regenerate honours the edited preferences ----------
        tab('Plan')
        expect(page.get_by_role('heading', name='Your week', exact=True)).to_be_visible()
        page.get_by_text('Adjust plan', exact=True).click()
        before_ids = {d.get('id') for d in rows(page, 'plans')}
        duration = page.get_by_label('Workout duration')
        current = duration.input_value()
        duration.select_option('30' if current != '30' else '60')
        expect(page.get_by_role('heading', name='Change preview')).to_be_visible()
        preview_text = page.locator('.plan-preview').inner_text()
        assert not re.search(r'(?m)^Push-up$', preview_text, re.IGNORECASE), f'regenerated preview lists Push-up:\n{preview_text[:500]}'
        page.get_by_role('button', name='Update weekly plan').click()
        expect(page.get_by_text(re.compile(r'plan|saved|updated', re.IGNORECASE)).first).to_be_visible()
        page.wait_for_function(
            """(before) => new Promise((resolve) => {
              const req = indexedDB.open('AtlasFitDatabase');
              req.onsuccess = () => { const db = req.result;
                const tx = db.transaction('plans').objectStore('plans').getAll();
                tx.onsuccess = () => { const ids = tx.result.map((d) => d.id); db.close(); resolve(ids.some((id) => !before.includes(id))); };
                tx.onerror = () => resolve(false); };
              req.onerror = () => resolve(false);
            })""", arg=list(before_ids))
        grown = [d for d in rows(page, 'plans') if d.get('id') not in before_ids]
        assert grown, 'regenerate wrote no new plan'
        regen = max(grown, key=lambda d: d.get('createdAt', 0))
        evidence2 = assert_plan_excludes(page, regen, 'regenerated plan')
        checks.append(f"Regenerated weekly plan excludes barbell gear + push-up ({evidence2['mapping']})")
        check_widths(page, 'plan')

        assert not errors, 'Browser runtime errors: ' + repr(errors)
        result = {'checks': checks, 'page_errors': errors, 'screenshots': str(OUT)}
        (OUT / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2))
        browser.close()


if __name__ == '__main__':
    main()
