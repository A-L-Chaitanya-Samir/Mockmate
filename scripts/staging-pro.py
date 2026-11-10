"""Operator-only testing. No HTTP self-upgrade endpoint exists."""
import argparse
import os
import sys
from pathlib import Path
from uuid import UUID
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.core.db import transaction
from app.modules.service import ensure_account

parser = argparse.ArgumentParser()
parser.add_argument('user_id', type=UUID)
parser.add_argument('--plan', choices=['free','pro'], default='pro')
args = parser.parse_args()
if os.getenv('APP_ENV') not in ('development','staging'):
    raise SystemExit('Set APP_ENV=development or staging. This command is disabled in production.')
with transaction() as conn:
    ensure_account(conn, args.user_id)
    conn.execute('UPDATE entitlements SET plan=%s WHERE user_id=%s', (args.plan,args.user_id))
print('Test entitlement updated server-side.')
