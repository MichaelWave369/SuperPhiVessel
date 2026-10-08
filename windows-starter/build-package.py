#!/usr/bin/env python3
"""Build a deterministic, audited three-file Windows starter ZIP for GitHub Pages.

This packages only the standalone read-only launcher, not the full runtime.
No network requests, package installations, secrets, certificate roots or
system mutations. The ZIP is created at the caller's chosen output path.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "windows-starter"
DEFAULT_OUTPUT = ROOT / "site" / "downloads" / "SuperPhiVessel-Windows-Starter.zip"
FILES = ("START_HERE.txt", "Start-Vessie.cmd", "Start-Vessie.ps1")
MAX_SOURCE = 64 * 1024


def build(output: Path) -> tuple[str, int]:
    resolved = output.resolve()
    if resolved.is_relative_to(SOURCE.resolve()):
        raise ValueError("Refusing to write the release ZIP into source scripts")
    data: dict[str, bytes] = {}
    for name in FILES:
        source = SOURCE / name
        if source.is_symlink() or not source.is_file():
            raise ValueError("Starter source file is missing or a symlink")
        content = source.read_bytes()
        if not content or len(content) > MAX_SOURCE:
            raise ValueError("Unexpected starter source file length")
        data[name] = content
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in FILES:
            entry = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.create_system = 0
            entry.external_attr = (0o100644 << 16)
            archive.writestr(entry, data[name], compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(output, "r") as archive:
        if tuple(archive.namelist()) != FILES or archive.testzip() is not None:
            raise ValueError("Unexpected starter ZIP entries or corrupt archive")
        for name in FILES:
            if archive.read(name) != data[name]:
                raise ValueError("Source/archive mismatch")
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    return digest, output.stat().st_size


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build fixed-content Windows starter ZIP")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        sha, size = build(args.output)
    except (OSError, ValueError, zipfile.BadZipFile) as exc:
        print("STARTER_BUILD_BLOCKED:" + type(exc).__name__, file=sys.stderr)
        sys.exit(2)
    print("VESSIE_STARTER_PACKAGE_PASS")
    print("zip_sha256=" + sha)
    print("zip_size_bytes=" + str(size))
