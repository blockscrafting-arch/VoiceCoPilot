"""Build a bundled sidecar executable for the API server."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def main() -> None:
    """Run PyInstaller to build the sidecar binary."""
    root = Path(__file__).resolve().parents[2]
    src_dir = root / "apps" / "api" / "src"
    output_dir = root / "apps" / "web" / "src-tauri" / "binaries"
    output_dir.mkdir(parents=True, exist_ok=True)

    entrypoint = src_dir / "voicecopilot_api" / "sidecar.py"

    cmd = [
        str(Path(__file__).resolve().parents[2] / "apps" / "api" / ".venv" / "Scripts" / "python"),
        "-m",
        "PyInstaller",
        "--onefile",
        "--name",
        "voicecopilot-api",
        "--clean",
        "--noconsole",
        "--distpath",
        str(output_dir),
        "--workpath",
        str(root / "apps" / "api" / "build" / "pyinstaller"),
        "--paths",
        str(src_dir),
        str(entrypoint),
    ]

    subprocess.run(cmd, check=True)

    source_exe = output_dir / "voicecopilot-api.exe"
    target_exe = output_dir / "voicecopilot-api-x86_64-pc-windows-msvc.exe"
    if source_exe.exists():
        shutil.copy2(source_exe, target_exe)

    release_dir = root / "apps" / "web" / "src-tauri" / "target" / "release"
    if release_dir.exists() and source_exe.exists():
        shutil.copy2(source_exe, release_dir / "voicecopilot-api.exe")
        shutil.copy2(source_exe, release_dir / "voicecopilot-api-x86_64-pc-windows-msvc.exe")


if __name__ == "__main__":
    main()
