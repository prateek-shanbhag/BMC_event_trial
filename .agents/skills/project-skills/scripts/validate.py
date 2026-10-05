import unittest
import os
import sys
from pathlib import Path

# Add tests dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

if __name__ == '__main__':
    tests = unittest.TestLoader().discover('tests')
    result = unittest.TextTestRunner(verbosity=2).run(tests)
    if not result.wasSuccessful():
        sys.exit(1)
