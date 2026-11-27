import glob
import json
import os
import re
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
UNSUPPORTED_BY_GO = re.compile(r'\(\?[=!<]|\\[1-9]')


def patterns(node):
    if isinstance(node, dict):
        for key, value in node.items():
            if key == 'pattern' and isinstance(value, str):
                yield value
            else:
                yield from patterns(value)
    elif isinstance(node, list):
        for value in node:
            yield from patterns(value)


class ActionSchemaPatternsTest(unittest.TestCase):
    def test_patterns_use_only_syntax_the_agent_validator_supports(self):
        files = glob.glob(os.path.join(ROOT, 'imageroot', 'actions', '*', 'validate-*.json'))
        self.assertTrue(files)
        for path in files:
            with open(path) as handle:
                schema = json.load(handle)
            for pattern in patterns(schema):
                with self.subTest(schema=os.path.relpath(path, ROOT), pattern=pattern):
                    self.assertIsNone(UNSUPPORTED_BY_GO.search(pattern))
                    re.compile(pattern)


if __name__ == '__main__':
    unittest.main()
