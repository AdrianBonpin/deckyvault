"""Tests for safe MangoHud log clearing (Bug 1 fix)."""
import os
import tempfile
import time
import pytest


def _touch(path, mtime_age=10):
    """Create a file at path, optionally backdated mtime by mtime_age seconds."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write("data")
    if mtime_age > 0:
        t = time.time() - mtime_age
        os.utime(path, (t, t))


def _safe_clear_mangohud_logs(tmpdir, now=None, recent_window_s=3):
    """Mirror of Plugin.clear_mangohud_log safe logic, operating on tmpdir."""
    import glob
    if now is None:
        now = time.time()
    deleted, skipped = [], []
    patterns = [
        os.path.join(tmpdir, "*MangoHud*"),
    ]
    for pat in patterns:
        for f in glob.glob(pat):
            if not os.path.isfile(f):
                continue
            try:
                if now - os.path.getmtime(f) < recent_window_s:
                    skipped.append({"name": os.path.basename(f), "reason": "active"})
                    continue
                os.remove(f)
                deleted.append({"name": os.path.basename(f)})
            except (IOError, PermissionError):
                skipped.append({"name": os.path.basename(f), "reason": "perm"})
    return {"success": True, "deleted": deleted, "skipped": skipped}


def test_only_mangohud_files_removed():
    with tempfile.TemporaryDirectory() as tmp:
        _touch(os.path.join(tmp, "MangoHud-1.csv"), mtime_age=10)
        _touch(os.path.join(tmp, "system.log"), mtime_age=10)       # MUST be untouched
        _touch(os.path.join(tmp, "other.csv"), mtime_age=10)        # MUST be untouched
        res = _safe_clear_mangohud_logs(tmp)
        assert res["success"] is True
        names = [d["name"] for d in res["deleted"]]
        assert "MangoHud-1.csv" in names
        assert "system.log" not in names and "other.csv" not in names
        assert os.path.exists(os.path.join(tmp, "system.log"))
        assert os.path.exists(os.path.join(tmp, "other.csv"))


def test_active_recent_file_skipped():
    with tempfile.TemporaryDirectory() as tmp:
        _touch(os.path.join(tmp, "MangoHud-active.csv"), mtime_age=0)
        res = _safe_clear_mangohud_logs(tmp)
        assert res["deleted"] == []
        assert any(s["name"] == "MangoHud-active.csv" for s in res["skipped"])
        assert os.path.exists(os.path.join(tmp, "MangoHud-active.csv"))


def _validate_log_path(path, tmpdir):
    """Mirror of Plugin.delete_log_file path validation."""
    if not path:
        return False
    abs_path = os.path.abspath(path)
    if not abs_path.startswith(os.path.abspath(tmpdir) + os.sep):
        return False
    base = os.path.basename(abs_path)
    if "MangoHud" not in base:
        return False
    return True


def test_delete_log_file_rejects_outside_tmp():
    with tempfile.TemporaryDirectory() as tmp:
        assert _validate_log_path("/etc/passwd", tmp) is False
        assert _validate_log_path(os.path.expanduser("~/x.log"), tmp) is False


def test_delete_log_file_rejects_non_mangohud():
    with tempfile.TemporaryDirectory() as tmp:
        assert _validate_log_path(os.path.join(tmp, "system.log"), tmp) is False
        assert _validate_log_path(os.path.join(tmp, "MangoHud-1.csv"), tmp) is True