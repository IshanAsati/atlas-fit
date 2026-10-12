"""Smoke-check web assets inside the APK without a server or internet.

Run: python qa/android_bundle.py [artifacts/atlas-fit-debug.apk]
Chromium simulates Capacitor's Android platform flag, NOT an Android device.
Native bridge/share/keyboard/Back/system-bar behaviour needs a device check.
"""
import json
import mimetypes
import sys
import zipfile
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright, expect

apk = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/atlas-fit-debug.apk')
out = Path(r'C:\Users\Ishan\AppData\Local\Temp\opencode\atlas-android')
out.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(apk) as bundle, sync_playwright() as p:
    config = json.loads(bundle.read('assets/capacitor.config.json'))
    assert config['appId'] == 'com.ishanasati.atlasfit'
    assert not config.get('server', {}).get('url'), 'APK depends on a remote website'
    names = set(bundle.namelist())
    assert any(n.startswith('assets/public/repdb-images/') for n in names)
    assert any(n.startswith('assets/public/fonts/') for n in names)
    plugins = json.loads(bundle.read('assets/capacitor.plugins.json'))
    assert any('FilesystemPlugin' in entry['classpath'] for entry in plugins)
    assert any('SharePlugin' in entry['classpath'] for entry in plugins)

    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':390, 'height':844}, offline=True)
    context.add_init_script('window.androidBridge = {};')
    errors, blocked = [], []

    def bundled_asset(route):
        parsed = urlparse(route.request.url)
        if parsed.netloc != 'localhost':
            blocked.append(route.request.url)
            route.abort()
            return
        path = unquote(parsed.path).lstrip('/') or 'index.html'
        key = 'assets/public/' + path
        if key not in names:
            route.fulfill(status=404, body='Not bundled')
            return
        mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        if path.endswith('.js'): mime = 'text/javascript'
        route.fulfill(status=200, body=bundle.read(key), content_type=mime)

    context.route('**/*', bundled_asset)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('https://localhost/', wait_until='networkidle')
    expect(page.get_by_role('heading', name='Welcome to Atlas Fit')).to_be_visible()
    page.get_by_label('Display Name (optional)').fill('Android Lifter')
    for _ in range(3): page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Continue to Equipment').click()
    for _ in range(4): page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Skip (No Restrictions)').click()
    page.get_by_role('button', name='Generate Plan Preview').click()
    page.get_by_role('button', name='Start Training').click()
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    assert page.evaluate('window.Capacitor.isNativePlatform()'), 'Native branch was not exercised'
    assert page.evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.length)') == 0
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    page.get_by_role('button', name='Start workout', exact=True).click()
    expect(page.locator('.active-title')).to_be_visible()
    name = page.locator('.exercise-header-row h2').inner_text()
    page.get_by_label(f'{name} set 1 load kg', exact=True).fill('5')
    page.get_by_label(f'{name} set 1 reps', exact=True).fill('5')
    page.get_by_role('button', name=f'Complete {name} set 1', exact=True).click()
    page.get_by_role('region', name='Rest timer').get_by_role('button', name='Skip', exact=True).click()
    page.get_by_text('Illustrations & form guidance', exact=True).click()
    images = page.locator('.workout-figure img')
    assert images.count() > 0, 'Bundled exercise illustration missing'
    for image in images.all():
        expect(image).to_have_js_property('complete', True)
        expect(image).not_to_have_js_property('naturalWidth', 0)
    page.get_by_role('button', name='Save & exit', exact=True).click()
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    page.reload(wait_until='networkidle')
    page.get_by_role('button', name='Resume workout', exact=True).first.click()
    expect(page.get_by_label(f'{name} set 1 reps', exact=True)).to_have_value('5')
    expect(page.get_by_label(f'{name} set 1 load kg', exact=True)).to_have_value('5')
    page.get_by_role('button', name='Save & exit', exact=True).click()
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    page.get_by_role('button', name='Open settings').click()
    expect(page.get_by_label('Display name', exact=True)).to_have_value('Android Lifter')
    for width in [320, 390, 1440]:
        page.set_viewport_size({'width':width, 'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert errors == [], errors
    assert blocked == [], blocked
    result = {'apk':str(apk), 'bundled_asset_onboarding_reload':True, 'workout_pause_resume':True,
              'bundled_exercise_image_decoded':True, 'native_flag_simulated':True,
              'service_workers':0, 'external_requests':blocked, 'page_errors':errors,
              'actual_android_device_verified':False}
    (out / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
    browser.close()
