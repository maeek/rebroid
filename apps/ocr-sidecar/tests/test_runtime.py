from ocr_sidecar.runtime import OcrRuntime


def test_runtime_capacity_is_bounded():
    runtime = OcrRuntime("en", 1)
    assert runtime.try_acquire() is True
    assert runtime.try_acquire() is False
    runtime.release()
    assert runtime.try_acquire() is True
    runtime.release()
