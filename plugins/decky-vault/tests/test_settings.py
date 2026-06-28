"""Tests for settings persistence in the Python backend."""
import json
import os
import sys
import tempfile
import pytest

# We test the settings logic directly, not through the Plugin class,
# so we can run tests without the decky module.

def write_settings(settings_path, settings):
    """Write settings JSON to the given path."""
    os.makedirs(os.path.dirname(settings_path), exist_ok=True)
    with open(settings_path, 'w') as f:
        json.dump(settings, f, indent=2)

def read_settings(settings_path):
    """Read settings JSON from the given path, return empty dict if missing."""
    if os.path.exists(settings_path):
        with open(settings_path, 'r') as f:
            return json.load(f)
    return {}

def test_read_settings_returns_empty_when_file_missing():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "settings.json")
        assert read_settings(path) == {}

def test_write_then_read_settings():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "subdir", "settings.json")
        write_settings(path, {"apiKey": "dv_test123", "exportPath": "/home/deck/Downloads"})
        result = read_settings(path)
        assert result["apiKey"] == "dv_test123"
        assert result["exportPath"] == "/home/deck/Downloads"

def test_write_settings_creates_directory():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "newdir", "settings.json")
        write_settings(path, {"key": "value"})
        assert os.path.exists(path)

def test_read_settings_handles_corrupt_json():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "settings.json")
        with open(path, 'w') as f:
            f.write("{invalid json")
        with pytest.raises(json.JSONDecodeError):
            read_settings(path)