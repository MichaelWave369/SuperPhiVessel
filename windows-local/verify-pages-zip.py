#!/usr/bin/env python3
"""Verify exactly the approved Vessie Windows portable ZIP payload.

Both PR CI and the public GitHub Pages deploy must run this same verifier.
A changed portable package must update this closed allowlist through review.
"""
from __future__ import annotations

import sys
from pathlib import Path
from zipfile import BadZipFile, ZipFile

MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
REQUIRED = frozenset({
    "node.exe", "LICENSE.node.txt", "START_HERE.txt",
    "Start-Local-Vessie.cmd", "Start-Local-Trial.cmd",
    "Start-PhiServe-Desk.cmd",
    "local-console/server.mjs",
    "local-console/trial-runner.mjs",
    "local-console/ollama-probe.mjs",
    "local-console/phi-gui-bridge.mjs",
    "local-console/ui/index.html",
    "local-console/ui/style.css",
    "local-console/ui/app.js",
    "local-console/ui/review-evidence.mjs",
    "local-console/ui/evidence-bench.mjs",
    "local-console/ui/portable-bench.mjs",
    "local-console/ui/trial-protocols.mjs",
    "local-console/ui/protocol-cohorts.mjs",
    "local-console/ui/human-review-guides.mjs",
    "local-console/ui/model-desk.mjs",
    "local-console/ui/model-desk-ui.mjs",
    "vessie-phiserve-draft-v0.1/adapter.mjs",
})


def verify(path: Path) -> None:
    if not path.is_file() or not 0 < path.stat().st_size <= MAX_ARCHIVE_BYTES:
        raise ValueError("PORTABLE_ARCHIVE_MISSING_EMPTY_OR_OVERSIZED")

    with ZipFile(path) as archive:
        infos = archive.infolist()
        names = [info.filename.replace("\\", "/") for info in infos if not info.is_dir()]
        if len(names) != len(REQUIRED) or len(set(names)) != len(names):
            raise ValueError("PORTABLE_ARCHIVE_ENTRY_COUNT_OR_DUPLICATE_MISMATCH")

        actual = set(names)
        if actual != REQUIRED:
            extra = sorted(actual - REQUIRED)
            missing = sorted(REQUIRED - actual)
            raise ValueError(
                f"PORTABLE_ARCHIVE_ALLOWLIST_MISMATCH extra={extra} missing={missing}"
            )

        # Reject unexpected directory/other entries and Unix symlinks.
        for info in infos:
            if info.is_dir():
                directory = info.filename.replace("\\", "/").rstrip("/")
                if not any(name.startswith(directory + "/") for name in REQUIRED):
                    raise ValueError("PORTABLE_ARCHIVE_UNKNOWN_DIRECTORY")
            elif (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("PORTABLE_ARCHIVE_SYMLINK_DENIED")
            elif not info.file_size:
                raise ValueError("PORTABLE_ARCHIVE_EMPTY_PAYLOAD")
        if archive.testzip() is not None:
            raise ValueError("PORTABLE_ARCHIVE_CORRUPT")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("EXPECTED_EXACTLY_ONE_ARCHIVE_PATH")
        verify(Path(sys.argv[1]))
        print("windows-local-console-pages-download: PASS")
    except (ValueError, OSError, BadZipFile) as error:
        print(f"windows-local-console-pages-download: FAIL ({error})", file=sys.stderr)
        sys.exit(1)
