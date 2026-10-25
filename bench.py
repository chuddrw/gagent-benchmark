#!/usr/bin/env python3
"""Small, standard-library benchmark event logger/evaluator; run on coordinator's machine."""
import argparse, csv, json, pathlib, subprocess, time
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc).isoformat()


def root(args):
    return pathlib.Path(args.out) / args.trial


def load(args):
    p = root(args) / 'trial.json'
    if not p.exists():
        raise SystemExit(f'Unknown trial: {p}')
    return json.loads(p.read_text())


def save(args, data):
    (root(args) / 'trial.json').write_text(json.dumps(data, indent=2) + '\n')


def log(args, kind, **values):
    with (root(args) / 'events.jsonl').open('a') as f:
        f.write(json.dumps({'at': now(), 'kind': kind, **values}) + '\n')


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest='cmd', required=True)
for action in ('start', 'event', 'evaluate', 'finish', 'report'):
    p = sub.add_parser(action)
    p.add_argument('--out', default='results')
    if action != 'report': p.add_argument('--trial', required=True)
    if action == 'start':
        p.add_argument('--mode', choices=('solo', 'github', 'gagent'), required=True)
        p.add_argument('--notes', default='')
    if action == 'event':
        p.add_argument('--type', choices=('human_intervention', 'conflict', 'repair_attempt', 'approval', 'note'), required=True)
        p.add_argument('--duration-sec', type=float, default=0)
        p.add_argument('--note', default='')
    if action == 'evaluate':
        p.add_argument('--command', required=True)
        p.add_argument('--cwd', default='.')
    if action == 'finish':
        q = p.add_mutually_exclusive_group(required=True)
        q.add_argument('--success', action='store_true')
        q.add_argument('--timeout', action='store_true')
        q.add_argument('--failed', action='store_true')
args = ap.parse_args()

if args.cmd == 'start':
    d = root(args)
    d.mkdir(parents=True, exist_ok=False)
    save(args, {'trial': args.trial, 'mode': args.mode, 'notes': args.notes, 'start_epoch': time.time(), 'started_at': now(), 'status': 'running'})
    log(args, 'start', mode=args.mode)
    print(d)
elif args.cmd == 'event':
    load(args)
    if args.duration_sec < 0: raise SystemExit('Negative duration')
    log(args, args.type, duration_sec=args.duration_sec, note=args.note)
    print('Recorded')
elif args.cmd == 'evaluate':
    load(args)
    start = time.monotonic()
    cp = subprocess.run(args.command, shell=True, cwd=args.cwd, capture_output=True, text=True)
    elapsed = time.monotonic() - start
    f = root(args) / f'eval-{int(time.time() * 1000)}.log'
    f.write_text(cp.stdout + '\n--- STDERR ---\n' + cp.stderr)
    log(args, 'evaluation', command=args.command, exit_code=cp.returncode, duration_sec=round(elapsed, 3), log_file=str(f))
    print(f'exit_code={cp.returncode} duration_sec={elapsed:.1f} log={f}')
    raise SystemExit(cp.returncode)
elif args.cmd == 'finish':
    data = load(args)
    if data['status'] != 'running': raise SystemExit('Trial already finished')
    data['status'] = 'success' if args.success else ('timeout' if args.timeout else 'failed')
    data['finished_at'] = now()
    data['elapsed_sec'] = round(time.time() - data['start_epoch'], 1)
    save(args, data)
    log(args, 'finish', status=data['status'])
    print(f"{args.trial}: {data['status']}, {data['elapsed_sec']} sec")
else:
    p = pathlib.Path(args.out)
    rows = []
    for file in sorted(p.glob('*/trial.json')):
        data = json.loads(file.read_text())
        events_path = file.parent / 'events.jsonl'
        events = [json.loads(line) for line in events_path.read_text().splitlines()] if events_path.exists() else []
        interventions = [e for e in events if e['kind'] == 'human_intervention']
        evals = [e for e in events if e['kind'] == 'evaluation']
        rows.append({'trial': data['trial'], 'mode': data['mode'], 'status': data['status'], 'elapsed_min': round(data.get('elapsed_sec', 0) / 60, 2), 'human_events': len(interventions), 'human_min': round(sum(e.get('duration_sec', 0) for e in interventions) / 60, 2), 'conflicts': sum(e['kind']=='conflict' for e in events), 'repair_attempts': sum(e['kind']=='repair_attempt' for e in events), 'last_eval_pass': bool(evals and evals[-1]['exit_code'] == 0)})
    if not rows: raise SystemExit('No trials found')
    with (p / 'report.csv').open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
    print('\t'.join(rows[0]))
    for row in rows: print('\t'.join(str(v) for v in row.values()))
    print(f'CSV: {p / "report.csv"}')
