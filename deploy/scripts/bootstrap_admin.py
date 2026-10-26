"""Create a separate administrator, receiving its password through a pipe only."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from sqlalchemy import select  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--email", required=True)
arguments = parser.parse_args()
password = sys.stdin.readline().rstrip("\r\n")
if len(password) < 18:
    raise SystemExit("Use a new random administrator password with at least 18 characters")
with SessionLocal() as session:
    if session.scalar(select(User).where(User.email == arguments.email)):
        raise SystemExit("Refusing to replace an existing administrator")
    session.add(User(email=arguments.email, password_hash=hash_password(password),
                     first_name="Store", last_name="Administrator", role=UserRole.ADMIN))
    session.commit()
print("Created separate administrator: " + arguments.email)
