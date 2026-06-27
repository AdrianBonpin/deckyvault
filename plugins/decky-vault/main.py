import asyncio
import json
import os

try:
    import decky
except ImportError:
    # Allow running tests without the decky module (tests mock the path)
    decky = None


class Plugin:
    async def _main(self):
        if decky:
            decky.logger.info(f"DeckyVault plugin loaded: {decky.DECKY_PLUGIN_NAME}")
        self._settings_path = self._get_settings_path()
        self._settings = self._read_settings()

    async def _unload(self):
        if decky:
            decky.logger.info("DeckyVault plugin unloading")

    async def _uninstall(self):
        if decky:
            decky.logger.info("DeckyVault plugin uninstalled")

    def _get_settings_path(self):
        if decky:
            return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
        return os.path.join(os.path.expanduser("~"), ".deckyvault-test", "settings.json")

    def _read_settings(self):
        """Read settings from JSON file. Returns empty dict if file missing."""
        if os.path.exists(self._settings_path):
            try:
                with open(self._settings_path, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}

    def _write_settings(self, settings):
        """Write settings to JSON file, creating directory if needed."""
        os.makedirs(os.path.dirname(self._settings_path), exist_ok=True)
        with open(self._settings_path, 'w') as f:
            json.dump(settings, f, indent=2)

    async def get_settings(self) -> dict:
        """RPC: Return all plugin settings."""
        return self._settings

    async def set_setting(self, key: str, value) -> dict:
        """RPC: Set a single setting and persist. Returns updated settings."""
        self._settings[key] = value
        self._write_settings(self._settings)
        return self._settings