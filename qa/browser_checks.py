"""Run both browser suites against one managed preview server."""
import runpy
from concurrent.futures import ThreadPoolExecutor

def check(path):
    try:
        runpy.run_path(path, run_name='__main__')
        return None
    except Exception as error:
        return f'{path}: {error}'

with ThreadPoolExecutor(max_workers=2) as pool:
    failures = list(filter(None, pool.map(check, ['qa/training_flow.py', 'qa/new_features.py'])))
if failures:
    raise SystemExit('\n'.join(failures))
