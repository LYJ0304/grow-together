"""Read-only release inspection and PR verification. Never performs release mutations."""

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tomllib


APP_FILES = {
    'mobile': ('apps/mobile/package.json', 'apps/mobile/app.json',
               'apps/mobile/package-lock.json'),
    'api': ('apps/api/build.gradle',),
    'worker': ('apps/ai-worker/pyproject.toml', 'apps/ai-worker/uv.lock'),
}
APP_DIRS = {'mobile': 'apps/mobile/', 'api': 'apps/api/', 'worker': 'apps/ai-worker/'}
VERSION = re.compile(
    r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)'
    r'(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?'
    r'(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?'
)
SHA = re.compile(r'[0-9a-f]{40}')
GRADLE_VERSION = re.compile(r"(?m)^version\s*=\s*['\"]([^'\"]+)['\"]\s*$")
RECORD = re.compile(r'<!-- grow-together-release:v1\s*\n(.*?)\n-->', re.DOTALL)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def run(*command):
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode:
        # Do not echo command output: gh/provider responses may contain secrets.
        raise ValueError(f'{command[0]} {command[1]} lookup failed; check authentication, refs and access.')
    return result.stdout.strip()


def git(*args):
    return run('git', *args)


def gh(*args):
    return json.loads(run('gh', *args))


def version(value, stable=False):
    match = VERSION.fullmatch(value) if isinstance(value, str) else None
    require(match is not None, f'Invalid SemVer: {value!r}')
    prerelease = match[4]
    if prerelease:
        require(all(not (part.isdigit() and len(part) > 1 and part[0] == '0')
                    for part in prerelease.split('.')), 'SemVer numeric prerelease has a leading zero.')
    if stable:
        require(not prerelease and not match[5], 'Release targets must be stable X.Y.Z without metadata.')
    return tuple(int(match[i]) for i in (1, 2, 3))


def commit(ref):
    return git('rev-parse', '--verify', f'{ref}^{{commit}}')


def ancestor(older, newer):
    result = subprocess.run(['git', 'merge-base', '--is-ancestor', older, newer], capture_output=True)
    require(result.returncode in (0, 1), 'Cannot verify commit ancestry; fetch the required history.')
    return result.returncode == 0


def blob(ref, path):
    return git('show', f'{ref}:{path}')


def json_blob(ref, path):
    return json.loads(blob(ref, path))


def worker_package(lock, name):
    packages = [p for p in lock['package'] if p.get('name') == name
                and p.get('source') in ({'virtual': '.'}, {'editable': '.'})]
    require(len(packages) == 1, 'Worker lockfile must contain exactly one local project package.')
    return packages[0]


def versions(ref):
    package, expo, lock = [json_blob(ref, p) for p in APP_FILES['mobile']]
    mobile = package['version']
    require(mobile == expo['expo']['version'] == lock['version'] == lock['packages']['']['version'],
            f'Mobile manifest/lock versions disagree at {ref}.')
    matches = GRADLE_VERSION.findall(blob(ref, APP_FILES['api'][0]))
    require(len(matches) == 1, 'Expected one literal Gradle application version.')
    project = tomllib.loads(blob(ref, APP_FILES['worker'][0]))['project']
    worker_lock = tomllib.loads(blob(ref, APP_FILES['worker'][1]))
    require(worker_package(worker_lock, project['name'])['version'] == project['version'],
            f'Worker manifest/lock versions disagree at {ref}.')
    result = {'mobile': mobile, 'api': matches[0], 'worker': project['version']}
    for value in result.values():
        version(value)
    return result


def tag_details(tag):
    ref = f'refs/tags/{tag}'
    require(git('cat-file', '-t', ref) == 'tag', f'{tag} is lightweight; expected an annotated release tag.')
    return {'object': git('rev-parse', ref), 'commit': commit(ref),
            'annotation': git('for-each-ref', '--format=%(contents)', ref)}


def baselines(ref, excluded=()):
    result = {}
    for app in APP_FILES:
        stable, prereleases = [], []
        for tag in git('tag', '--list', f'{app}/v*').splitlines():
            if tag in excluded:
                continue
            value = tag[len(app) + 2:]
            precedence = version(value)
            match = VERSION.fullmatch(value)
            if match[4] or match[5]:
                prereleases.append(tag)
                continue
            details = tag_details(tag)
            stable.append((precedence, tag, details['commit']))
        reachable = sorted(t for t in stable if ancestor(t[2], ref))
        for older, newer in zip(reachable, reachable[1:]):
            require(older[2] != newer[2] and ancestor(older[2], newer[2]),
                    f'{app} tag ancestry conflicts with SemVer order; inspect history.')
        latest = reachable[-1] if reachable else None
        result[app] = {'tag': latest[1] if latest else None,
                       'commit': latest[2] if latest else None,
                       'prerelease_or_metadata_tags': prereleases,
                       'unreachable_stable_tags': [t[1] for t in stable if not ancestor(t[2], ref)]}
    return result


