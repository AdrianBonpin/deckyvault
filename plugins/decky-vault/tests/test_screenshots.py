"""Tests for screenshot discovery across Steam Game Mode + Desktop paths (Bug 3)."""
import os
import shutil
import sys
import tempfile
import time
import types
import pytest

from main import _collect_screenshots


def _touch(path, mtime_age=10, content=b"\xff\xd8\xff\xe0"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)
    t = time.time() - mtime_age
    os.utime(path, (t, t))


def test_discovers_all_three_locations():
    with tempfile.TemporaryDirectory() as home:
        _touch(os.path.join(home, "Pictures", "Screenshots", "desktop.jpg"), mtime_age=30)
        _touch(os.path.join(home, "Pictures", "Screenshots", "Steam Client", "sc.jpg"), mtime_age=20)
        _touch(os.path.join(home, ".local", "share", "Steam", "userdata", "111", "760",
                            "remote", "2531310", "screenshots", "game.jpg"), mtime_age=10)
        found = _collect_screenshots(home)
        names = [f["name"] for f in found]
        assert set(names) == {"desktop.jpg", "sc.jpg", "game.jpg"}
        assert found[0]["name"] == "game.jpg"


def test_app_id_filter_keeps_desktop_plus_app():
    with tempfile.TemporaryDirectory() as home:
        _touch(os.path.join(home, "Pictures", "Screenshots", "desktop.jpg"), mtime_age=30)
        _touch(os.path.join(home, ".local", "share", "Steam", "userdata", "111", "760",
                            "remote", "2531310", "screenshots", "want.jpg"), mtime_age=10)
        _touch(os.path.join(home, ".local", "share", "Steam", "userdata", "111", "760",
                            "remote", "9999", "screenshots", "other.jpg"), mtime_age=5)
        found = _collect_screenshots(home, app_id=2531310)
        names = [f["name"] for f in found]
        assert "want.jpg" in names
        assert "desktop.jpg" in names
        assert "other.jpg" not in names


def test_most_recent_duplicate_skipped():
    with tempfile.TemporaryDirectory() as home:
        _touch(os.path.join(home, "Pictures", "Screenshots", "most_recent.jpg"), mtime_age=1)
        _touch(os.path.join(home, "Pictures", "Screenshots", "2026-01-01.jpg"), mtime_age=2)
        found = _collect_screenshots(home)
        names = [f["name"] for f in found]
        assert "most_recent.jpg" not in names
        assert "2026-01-01.jpg" in names


@pytest.mark.asyncio
async def test_read_screenshot_fallback_no_pillow():
    """When Pillow is absent, >1MB files return preview-unavailable, small files return data URL."""
    # Mock the decky module so main.py imports cleanly even when the real
    # decky package (only present on the Deck) is unavailable.
    sys.modules.pop("main", None)
    if "decky" not in sys.modules:
        mock_decky = types.ModuleType("decky")
        mock_decky.logger = type(sys)("Logger")
        mock_decky.logger.info = lambda *a, **kw: None
        mock_decky.DECKY_PLUGIN_NAME = "test"
        mock_decky.DECKY_PLUGIN_SETTINGS_DIR = "/tmp/decky-test"
        sys.modules["decky"] = mock_decky

    from main import Plugin
    plugin = Plugin()

    test_dir = f"/tmp/deckyvault_test_screenshot_{os.getpid()}"
    try:
        os.makedirs(test_dir, exist_ok=True)
        small_path = os.path.join(test_dir, "small.jpg")
        with open(small_path, "wb") as f:
            f.write(b"\xff\xd8\xff\xe0" * 100)  # ~400 bytes

        large_path = os.path.join(test_dir, "large.jpg")
        with open(large_path, "wb") as f:
            f.write(b"\xff\xd8\xff\xe0" * 300000)  # ~1.2MB

        # Mock PIL ImportError by temporarily removing PIL from sys.modules
        had_pil = "PIL" in sys.modules
        if had_pil:
            pil_mod = sys.modules.pop("PIL")

        try:
            r_small = await plugin.read_screenshot(small_path, max_width=320)
            assert r_small["dataUrl"] != "", f"Expected data URL, got: {r_small}"
            assert "error" not in r_small or not r_small["error"]

            r_large = await plugin.read_screenshot(large_path, max_width=320)
            assert r_large["dataUrl"] == "", f"Expected empty dataUrl, got: {r_large}"
            assert "too large" in r_large.get("error", "")
        finally:
            if had_pil:
                sys.modules["PIL"] = pil_mod
    finally:
        shutil.rmtree(test_dir, ignore_errors=True)
        sys.modules.pop("main", None)