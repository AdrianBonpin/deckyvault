"""Tests for screenshot discovery across Steam Game Mode + Desktop paths (Bug 3)."""
import os
import tempfile
import time
import pytest


def _touch(path, mtime_age=10, content=b"\xff\xd8\xff\xe0"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)
    t = time.time() - mtime_age
    os.utime(path, (t, t))


def _discover(home, app_id=None):
    """Mirror of Plugin.list_screenshot discovery against a fake home dir."""
    import glob
    base = os.path.join(home, "Pictures", "Screenshots")
    userdata = os.path.join(home, ".local", "share", "Steam", "userdata")
    patterns = [
        os.path.join(base, "*.jpg"),
        os.path.join(base, "*.png"),
        os.path.join(base, "Steam Client", "*.jpg"),
        os.path.join(base, "Steam Client", "*.png"),
        os.path.join(userdata, "*", "760", "remote", "*", "screenshots", "*.jpg"),
        os.path.join(userdata, "*", "760", "remote", "*", "screenshots", "*.png"),
    ]
    seen, files = set(), []
    for pat in patterns:
        for f in glob.glob(pat):
            if not os.path.isfile(f) or f in seen:
                continue
            if os.path.basename(f) == "most_recent.jpg":
                continue
            seen.add(f)
            parts = f.split(os.sep)
            f_app_id = None
            if "760" in parts:
                idx = parts.index("760")
                if idx >= 2:
                    try:
                        f_app_id = int(parts[idx + 2])
                    except (ValueError, IndexError):
                        pass
            try:
                files.append({"path": f, "name": os.path.basename(f),
                              "mtime": os.path.getmtime(f), "size": os.path.getsize(f),
                              "appId": f_app_id})
            except OSError:
                continue
    files.sort(key=lambda x: x["mtime"], reverse=True)
    if app_id is not None:
        files = [x for x in files if x["appId"] is None or x["appId"] == app_id]
    return files


def test_discovers_all_three_locations():
    with tempfile.TemporaryDirectory() as home:
        _touch(os.path.join(home, "Pictures", "Screenshots", "desktop.jpg"), mtime_age=30)
        _touch(os.path.join(home, "Pictures", "Screenshots", "Steam Client", "sc.jpg"), mtime_age=20)
        _touch(os.path.join(home, ".local", "share", "Steam", "userdata", "111", "760",
                            "remote", "2531310", "screenshots", "game.jpg"), mtime_age=10)
        found = _discover(home)
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
        found = _discover(home, app_id=2531310)
        names = [f["name"] for f in found]
        assert "want.jpg" in names
        assert "desktop.jpg" in names
        assert "other.jpg" not in names


def test_most_recent_duplicate_skipped():
    with tempfile.TemporaryDirectory() as home:
        _touch(os.path.join(home, "Pictures", "Screenshots", "most_recent.jpg"), mtime_age=1)
        _touch(os.path.join(home, "Pictures", "Screenshots", "2026-01-01.jpg"), mtime_age=2)
        found = _discover(home)
        names = [f["name"] for f in found]
        assert "most_recent.jpg" not in names
        assert "2026-01-01.jpg" in names