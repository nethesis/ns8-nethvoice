"""Coordinate new admissions with a Satellite configuration restart."""
import argparse
import fcntl
import os
from pathlib import Path
import stat
import tempfile

LOCK = Path(tempfile.gettempdir()) / f'satellite-work-{os.geteuid()}.lock'


def _locked(mode):
    fd = os.open(LOCK, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
    stream = os.fdopen(fd, 'r+b', buffering=0)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_nlink != 1:
            raise OSError('invalid Satellite work lock')
        fcntl.flock(fd, mode | fcntl.LOCK_NB)
        return stream
    except BlockingIOError:
        stream.close()
        return None
    except BaseException:
        stream.close()
        raise


def admit_work():
    lease = _locked(fcntl.LOCK_SH)
    if lease is not None and lease.read(1):
        lease.close()
        return None
    return lease


def claim_idle(*, cancel=False):
    lease = _locked(fcntl.LOCK_EX)
    if lease is None:
        return False
    with lease:
        if cancel:
            lease.truncate(0)
        else:
            lease.write(b'1')
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cancel', action='store_true')
    raise SystemExit(0 if claim_idle(cancel=parser.parse_args().cancel) else os.EX_TEMPFAIL)
