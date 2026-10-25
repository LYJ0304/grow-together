"""Run with python3 -m unittest discover -s .harness/tests -v. No live GitHub writes."""

import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CHECK = ROOT / '.harness/skills/ship/scripts/check_merge.py'


class SkillFiles(unittest.TestCase):
    def test_discovery_frontmatter_and_links(self):
        for name in ('plan', 'raise', 'start', 'ship', 'release'):
            with self.subTest(skill=name):
                canonical = ROOT / '.harness/skills' / name / 'SKILL.md'
                discovered = ROOT / '.agents/skills' / name
                self.assertTrue(discovered.is_symlink())
                self.assertEqual(discovered.resolve(), canonical.parent)
                source = canonical.read_text()
                frontmatter = source.split('---', 2)[1]
                self.assertIn(f'name: {name}\n', frontmatter)
                self.assertRegex(frontmatter, r'\ndescription: \S')
                self.assertEqual(canonical.read_bytes(), (discovered / 'SKILL.md').read_bytes())
                for document in canonical.parent.rglob('*.md'):
                    for link in re.findall(r'\]\(([^)]+)\)', document.read_text()):
                        if '://' not in link:
                            self.assertTrue((document.parent / link.split('#')[0]).exists(), link)


class MergeEvidence(unittest.TestCase):
    branch = 'docs/issue-75-workflow'

    def git(self, *args, cwd=None):
        return subprocess.check_output(
            ['git', *args], cwd=cwd or self.primary, text=True, stderr=subprocess.PIPE,
        ).strip()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='growtogether-harness-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.primary = self.root / 'primary'
        self.task = self.root / 'task'
        self.remote = self.root / 'origin.git'
        self.primary.mkdir()
        self.git('init', '--bare', str(self.remote))
        self.git('init', '-b', 'develop')
        self.git('config', 'user.name', 'Workflow Test')
        self.git('config', 'user.email', 'workflow@example.invalid')
        (self.primary / '.gitignore').write_text('.env\nnode_modules/\napps/api/build/\n')
        self.git('add', '.gitignore')
        self.git('commit', '-m', 'chore(test): initialize isolated repository')
        self.git('remote', 'add', 'origin', str(self.remote))
        self.git('push', '-u', 'origin', 'develop')
        self.git('worktree', 'add', '-b', self.branch, str(self.task))
        (self.task / 'task.txt').write_text('task implementation\n')
        self.git('add', 'task.txt', cwd=self.task)
        self.git('commit', '-m', 'docs(test): implement task', cwd=self.task)
        self.head = self.git('rev-parse', 'HEAD', cwd=self.task)
        self.git('push', '-u', 'origin', self.branch)
        self.git('merge', '--squash', self.branch)
        self.git('commit', '-m', 'docs(test): squash task')
        self.merged = self.git('rev-parse', 'HEAD')
        self.git('push', 'origin', 'develop')
        self.fixture = {
            'state': 'MERGED', 'mergedAt': '2026-10-18T00:00:00Z',
            'headRefName': self.branch, 'headRefOid': self.head,
            'baseRefName': 'develop', 'mergeCommit': {'oid': self.merged},
        }
        self.fixture_file = self.root / 'pr.json'
        binary_dir = self.root / 'bin'
        binary_dir.mkdir()
        gh = binary_dir / 'gh'
        gh.write_text(
            f'#!{sys.executable}\n'
            'import os,sys\nfrom pathlib import Path\n'
            "assert sys.argv[1:4] == ['pr', 'view', '75']\n"
            "assert sys.argv[4:6] == ['--repo', 'test/workflow']\n"
            "if os.environ.get('WORKFLOW_TEST_GH_FAIL'): sys.exit(1)\n"
            "print(Path(os.environ['WORKFLOW_TEST_PR_FILE']).read_text())\n"
        )
        gh.chmod(0o755)
        self.env = {
            **os.environ, 'PATH': str(binary_dir) + os.pathsep + os.environ['PATH'],
            'WORKFLOW_TEST_PR_FILE': str(self.fixture_file),
        }

    def check(self, expected=0, raw=None):
        self.fixture_file.write_text(raw if raw is not None else json.dumps(self.fixture))
        result = subprocess.run(
            [sys.executable, str(CHECK), '--repo', 'test/workflow', '--pr', '75',
             '--worktree', str(self.task), '--branch', self.branch, '--base', 'develop'],
            env=self.env, text=True, capture_output=True,
        )
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout)['verified'], expected == 0)
        return result

    def test_squash_merge_and_safe_cleanup_repeated(self):
        ancestry = subprocess.run(
            ['git', 'merge-base', '--is-ancestor', self.head, 'origin/develop'],
            cwd=self.primary, capture_output=True,
        )
        self.assertEqual(ancestry.returncode, 1, 'Squash must not require PR-head ancestry')
        self.check()
        self.check()  # Evidence checking itself never mutates/deletes the task checkout.
        self.assertTrue(self.task.exists())
        self.assertEqual(self.git('status', '--porcelain', cwd=self.task), '')
        self.git('worktree', 'remove', str(self.task))
        self.assertFalse(self.task.exists())
        self.assertNotIn(str(self.task), self.git('worktree', 'list', '--porcelain'))
        self.assertEqual(self.git('rev-parse', self.branch), self.head)
        self.assertTrue(self.primary.exists())
        # A repeated cleanup follows the documented already-absent path, without recreation.
        self.assertNotIn(str(self.task), self.git('worktree', 'list', '--porcelain'))

    def test_open_closed_and_merge_queue_preserve_environment(self):
        (self.task / 'node_modules').mkdir()
        cache = self.task / 'node_modules' / 'fixture.txt'
        cache.write_text('review environment')
        for state in ('OPEN', 'CLOSED'):
            with self.subTest(state=state):
                self.fixture.update(state=state, mergedAt=None, mergeCommit=None)
                self.check(1)
                self.assertEqual(cache.read_text(), 'review environment')
        self.fixture.update(state='OPEN', autoMergeRequest={'enabled': True}, mergeQueueEntry={})
        self.check(1)
        self.assertTrue(self.task.exists())

    def test_missing_merge_evidence(self):
        self.fixture['mergedAt'] = None
        self.check(1)
        self.fixture['mergedAt'] = '2026-10-18T00:00:00Z'
        self.fixture['mergeCommit'] = None
        self.check(1)

    def test_wrong_branch_or_target(self):
        self.fixture['headRefName'] = 'docs/another-task'
        self.check(1)
        self.fixture.update(headRefName=self.branch, baseRefName='main')
        self.check(1)

    def test_unpublished_post_merge_commit(self):
        self.git('commit', '--allow-empty', '-m', 'docs(test): preserve follow-up', cwd=self.task)
        self.check(1)
        self.assertTrue(self.task.exists())

    def test_wrong_local_checkout(self):
        self.git('switch', '-c', 'docs/another-task', cwd=self.task)
        self.check(1)

    def test_merge_result_not_on_target(self):
        self.fixture['mergeCommit'] = {'oid': self.head}
        self.check(1)

    def test_lookup_and_fetch_failures(self):
        self.env['WORKFLOW_TEST_GH_FAIL'] = '1'
        self.check(2)
        del self.env['WORKFLOW_TEST_GH_FAIL']
        self.check(2, raw='not json')
        self.git('remote', 'set-url', 'origin', str(self.root / 'missing.git'))
        self.check(2)
        self.assertTrue(self.task.exists())

    def test_newer_remote_task_commit(self):
        # Manufacture only a temporary remote follow-up; never alter a real user's branch.
        result = subprocess.run(
            ['git', 'commit-tree', f'{self.head}^{{tree}}', '-p', self.head],
            input='docs(test): remote follow-up\n', text=True, capture_output=True,
            check=True, cwd=self.primary,
        )
        self.git('push', 'origin', f'{result.stdout.strip()}:refs/heads/{self.branch}')
        self.check(1)

    def test_deleted_remote_task_branch_and_later_target_commit(self):
        self.git('push', 'origin', '--delete', self.branch)
        self.git('commit', '--allow-empty', '-m', 'docs(test): advance target')
        self.git('push', 'origin', 'develop')
        self.check()
        self.assertTrue(self.task.exists())

    def test_detached_checkout_is_preserved(self):
        self.git('switch', '--detach', cwd=self.task)
        self.check(2)
        self.assertTrue(self.task.exists())

    def test_dirty_secret_and_nonallowlisted_data_are_never_deleted_by_checker(self):
        (self.task / 'task.txt').write_text('uncommitted work\n')
        (self.task / 'notes.txt').write_text('personal notes\n')
        (self.task / '.env').write_text('test-only fixture; not a credential\n')
        generated = self.task / 'apps/api/build'
        generated.mkdir(parents=True)
        (generated / 'fixture.txt').write_text('outside cleanup allowlist')
        self.git('worktree', 'lock', str(self.task))
        self.check()  # Merge evidence alone is deliberately insufficient for deletion.
        for path in ('task.txt', 'notes.txt', '.env', 'apps/api/build/fixture.txt'):
            self.assertTrue((self.task / path).exists())
        self.assertIn('locked', self.git('worktree', 'list', '--porcelain'))
        blocked = subprocess.run(
            ['git', 'worktree', 'remove', str(self.task)],
            cwd=self.primary, capture_output=True,
        )
        self.assertNotEqual(blocked.returncode, 0)
        self.git('worktree', 'unlock', str(self.task))
        dirty = subprocess.run(
            ['git', 'worktree', 'remove', str(self.task)],
            cwd=self.primary, capture_output=True,
        )
        self.assertNotEqual(dirty.returncode, 0)
        self.assertTrue((self.task / '.env').exists())


if __name__ == '__main__':
    unittest.main()
