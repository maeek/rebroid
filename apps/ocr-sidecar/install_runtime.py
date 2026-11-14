"""Install the OCR runtime with one provider of the cv2 module."""

from importlib.metadata import distributions
from os import environ
from pathlib import Path
from subprocess import run
from sys import executable
from tempfile import TemporaryDirectory

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name


# Pin each repacked wheel and validate its upstream OpenCV declarations before editing.
WHEELS = {
    "paddleocr==2.9.1": {"opencv-python", "opencv-contrib-python"},
    "imgaug==0.4.0": {"opencv-python"},
    "albumentations==1.4.10": {"opencv-python-headless"},
    "albucore==0.0.13": {"opencv-python-headless"},
}
HEADLESS = "opencv-contrib-python-headless"


def repack_wheel(wheel: Path, work: Path, expected: set[str]) -> Path:
    run([executable, "-m", "wheel", "unpack", "--dest", work, wheel], check=True)
    unpacked = work / wheel.name.rsplit("-", 3)[0]
    (metadata,) = unpacked.glob("*.dist-info/METADATA")
    headers, separator, description = metadata.read_text(encoding="utf-8").partition("\n\n")
    kept = []
    replaced = set()
    for header in headers.splitlines():
        if header.startswith("Requires-Dist: "):
            dependency = Requirement(header.removeprefix("Requires-Dist: "))
            name = canonicalize_name(dependency.name)
            if name.startswith("opencv-"):
                replaced.add(name)
                continue
        kept.append(header)

    if replaced != expected:
        raise ValueError(f"Unexpected OpenCV dependencies in {wheel.name}: {sorted(replaced)}")
    kept.append(f"Requires-Dist: {HEADLESS}")
    metadata.write_text("\n".join(kept) + separator + description, encoding="utf-8")

    destination = work / wheel.stem
    destination.mkdir()
    run([executable, "-m", "wheel", "pack", "--dest-dir", destination, unpacked], check=True)
    (patched,) = destination.glob("*.whl")
    return patched


def main() -> None:
    pip_environment = dict(environ)
    # Wheel tooling can live on PYTHONPATH during a container build. Install
    # runtime dependencies into the actual environment even if tools share them.
    pip_environment.pop("PYTHONPATH", None)
    with TemporaryDirectory() as temporary:
        work = Path(temporary)
        run([
            executable, "-m", "pip", "download", "--no-deps", "--only-binary=:all:",
            "--dest", work, *WHEELS,
        ], check=True)
        patched = []
        for pin, expected in WHEELS.items():
            name, version = pin.split("==")
            (wheel,) = work.glob(f"{name.replace('-', '_')}-{version}-*.whl")
            patched.append(repack_wheel(wheel, work, expected))

        requirements = Path(__file__).with_name("requirements-runtime.txt")
        run(
            [executable, "-m", "pip", "install", "--no-compile", "-r", requirements, *patched],
            check=True,
            env=pip_environment,
        )

    installed = {canonicalize_name(dist.metadata["Name"]) for dist in distributions()}
    opencv = {name for name in installed if name.startswith("opencv-")}
    if opencv != {HEADLESS}:
        raise ValueError(f"Expected only {HEADLESS}, found {sorted(opencv)}")


if __name__ == "__main__":
    main()
