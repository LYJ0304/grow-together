"""Read-only merge evidence check; data-preservation checks remain the agent's job."""

import argparse
import json
import subprocess


def run(worktree, *command):
    return subprocess.check_output(command, cwd=worktree, text=True, stderr=subprocess.PIPE).strip()


def verify(args):
    pr = json.loads(run(
        args.worktree, 'gh', 'pr', 'view', str(args.pr), '--repo', args.repo,
        '--json', 'state,mergedAt,headRefName,headRefOid,baseRefName,mergeCommit',
    ))
    if pr.get('state') != 'MERGED' or not pr.get('mergedAt'):
        return False, 'PR merge is not confirmed; retain the environment.'
    merge_commit = (pr.get('mergeCommit') or {}).get('oid')
    if not merge_commit or not pr.get('headRefOid'):
        return False, 'Final head or merge commit is missing; retain the environment.'
    if (pr.get('headRefName'), pr.get('baseRefName')) != (args.branch, args.base):
        return False, 'PR branch/target does not match the task; retain the environment.'
    branch = run(args.worktree, 'git', 'symbolic-ref', '--quiet', '--short', 'HEAD')
    head = run(args.worktree, 'git', 'rev-parse', 'HEAD')
    if branch != args.branch or head != pr['headRefOid']:
        return False, 'Local work differs from the final PR head; retain the environment.'
    run(args.worktree, 'git', 'fetch', '--no-tags', args.remote)
    remote_head = subprocess.run(
        ['git', 'rev-parse', '--verify', f'refs/remotes/{args.remote}/{args.branch}'],
        cwd=args.worktree, text=True, capture_output=True,
    )
    if remote_head.returncode == 0 and remote_head.stdout.strip() != head:
        return False, 'Remote task branch differs from the final PR head; retain the environment.'
    result = subprocess.run(
        ['git', 'merge-base', '--is-ancestor', merge_commit,
         f'refs/remotes/{args.remote}/{args.base}'],
        cwd=args.worktree, capture_output=True,
    )
    if result.returncode == 1:
        return False, 'Merge commit is absent from the fetched target; retain the environment.'
    if result.returncode != 0:
        raise RuntimeError('Cannot verify target history')
    return True, 'Merge evidence verified; inspect local data before cleanup.'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('repo', 'worktree', 'branch', 'base'):
        parser.add_argument(f'--{name}', required=True)
    parser.add_argument('--pr', required=True, type=int)
    parser.add_argument('--remote', default='origin')
    args = parser.parse_args()
    if args.pr <= 0:
        parser.error('--pr must be positive')
    try:
        verified, reason = verify(args)
    except (OSError, ValueError, AttributeError, subprocess.SubprocessError, RuntimeError):
        print(json.dumps({'verified': False, 'reason': 'Merge lookup failed; retain the environment.'}))
        return 2
    print(json.dumps({'verified': verified, 'reason': reason}))
    return 0 if verified else 1


if __name__ == '__main__':
    raise SystemExit(main())
