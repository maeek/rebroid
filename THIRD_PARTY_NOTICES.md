# Third-party notices

Rebroid source and container images depend on third-party projects whose licenses remain their own. This file records the sidecar artifacts that are downloaded or bundled directly; dependency lockfiles remain the authoritative version inventory.

## Display sidecar

- **scrcpy 4.0**, Copyright Genymobile and contributors, Apache License 2.0. The `linux-x86_64` official GitHub release archive is downloaded during the image build and verified with SHA-256 `7daf05af5d575862e62b068cf6852d6068faf7ef3178f3735e3953e778fbf0ab`. Source and license: <https://github.com/Genymobile/scrcpy>.
- **Pion WebRTC**, Copyright Pion contributors, MIT License. It is compiled from the versions recorded in `apps/display-sidecar/webrtc-bridge/go.sum`. Source and license: <https://github.com/pion/webrtc>.
- **Android Debug Bridge**, distributed in the Debian `adb` package and subject to the Android Open Source Project licenses. Source: <https://android.googlesource.com/platform/packages/modules/adb/>.

## OCR sidecar

- **PaddleOCR** and **PaddlePaddle**, Copyright PaddlePaddle Authors, Apache License 2.0. Python runtime versions are pinned in `apps/ocr-sidecar/requirements-runtime.txt`. Source and license: <https://github.com/PaddlePaddle/PaddleOCR> and <https://github.com/PaddlePaddle/Paddle>.
- Pillow, NumPy, FastAPI, Uvicorn, and their transitive dependencies are installed from the pinned requirements files and retain their respective licenses.

Before public distribution, generate a complete dependency-license report, review model-file provenance for the selected OCR language, and confirm compatibility with the repository license once that license is chosen.