def inspect(ref):
    target = commit(ref)
    current, previous = versions(target), baselines(target)
    result = {}
    for app in APP_FILES:
        baseline = previous[app]
        files = (git('diff', '--name-only', baseline['commit'], target).splitlines()
                 if baseline['commit'] else git('ls-tree', '-r', '--name-only', target).splitlines())
        candidates = [p for p in files if p.startswith(APP_DIRS[app])
                      or (p.startswith('contracts/') and app in ('mobile', 'api'))]
        result[app] = {**baseline, 'manifest': current[app], 'bootstrap': not baseline['tag'],
                       'candidate_files': candidates, 'requires_semantic_review': bool(candidates)}
    return {'base': target, 'apps': result, 'read_only': True}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f'Duplicate Release PR record field: {key}')
        result[key] = value
    return result


def parse_record(body):
    require(body.count('<!-- grow-together-release:') == 1, 'Expected exactly one Release PR record.')
    matches = RECORD.findall(body)
    require(len(matches) == 1, 'Missing or malformed grow-together-release:v1 record.')
    record = json.loads(matches[0], object_pairs_hook=unique_object)
    require(set(record) == {'schema', 'base', 'head', 'apps', 'qa', 'compatibility',
                            'validation', 'approval'}, 'Release record has missing/unknown fields.')
    require(type(record['schema']) is int and record['schema'] == 1, 'Unsupported release record schema.')
    for key in ('base', 'head'):
        require(isinstance(record[key], str) and SHA.fullmatch(record[key]), f'Invalid {key} SHA.')
    for key in ('qa', 'compatibility', 'approval'):
        require(isinstance(record[key], str) and record[key].strip(), f'Missing {key} evidence.')
    require(isinstance(record['apps'], dict) and record['apps'] and
            set(record['apps']) <= APP_FILES.keys(), 'Select at least one known application.')
    for app, entry in record['apps'].items():
        require(set(entry) == {'previous_tag', 'current', 'version', 'reason', 'notes'},
                f'{app} record has missing/unknown fields.')
        version(entry['current'])
        version(entry['version'], stable=True)
        require(version(entry['version']) >= version(entry['current']), f'{app} manifest version regression.')
        require(entry['previous_tag'] is None or isinstance(entry['previous_tag'], str), 'Invalid previous tag.')
        for key in ('reason', 'notes'):
            require(isinstance(entry[key], str) and entry[key].strip(), f'{app} is missing {key}.')
    require(isinstance(record['validation'], list) and record['validation'], 'Required validation is missing.')
    for check in record['validation']:
        require(set(check) == {'command', 'result', 'evidence'} and check['result'] == 'passed'
                and isinstance(check['command'], str) and check['command'].strip()
                and isinstance(check['evidence'], str) and check['evidence'].strip(),
                'Every required validation must have executed/passed evidence.')
    return record


