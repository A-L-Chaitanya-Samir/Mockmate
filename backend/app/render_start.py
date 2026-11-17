"""Run the API and durable worker together for a single-instance portfolio host."""
import os
import signal
import subprocess
import sys
import time


def supervise(commands, shutdown_seconds=20):
    children = []
    stopping = False

    def request_stop(signum, frame):
        nonlocal stopping
        stopping = True

    previous = {}
    try:
        for signum in (signal.SIGINT, signal.SIGTERM):
            previous[signum] = signal.signal(signum, request_stop)
        for command in commands:
            children.append(subprocess.Popen(command))
        while not stopping:
            if any(child.poll() is not None for child in children):
                print('A backend process exited; stopping the service.', flush=True)
                return 1
            time.sleep(0.5)
        return 0
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        deadline = time.monotonic() + shutdown_seconds
        for child in children:
            try:
                child.wait(timeout=max(0, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
        for signum, handler in previous.items():
            signal.signal(signum, handler)


def main():
    port = int(os.environ.get('PORT', '10000'))
    if not 1 <= port <= 65535:
        raise ValueError('PORT must be between 1 and 65535.')
    return supervise([
        [sys.executable, '-m', 'app.workers.runner'],
        [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0',
         '--port', str(port), '--workers', '1', '--no-access-log'],
    ])


if __name__ == '__main__':
    raise SystemExit(main())
