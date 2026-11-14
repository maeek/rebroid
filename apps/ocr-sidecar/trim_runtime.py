"""Trim the installed Linux OCR environment before copying it to the runtime image."""

import base64
import csv
import hashlib
from importlib.metadata import distributions, version
from pathlib import Path
from subprocess import run
from tempfile import TemporaryDirectory


# PP-OCR uses Paddle's native inference engine. The OpenVINO CPU plugin is
# loaded on demand by the opt-in OpenVINO engine. Keep the linked libraries.
OPENVINO_CPU_PLUGIN = "paddle/libs/libopenvino_intel_cpu_plugin.so"
PADDLE_HEADERS = "paddle/include/"


def strip_library(path: Path, output: Path) -> tuple[str, str] | None:
    run(["strip", "--strip-unneeded", "-o", output, path], check=True)
    size = output.stat().st_size
    if size >= path.stat().st_size:
        return None

    output.chmod(path.stat().st_mode & 0o777)
    output.replace(path)
    with path.open("rb") as library:
        digest = hashlib.file_digest(library, "sha256").digest()
    return "sha256=" + base64.urlsafe_b64encode(digest).decode().rstrip("="), str(size)


def main() -> None:
    if version("paddlepaddle") != "3.0.0":
        raise ValueError("Review the PaddlePaddle wheel layout before changing its version.")

    for distribution in distributions():
        (record,) = (
            distribution.locate_file(file)
            for file in distribution.files or ()
            if len(file.parts) == 2 and file.name == "RECORD" and file.parent.name.endswith(".dist-info")
        )
        with record.open(newline="", encoding="utf-8") as source:
            rows = list(csv.reader(source))

        is_paddle = distribution.metadata["Name"] == "paddlepaddle"
        if is_paddle and not any(name == OPENVINO_CPU_PLUGIN for name, _, _ in rows):
            raise ValueError("Expected OpenVINO CPU plugin in the PaddlePaddle wheel.")

        kept = []
        with TemporaryDirectory(dir=record.parent.parent) as temporary:
            output = Path(temporary) / "library.so"
            for name, digest, size in rows:
                path = distribution.locate_file(name)
                if is_paddle and (name == OPENVINO_CPU_PLUGIN or name.startswith(PADDLE_HEADERS)):
                    path.unlink()
                    continue
                if ".so" in path.suffixes and size and int(size) >= 1024**2:
                    stripped_metadata = strip_library(path, output)
                    if stripped_metadata:
                        digest, size = stripped_metadata
                kept.append((name, digest, size))

        if rows != [list(row) for row in kept]:
            with record.open("w", newline="", encoding="utf-8") as target:
                csv.writer(target).writerows(kept)


if __name__ == "__main__":
    main()