def digest(record):
    encoded = json.dumps(record, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def normalized(ref, path):
    """Ignore only existing version fields; dependency/configuration changes remain visible."""
    if path in APP_FILES['mobile']:
        data = json_blob(ref, path)
        if path.endswith('app.json'):
            data['expo']['version'] = '<version>'
        else:
            data['version'] = '<version>'
            if path.endswith('package-lock.json'):
                data['packages']['']['version'] = '<version>'
        return data
    if path in APP_FILES['api']:
        return GRADLE_VERSION.sub("version = '<version>'\n", blob(ref, path))
    data = tomllib.loads(blob(ref, path))
    if path.endswith('pyproject.toml'):
        data['project']['version'] = '<version>'
    else:
        name = tomllib.loads(blob(ref, APP_FILES['worker'][0]))['project']['name']
        worker_package(data, name)['version'] = '<version>'
    return data


def verify_tree(record):
    base, head = record['base'], record['head']
    require(ancestor(base, head), 'Release head does not descend from approved base.')
    before, after = versions(base), versions(head)
    targets = {f"{app}/v{entry['version']}" for app, entry in record['apps'].items()}
    previous = baselines(base, excluded=targets)
    allowed = {path for app in record['apps'] for path in APP_FILES[app]}
    changed = git('diff', '--name-only', base, head).splitlines()
    require(set(changed) <= allowed, 'Release PR includes files outside selected version manifests.')
    for path in changed:
        for ref in (base, head):
            require(git('ls-tree', ref, '--', path).startswith('100644 blob '),
                    f'Unexpected deletion/mode/type for {path}.')
        require(normalized(base, path) == normalized(head, path),
                f'Non-version change in {path}; prepare a new scope separately.')
    for app in APP_FILES:
        if app not in record['apps']:
            require(before[app] == after[app], f'Unexpected {app} version change.')
            continue
        entry = record['apps'][app]
        require(entry['current'] == before[app] and entry['version'] == after[app],
                f'{app} manifests do not match the approved mapping.')
        require(entry['previous_tag'] == previous[app]['tag'], f'{app} previous release tag changed.')
        if entry['previous_tag']:
            require(version(entry['version']) > version(entry['previous_tag'].split('/v')[1]),
                    f'{app} target must exceed the previous release.')
            relevant = git('diff', '--name-only', previous[app]['commit'], base).splitlines()
            require(any(p.startswith(APP_DIRS[app]) or
                        (p.startswith('contracts/') and app in ('mobile', 'api')) for p in relevant),
                    f'{app} has no candidate changes since its previous tag.')
    return after


def check_ci(pr):
    checks = pr.get('statusCheckRollup')
    require(isinstance(checks, list) and checks, 'CI is missing; configure required checks before release.')
    for check in checks:
        if 'conclusion' in check:
            passed = check.get('status') == 'COMPLETED' and check['conclusion'] == 'SUCCESS'
        else:
            passed = check.get('state') == 'SUCCESS'
        require(passed, 'CI failed, is pending/skipped, or is unknown; wait/fix before release.')


def remote_refs(remote):
    rows = git('ls-remote', '--heads', '--tags', remote).splitlines()
    return dict((line.split('\t', 1)[1], line.split('\t', 1)[0]) for line in rows)


def publication_state(record, pr_number, merge, remote, releases, recovery):
    plan_digest = digest(record)
    annotation = f'Grow Together release PR #{pr_number}\nPlan: {plan_digest}'
    tags = {}
    local_refs = set(git('tag', '--list').splitlines())
    for app, entry in record['apps'].items():
        tag = f"{app}/v{entry['version']}"
        ref = f'refs/tags/{tag}'
        local, remote_object = tag in local_refs, remote.get(ref)
        existing_releases = [r for r in releases if r.get('tag_name') == tag]
        require(not (local or remote_object or existing_releases) or recovery,
                f'{tag} already exists; inspect conflict or explicitly verify recovery.')
        if not remote_object:
            for existing in local_refs:
                if existing == tag or not existing.startswith(f'{app}/v'):
                    continue
                value = existing[len(app) + 2:]
                match = VERSION.fullmatch(value)
                if match and not match[4] and not match[5]:
                    require(version(value) < version(entry['version']),
                            f'{app} already has an equal/newer stable tag; replan before publishing new tags.')
        if local:
            details = tag_details(tag)
            require(details['commit'] == merge and details['annotation'] == annotation,
                    f'{tag} conflicts with approved commit/annotation/plan.')
        if remote_object:
            require(local, f'Fetch {tag} without force before verifying recovery.')
            require(remote_object == details['object'] and remote.get(ref + '^{}') == merge,
                    f'{tag} remote object/peeled SHA differs from approved annotated tag.')
        require(len(existing_releases) <= 1, f'Duplicate Releases for {tag}.')
        release = existing_releases[0] if existing_releases else None
        if release:
            require(remote_object and release.get('name') == tag and release.get('body') == entry['notes']
                    and release.get('draft') is False and release.get('prerelease') is False,
                    f'Existing GitHub Release for {tag} conflicts with approved notes/state.')
        tags[app] = {'tag': tag, 'local': local, 'remote': bool(remote_object),
                     'published': release is not None, 'url': release.get('html_url') if release else None}
    return {
        'annotation': annotation,
        'tags': tags,
        'create_local': [v['tag'] for v in tags.values() if not v['local']],
        'push_refspecs': [f"refs/tags/{v['tag']}:refs/tags/{v['tag']}" for v in tags.values() if not v['remote']],
        'create_releases': [v['tag'] for v in tags.values() if not v['published']],
    }


def verify(args):
    require(args.pr > 0, 'PR number must be positive.')
    require(re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', args.repo), 'Invalid repository name.')
    require(re.fullmatch(r'[A-Za-z0-9_-]+', args.remote), 'Use a named Git remote.')
    run('gh', 'auth', 'status')
    # Bind the explicitly supplied GitHub repository to the checkout remote.
    url = git('remote', 'get-url', args.remote)
    require(url.removesuffix('.git') in (f'https://github.com/{args.repo}',
                                        f'git@github.com:{args.repo}', f'ssh://git@github.com/{args.repo}'),
            'GitHub repository does not match the named Git remote.')
    pr = gh('pr', 'view', str(args.pr), '--repo', args.repo, '--json',
            'number,state,mergedAt,baseRefName,headRefName,headRefOid,mergeCommit,body,statusCheckRollup')
    require(pr.get('number') == args.pr and pr.get('baseRefName') == 'main'
            and re.fullmatch(r'release/\d{4}-\d{2}-\d{2}(?:-[a-zA-Z0-9-]+)?', pr.get('headRefName', '')),
            'Expected a dedicated release branch PR targeting main.')
    record = parse_record(pr.get('body', ''))
    require(pr.get('headRefOid') == record['head'], 'PR head changed since the recorded plan.')
    current = verify_tree(record)
    refs = remote_refs(args.remote)
    main = refs.get('refs/heads/main')
    require(main and main == commit(f'refs/remotes/{args.remote}/main'),
            'Fetched main is stale/missing; refresh without force and revalidate.')
    branch = gh('api', f'repos/{args.repo}/branches/main')
    require(branch.get('commit', {}).get('sha') == main, 'Main moved during verification; revalidate.')
    require(branch.get('protected') is True, 'Main is unprotected; configure protection separately before release.')
    check_ci(pr)
    merge = None
    if args.phase == 'prepare':
        require(pr.get('state') == 'OPEN' and not pr.get('mergedAt'), 'Preparation requires an OPEN Release PR.')
        require(main == record['base'], 'Release base is stale; replan and obtain new approval.')
        merge = record['head']  # No tag can exist during preparation, even with --recovery.
    else:
        require(pr.get('state') == 'MERGED' and pr.get('mergedAt'), 'Publish requires a merged Release PR.')
        merge = (pr.get('mergeCommit') or {}).get('oid')
        require(isinstance(merge, str) and SHA.fullmatch(merge), 'Missing merge commit SHA.')
        require(ancestor(merge, main), 'Release commit is not on fetched main history.')
        parents = git('rev-list', '--parents', '-n', '1', merge).split()[1:]
        require(parents in ([record['base']], [record['base'], record['head']]),
                'Merge parent differs from approved base/head; approval is stale.')
        require(git('rev-parse', f'{merge}^{{tree}}') == git('rev-parse', f"{record['head']}^{{tree}}"),
                'Merged tree differs from approved release head.')
    # Fresh remote stable/prerelease app tags must be fetched; never silently miss a newer baseline.
    local = {f'refs/tags/{t}': git('rev-parse', f'refs/tags/{t}')
             for t in git('tag', '--list').splitlines() if any(t.startswith(f'{a}/v') for a in APP_FILES)}
    for ref, oid in refs.items():
        if ref.endswith('^{}') or not any(ref.startswith(f'refs/tags/{a}/v') for a in APP_FILES):
            continue
        require(local.get(ref) == oid, f'Remote tag {ref} is missing/conflicting locally; fetch without force.')
    for entry in record['apps'].values():
        previous_tag = entry['previous_tag']
        if previous_tag:
            ref = f'refs/tags/{previous_tag}'
            require(refs.get(ref) == local.get(ref), 'Previous official tag is absent/conflicting remotely.')
    pages = gh('api', '--paginate', '--slurp', f'repos/{args.repo}/releases?per_page=100')
    require(isinstance(pages, list) and all(isinstance(p, list) for p in pages), 'Invalid Releases response.')
    releases = [r for page in pages for r in page]
    state = publication_state(record, args.pr, merge, refs, releases,
                              args.recovery and args.phase == 'publish')
    return {'verified': True, 'read_only': True, 'phase': args.phase, 'pr': args.pr,
            'base': record['base'], 'head': record['head'], 'merge': merge if args.phase == 'publish' else None,
            'main': main, 'plan_digest': digest(record), 'record': record, 'manifests': current,
            'requires_human_approval': True, 'deployment': 'unverified', **state}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_subparsers(dest='mode', required=True)
    inspection = modes.add_parser('inspect', help='Inspect committed manifests/tags; no network or writes.')
    inspection.add_argument('--ref', default='origin/main')
    verification = modes.add_parser('verify', help='Read-only Git/GitHub preflight; never authorizes publication.')
    verification.add_argument('--repo', required=True)
    verification.add_argument('--pr', required=True, type=int)
    verification.add_argument('--remote', default='origin')
    verification.add_argument('--phase', choices=('prepare', 'publish'), required=True)
    verification.add_argument('--recovery', action='store_true')
    args = parser.parse_args()
    try:
        result = inspect(args.ref) if args.mode == 'inspect' else verify(args)
    except (ValueError, KeyError, TypeError, IndexError, AttributeError, OSError,
            subprocess.SubprocessError) as error:
        print(json.dumps({'verified': False, 'read_only': True, 'reason': str(error)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
