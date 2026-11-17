from contextlib import contextmanager
from app.workers import runner


def test_worker_recovers_when_heartbeat_database_connection_fails(monkeypatch):
    handlers, attempts, processed, delays = {}, [], [], []
    monkeypatch.setattr(runner.signal, 'signal', lambda sig, fn: handlers.update({sig: fn}))
    class Connection:
        def execute(self, *args): pass
    @contextmanager
    def connection():
        attempts.append(True)
        if len(attempts) == 1: raise ConnectionError('Transient database interruption')
        yield Connection()
    class Worker:
        def run_once(self):
            processed.append(True)
            return False
    def sleep(delay):
        delays.append(delay)
        if len(delays) == 2: handlers[runner.signal.SIGTERM]()
    monkeypatch.setattr(runner, 'transaction', connection)
    monkeypatch.setattr(runner, 'Worker', Worker)
    monkeypatch.setattr(runner.time, 'sleep', sleep)
    runner.main()
    assert len(attempts) == 2 and len(processed) == 1
    assert delays == [5, 2]
