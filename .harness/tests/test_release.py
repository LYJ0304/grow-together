"""Offline release dry runs: temporary Git remotes and strictly read-only GitHub stubs."""

import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / '.harness/skills/release/scripts/release-plan.py'
SPEC = importlib.util.spec_from_file_location('release_plan', SCRIPT)
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
REAL_GIT = shutil.which('git')


class VersionPolicy(unittest.TestCase):
    def test_duplicate_record_fields_are_rejected(self):
        body = '<!-- grow-together-release:v1\n{"schema":1,"schema":2}\n-->'
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            release.parse_record(body)

    def test_semver_and_stable_release_targets(self):
        for value in ('0.0.0', '1.20.3', '0.0.1-SNAPSHOT', '1.0.0-alpha.1+build.2'):
            with self.subTest(value=value):
                release.version(value)
        for value in ('01.0.0', '1.0', '1.0.0-01', 'v1.0.0', '1.0.0\n', '1.0.0-a..b'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                release.version(value)
        for value in ('1.0.0-rc.1', '1.0.0+build'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                release.version(value, stable=True)


class ReleaseDryRun(unittest.TestCase):
    def git(self, *args, cwd=None):
        return subprocess.check_output([REAL_GIT, *map(str, args)], cwd=cwd or self.repo,
                                       text=True, stderr=subprocess.PIPE).strip()

    def write(self, path, content):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    def set_versions(self, mobile='1.0.0', api='0.1.0', worker='0.1.0'):
        self.write('apps/mobile/package.json', json.dumps({'name': 'mobile', 'version': mobile}))
        self.write('apps/mobile/app.json', json.dumps({'expo': {'version': mobile}}))
        self.write('apps/mobile/package-lock.json', json.dumps(
            {'version': mobile, 'packages': {'': {'version': mobile}}, 'lockfileVersion': 3}))
        self.write('apps/api/build.gradle', f"plugins {{ id 'java' }}\nversion = '{api}'\n")
        self.write('apps/ai-worker/pyproject.toml', f'[project]\nname = "worker"\nversion = "{worker}"\n')
        self.write('apps/ai-worker/uv.lock',
                   f'version = 1\n[[package]]\nname = "worker"\nversion = "{worker}"\nsource = {{virtual = "."}}\n')

    def save_commit(self, message):
        self.git('add', '.')
        self.git('commit', '--allow-empty', '-m', message)
        return self.git('rev-parse', 'HEAD')

    def sync_main(self):
        self.git('push', self.remote, 'main')
        self.git('update-ref', 'refs/remotes/origin/main', self.git('rev-parse', 'main'))
        self.branch['commit']['sha'] = self.git('rev-parse', 'main')

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='growtogether-release-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        self.remote = self.root / 'origin.git'
        self.git('init', '--bare', self.remote)
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Release Test')
        self.git('config', 'user.email', 'release@example.invalid')
        self.git('remote', 'add', 'origin', 'https://github.com/test/releases.git')
        self.set_versions()
        self.initial = self.save_commit('initial applications')
        for app, value in [('mobile', '1.0.0'), ('api', '0.1.0'), ('worker', '0.1.0')]:
            self.git('tag', '-a', f'{app}/v{value}', '-m', 'Previous approved release')
        self.git('push', self.remote, '--tags')
        self.write('apps/api/service.java', '// backward compatible fix\n')
        self.write('apps/mobile/screen.tsx', '// compatible feature\n')
        self.base = self.save_commit('changes already QA promoted')
        self.branch = {'protected': True, 'commit': {'sha': self.base}}
        self.sync_main()
        self.git('checkout', '-b', 'release/2026-10-25')
        self.set_versions(api='0.1.1')
        self.head = self.save_commit('chore(release): prepare api 0.1.1')
        self.record = {
            'schema': 1, 'base': self.base, 'head': self.head,
            'apps': {'api': {'previous_tag': 'api/v0.1.0', 'current': '0.1.0', 'version': '0.1.1',
                             'reason': 'Backward-compatible fix', 'notes': 'API fix notes'}},
            'qa': 'QA promoted staging SHA; PR and verification evidence',
            'compatibility': 'Backward compatible; no migration',
            'validation': [{'command': './gradlew test', 'result': 'passed', 'evidence': 'fixture log'}],
            'approval': 'Maintainer approved this exact plan in fixture conversation',
        }
        self.pr = {
            'number': 123, 'state': 'OPEN', 'mergedAt': None, 'baseRefName': 'main',
            'headRefName': 'release/2026-10-25', 'headRefOid': self.head,
            'mergeCommit': None, 'statusCheckRollup': [
                {'status': 'COMPLETED', 'conclusion': 'SUCCESS', 'name': 'api-tests'}],
        }
        self.releases = []
        self.merge = None
        self.log = self.root / 'commands.jsonl'
        self.fixture = self.root / 'github.json'
        bindir = self.root / 'bin'
        bindir.mkdir()
        gh_stub = '''import json,os,sys
from pathlib import Path
args=sys.argv[1:]
with open(os.environ['RELEASE_TEST_LOG'],'a') as f: f.write(json.dumps(['gh',*args])+'\\n')
if os.environ.get('RELEASE_TEST_NO_AUTH'): sys.exit(1)
if os.environ.get('RELEASE_TEST_FAIL_API') and args[0] == 'api': sys.exit(1)
data=json.loads(Path(os.environ['RELEASE_TEST_FIXTURE']).read_text())
if args == ['auth','status']: sys.exit(0)
if args[:3] == ['pr','view','123'] and '--json' in args: print(json.dumps(data['pr']))
elif args == ['api','repos/test/releases/branches/main']: print(json.dumps(data['branch']))
elif args == ['api','--paginate','--slurp','repos/test/releases/releases?per_page=100']:
    print(json.dumps([data['releases'][:1],data['releases'][1:]]))
else: sys.exit('Forbidden or unsupported GitHub command: '+repr(args))
'''
        git_stub = '''import json,os,subprocess,sys
args=sys.argv[1:]
with open(os.environ['RELEASE_TEST_LOG'],'a') as f: f.write(json.dumps(['git',*args])+'\\n')
allowed={'rev-parse','show','cat-file','for-each-ref','diff','ls-tree','merge-base','rev-list'}
if args[:2] == ['ls-remote','--heads']:
    args[-1]=os.environ['RELEASE_TEST_REMOTE']
elif args[:2] == ['remote','get-url']: pass
elif args[:2] == ['tag','--list']: pass
elif not args or args[0] not in allowed: sys.exit('Forbidden Git mutation: '+repr(args))
sys.exit(subprocess.run([os.environ['RELEASE_TEST_REAL_GIT'],*args]).returncode)
'''
        for name, source in [('gh', gh_stub), ('git', git_stub)]:
            path = bindir / name
            path.write_text(f'#!{sys.executable}\n' + source)
            path.chmod(0o755)
        self.env = {**os.environ, 'PATH': str(bindir) + os.pathsep + os.environ['PATH'],
                    'RELEASE_TEST_LOG': str(self.log), 'RELEASE_TEST_FIXTURE': str(self.fixture),
                    'RELEASE_TEST_REMOTE': str(self.remote), 'RELEASE_TEST_REAL_GIT': REAL_GIT}

    def check(self, phase='publish', expected=0, recovery=False):
        self.pr['body'] = '<!-- grow-together-release:v1\n' + json.dumps(self.record) + '\n-->'
        self.fixture.write_text(json.dumps({'pr': self.pr, 'branch': self.branch, 'releases': self.releases}))
        args = [sys.executable, str(SCRIPT), 'verify', '--repo', 'test/releases', '--pr', '123', '--phase', phase]
        if recovery:
            args.append('--recovery')
        before = (self.git('show-ref'), self.git('show-ref', cwd=self.remote), self.git('status', '--porcelain'))
        result = subprocess.run(args, cwd=self.repo, env=self.env, text=True, capture_output=True,
                                stdin=subprocess.DEVNULL)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data['read_only'], True)
        self.assertEqual(data.get('verified'), expected == 0)
        self.assertEqual(before, (self.git('show-ref'), self.git('show-ref', cwd=self.remote),
                                  self.git('status', '--porcelain')))
        return data

    def merged(self):
        self.git('checkout', 'main')
        self.git('merge', '--squash', self.head)
        self.merge = self.save_commit('chore(release): merged Release PR #123')
        self.sync_main()
        self.pr.update(state='MERGED', mergedAt='2026-10-25T12:00:00Z', mergeCommit={'oid': self.merge})

    def annotate(self, app='api', push=False, sha=None, annotation=None, lightweight=False):
        entry = self.record['apps'][app]
        tag = f"{app}/v{entry['version']}"
        annotation = annotation or f'Grow Together release PR #123\nPlan: {release.digest(self.record)}'
        if lightweight:
            self.git('tag', tag, sha or self.merge or self.head)
        else:
            self.git('tag', '-a', tag, sha or self.merge or self.head, '-m', annotation)
        if push:
            self.git('push', self.remote, f'refs/tags/{tag}:refs/tags/{tag}')
        return tag

    def add_mobile(self):
        self.set_versions(mobile='1.1.0', api='0.1.1')
        self.head = self.save_commit('chore(release): include mobile 1.1.0')
        self.record['head'] = self.pr['headRefOid'] = self.head
        self.record['apps']['mobile'] = {'previous_tag': 'mobile/v1.0.0', 'current': '1.0.0',
                                        'version': '1.1.0', 'reason': 'Compatible feature', 'notes': 'Mobile notes'}

    def test_single_app_prepare_and_publish_dry_run(self):
        prepared = self.check(phase='prepare')
        self.assertEqual(prepared['merge'], None)
        self.merged()
        published = self.check()
        self.assertEqual(published['merge'], self.merge)
        self.assertEqual(published['push_refspecs'], ['refs/tags/api/v0.1.1:refs/tags/api/v0.1.1'])
        self.assertEqual(published['manifests']['worker'], '0.1.0')

    def test_multi_app_same_merge_sha(self):
        self.add_mobile()
        self.merged()
        data = self.check()
        self.assertEqual(set(data['create_local']), {'api/v0.1.1', 'mobile/v1.1.0'})
        for app in self.record['apps']:
            self.annotate(app, push=True)
        recovered = self.check(recovery=True)
        self.assertEqual(recovered['push_refspecs'], [])
        self.assertEqual(recovered['merge'], self.merge)

    def test_no_changes_since_tag(self):
        result = subprocess.run([sys.executable, str(SCRIPT), 'inspect', '--ref', self.initial],
                                cwd=self.repo, env=self.env, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout)
        data = json.loads(result.stdout)
        self.assertTrue(all(not row['candidate_files'] and not row['bootstrap'] for row in data['apps'].values()))
        # Worker has no changes; selecting it as an incremental release is invalid.
        self.set_versions(api='0.1.1', worker='0.1.1')
        self.head = self.save_commit('unnecessary worker bump')
        self.record['head'] = self.pr['headRefOid'] = self.head
        self.record['apps']['worker'] = {'previous_tag': 'worker/v0.1.0', 'current': '0.1.0',
                                        'version': '0.1.1', 'reason': 'none', 'notes': 'none'}
        self.assertIn('no candidate changes', self.check(phase='prepare', expected=1)['reason'])

    def test_existing_conflicting_tag_and_lightweight_tag(self):
        self.merged()
        self.annotate(sha=self.base, annotation='Conflicting tag')
        self.assertIn('already exists', self.check(expected=1)['reason'])
        self.assertIn('conflicts', self.check(expected=1, recovery=True)['reason'])
        self.git('tag', '-d', 'api/v0.1.1')  # Fixture only; never used by the helper.
        self.annotate(lightweight=True)
        self.assertIn('lightweight', self.check(expected=1, recovery=True)['reason'])

    def test_failed_pending_missing_and_skipped_ci(self):
        self.merged()
        for checks in ([], [{'status': 'IN_PROGRESS', 'conclusion': ''}],
                       [{'status': 'COMPLETED', 'conclusion': 'FAILURE'}],
                       [{'status': 'COMPLETED', 'conclusion': 'SKIPPED'}], [{'state': 'PENDING'}]):
            with self.subTest(checks=checks):
                self.pr['statusCheckRollup'] = checks
                self.assertIn('CI', self.check(expected=1)['reason'])

    def test_stale_base_before_merge(self):
        self.git('checkout', 'main')
        self.write('README.md', 'New unapproved base\n')
        self.save_commit('main advanced')
        self.sync_main()
        self.assertIn('stale', self.check(phase='prepare', expected=1)['reason'])

    def test_stale_base_raced_into_merge(self):
        self.git('checkout', 'main')
        self.write('README.md', 'Race after approval\n')
        self.save_commit('main advanced')
        self.merged()
        self.assertIn('approval is stale', self.check(expected=1)['reason'])

    def test_missing_github_authentication(self):
        self.env['RELEASE_TEST_NO_AUTH'] = '1'
        self.assertIn('authentication', self.check(expected=1)['reason'])

    def test_noninteractive_preflight_never_authorizes_or_mutates(self):
        self.merged()
        data = self.check()
        self.assertTrue(data['requires_human_approval'])
        self.assertEqual(data['deployment'], 'unverified')
        self.assertFalse(any(v['local'] or v['remote'] or v['published'] for v in data['tags'].values()))
        calls = [json.loads(line) for line in self.log.read_text().splitlines()]
        self.assertFalse(any(c[:3] in (['gh', 'release', 'create'], ['gh', 'pr', 'merge']) for c in calls))

    def test_partial_publication_and_completed_retry(self):
        self.add_mobile()
        self.merged()
        for app in self.record['apps']:
            self.annotate(app, push=True)
        self.releases = [{'tag_name': 'api/v0.1.1', 'name': 'api/v0.1.1', 'body': 'API fix notes',
                          'draft': False, 'prerelease': False, 'html_url': 'https://example.invalid/api'}]
        data = self.check(recovery=True)
        self.assertEqual(data['create_local'], [])
        self.assertEqual(data['push_refspecs'], [])
        self.assertEqual(data['create_releases'], ['mobile/v1.1.0'])
        self.releases.append({'tag_name': 'mobile/v1.1.0', 'name': 'mobile/v1.1.0', 'body': 'Mobile notes',
                              'draft': False, 'prerelease': False, 'html_url': 'https://example.invalid/mobile'})
        self.assertEqual(self.check(recovery=True)['create_releases'], [])

    def test_local_only_tags_after_interruption(self):
        self.merged()
        self.annotate()
        data = self.check(recovery=True)
        self.assertEqual(data['create_local'], [])
        self.assertEqual(data['push_refspecs'], ['refs/tags/api/v0.1.1:refs/tags/api/v0.1.1'])

    def test_remote_tag_wrong_object_identity(self):
        self.merged()
        self.annotate(push=True)
        self.git('tag', '-d', 'api/v0.1.1')
        self.annotate(annotation='Wrong plan')
        self.assertIn('missing/conflicting', self.check(recovery=True, expected=1)['reason'])

    def test_modified_pr_record_blocks_recovery(self):
        self.merged()
        self.annotate(push=True)
        self.record['apps']['api']['notes'] = 'Edited after tag publication'
        self.assertIn('conflicts', self.check(recovery=True, expected=1)['reason'])

    def test_wrong_existing_release_never_overwritten(self):
        self.merged()
        self.annotate(push=True)
        self.releases = [{'tag_name': 'api/v0.1.1', 'name': 'api/v0.1.1', 'body': 'Wrong notes',
                          'draft': False, 'prerelease': False}]
        self.assertIn('conflicts', self.check(recovery=True, expected=1)['reason'])

    def test_unprotected_main(self):
        self.branch['protected'] = False
        self.assertIn('unprotected', self.check(phase='prepare', expected=1)['reason'])

    def test_unmerged_or_wrong_target_pr(self):
        self.assertIn('merged Release PR', self.check(expected=1)['reason'])
        self.pr['baseRefName'] = 'develop'
        self.assertIn('targeting main', self.check(phase='prepare', expected=1)['reason'])

    def test_forged_or_unknown_record(self):
        self.record['schema'] = 2
        self.assertIn('schema', self.check(phase='prepare', expected=1)['reason'])
        self.record['schema'] = 1
        self.record['apps']['imaginary'] = copy.deepcopy(self.record['apps']['api'])
        self.assertIn('known application', self.check(phase='prepare', expected=1)['reason'])

    def test_unexpected_application_version_change(self):
        self.set_versions(api='0.1.1', worker='0.2.0')
        self.head = self.save_commit('unexpected worker version')
        self.record['head'] = self.pr['headRefOid'] = self.head
        self.assertIn('outside selected', self.check(phase='prepare', expected=1)['reason'])

    def test_dependency_change_inside_allowed_manifest(self):
        self.write('apps/api/build.gradle', "plugins { id 'other-plugin' }\nversion = '0.1.1'\n")
        self.head = self.save_commit('unexpected dependency change')
        self.record['head'] = self.pr['headRefOid'] = self.head
        self.assertIn('Non-version', self.check(phase='prepare', expected=1)['reason'])

    def test_manifest_mismatch(self):
        self.record['apps']['api']['version'] = '0.1.2'
        self.assertIn('manifests', self.check(phase='prepare', expected=1)['reason'])

    def test_head_changed(self):
        self.pr['headRefOid'] = self.base
        self.assertIn('head changed', self.check(phase='prepare', expected=1)['reason'])

    def test_contract_only_change_does_not_select_worker(self):
        self.git('checkout', 'main')
        self.write('contracts/openapi.yaml', 'openapi: 3.1.0\n')
        target = self.save_commit('contract update')
        result = subprocess.run([sys.executable, str(SCRIPT), 'inspect', '--ref', target],
                                cwd=self.repo, env=self.env, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout)
        apps = json.loads(result.stdout)['apps']
        self.assertIn('contracts/openapi.yaml', apps['api']['candidate_files'])
        self.assertIn('contracts/openapi.yaml', apps['mobile']['candidate_files'])
        self.assertEqual(apps['worker']['candidate_files'], [])

    def test_bootstrap_does_not_require_manifest_bump(self):
        for tag in self.git('tag', '--list').splitlines():
            self.git('tag', '-d', tag)
            self.git('push', self.remote, f':refs/tags/{tag}')
        self.record['apps']['api']['previous_tag'] = None
        self.record['apps']['api']['version'] = self.record['apps']['api']['current']
        self.set_versions()
        self.head = self.save_commit('initial stable release')
        self.record['head'] = self.pr['headRefOid'] = self.head
        self.check(phase='prepare')

    def test_approved_merge_allows_later_main_without_retagging(self):
        self.merged()
        approved_merge = self.merge
        self.write('README.md', 'main has advanced after the valid release merge\n')
        self.save_commit('later unrelated commit')
        self.sync_main()
        data = self.check()
        self.assertEqual(data['merge'], approved_merge)
        self.assertNotEqual(data['merge'], data['main'])

    def test_later_unrelated_release_does_not_block_partial_recovery(self):
        self.add_mobile()
        self.merged()
        for app in self.record['apps']:
            self.annotate(app, push=True)
        self.releases = [{'tag_name': 'api/v0.1.1', 'name': 'api/v0.1.1', 'body': 'API fix notes',
                          'draft': False, 'prerelease': False, 'html_url': 'https://example.invalid/api'}]
        self.set_versions(mobile='1.1.0', api='0.1.1', worker='0.1.1')
        self.save_commit('later independent worker release')
        self.sync_main()
        self.git('tag', '-a', 'worker/v0.1.1', '-m', 'Later approved worker release')
        self.git('push', self.remote, 'refs/tags/worker/v0.1.1:refs/tags/worker/v0.1.1')
        data = self.check(recovery=True)
        self.assertEqual(data['push_refspecs'], [])
        self.assertEqual(data['create_releases'], ['mobile/v1.1.0'])

    def test_new_tag_cannot_publish_older_version_after_newer_release(self):
        self.merged()
        self.set_versions(api='0.1.2')
        self.save_commit('later API release')
        self.sync_main()
        self.git('tag', '-a', 'api/v0.1.2', '-m', 'Later approved API release')
        self.git('push', self.remote, 'refs/tags/api/v0.1.2:refs/tags/api/v0.1.2')
        self.assertIn('equal/newer', self.check(expected=1)['reason'])

    def test_snapshot_bootstrap_normalization(self):
        self.git('checkout', 'main')
        self.git('tag', '-d', 'api/v0.1.0')
        self.git('push', self.remote, ':refs/tags/api/v0.1.0')
        self.set_versions(api='0.0.1-SNAPSHOT')
        self.base = self.save_commit('untagged API snapshot baseline')
        self.sync_main()
        self.git('checkout', '-b', 'release/2026-10-25-2')
        self.set_versions(api='0.0.1')
        self.head = self.save_commit('normalize approved initial API version')
        self.record.update(base=self.base, head=self.head)
        self.record['apps']['api'].update(previous_tag=None, current='0.0.1-SNAPSHOT', version='0.0.1')
        self.pr.update(headRefOid=self.head, headRefName='release/2026-10-25-2')
        self.check(phase='prepare')

    def test_worker_release_checks_local_lock_entry(self):
        self.git('checkout', 'main')
        self.write('apps/ai-worker/app.py', '# worker fix already QA approved\n')
        self.base = self.save_commit('worker fix')
        self.sync_main()
        self.git('checkout', '-b', 'release/2026-10-25-2')
        self.set_versions(worker='0.1.1')
        self.head = self.save_commit('worker version')
        self.record.update(base=self.base, head=self.head)
        self.record['apps'] = {'worker': {'previous_tag': 'worker/v0.1.0', 'current': '0.1.0',
                                         'version': '0.1.1', 'reason': 'Worker fix', 'notes': 'Worker notes'}}
        self.pr.update(headRefOid=self.head, headRefName='release/2026-10-25-2')
        self.check(phase='prepare')
        self.write('apps/ai-worker/uv.lock', 'version = 1\n[[package]]\nname = "worker"\n'
                   'version = "0.1.0"\nsource = {virtual = "."}\n')
        self.head = self.save_commit('inconsistent lock entry')
        self.record['head'] = self.pr['headRefOid'] = self.head
        self.assertIn('lock versions', self.check(phase='prepare', expected=1)['reason'])

    def test_protection_lookup_failure_blocks_release(self):
        self.merged()
        self.env['RELEASE_TEST_FAIL_API'] = '1'
        self.assertIn('lookup failed', self.check(expected=1)['reason'])

    def test_merge_commit_absent_from_main_history(self):
        self.merged()
        self.git('update-ref', 'refs/heads/main', self.base, cwd=self.remote)
        self.git('update-ref', 'refs/remotes/origin/main', self.base)
        self.branch['commit']['sha'] = self.base
        self.assertIn('not on fetched main', self.check(expected=1)['reason'])

    def test_merge_tree_differs_from_approved_head(self):
        self.git('checkout', 'main')
        self.git('merge', '--squash', self.head)
        self.write('README.md', 'Unapproved content in the merge result\n')
        self.merge = self.save_commit('unexpected merge content')
        self.pr.update(state='MERGED', mergedAt='2026-10-25T12:00:00Z', mergeCommit={'oid': self.merge})
        self.sync_main()
        self.assertIn('Merged tree differs', self.check(expected=1)['reason'])

    def test_fetched_main_must_match_live_remote(self):
        self.merged()
        self.git('update-ref', 'refs/remotes/origin/main', self.base)
        self.assertIn('stale/missing', self.check(expected=1)['reason'])

    def test_read_only_helper_has_no_mutation_modes(self):
        result = subprocess.run([sys.executable, str(SCRIPT), 'publish', '--yes'], cwd=self.repo,
                                env=self.env, text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.log.exists())


if __name__ == '__main__':
    unittest.main()
