import argparse
import json
from pathlib import Path

from .catalog import AppleCatalog
from .native import NativeMusic
from .storage import data_dir, save_private


def main():
    parser = argparse.ArgumentParser(prog="apple-music-hybrid")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("serve")
    commands.add_parser("doctor")
    auth = commands.add_parser("authorize")
    auth.add_argument("--port", type=int, default=8769)
    auth.add_argument("--timeout", type=int, default=600)
    setup = commands.add_parser("configure")
    setup.add_argument("--key-path", type=Path, required=True)
    setup.add_argument("--key-id", required=True)
    setup.add_argument("--team-id", required=True)
    setup.add_argument("--storefront", default="us")
    args = parser.parse_args()
    if args.command == "serve":
        from .server import build_server

        build_server().run()
    elif args.command == "doctor":
        print(
            json.dumps(
                {"native": NativeMusic().status(), "musickit": AppleCatalog().readiness()}, indent=2
            )
        )
    elif args.command == "configure":
        path = args.key_path.expanduser().resolve(strict=True)
        if path.stat().st_mode & 0o077:
            raise SystemExit("Private key must have permissions 0600 before configuration.")
        save_private(
            data_dir() / "musickit.json",
            {
                "key_path": str(path),
                "key_id": args.key_id,
                "team_id": args.team_id,
                "storefront": args.storefront,
            },
        )
        AppleCatalog().developer_token()
        print("MusicKit configuration saved. Private-key contents were not copied.")
    elif args.command == "authorize":
        from .authorize import authorize

        if not authorize(args.port, args.timeout):
            raise SystemExit("Authorization did not complete before timeout. Run authorize again.")
        print("Apple Music authorization verified and saved on this Mac.")


if __name__ == "__main__":
    main()
