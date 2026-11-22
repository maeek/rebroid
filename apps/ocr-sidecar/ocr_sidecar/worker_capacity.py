import asyncio
from threading import BoundedSemaphore
from typing import TypeVar

_T = TypeVar("_T")


def wait_for_worker(worker: asyncio.Future[_T], capacity: BoundedSemaphore) -> asyncio.Future[_T]:
    """Keep the slot until the worker finishes, even when the caller is cancelled."""

    def release(done: asyncio.Future[_T]) -> None:
        capacity.release()
        if not done.cancelled():
            done.exception()

    worker.add_done_callback(release)
    return asyncio.shield(worker)
