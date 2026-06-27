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

    async def check_mangohud(self) -> dict:
        """RPC: Check if MangoHud is installed. Returns {installed: bool, path: str, version: str}."""
        import subprocess
        try:
            result = subprocess.run(
                ["which", "mangohud"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                mangohud_path = result.stdout.strip()
                # Get version
                version_result = subprocess.run(
                    ["mangohud", "--version"],
                    capture_output=True, text=True, timeout=5
                )
                version = version_result.stdout.strip() if version_result.returncode == 0 else "unknown"
                return {"installed": True, "path": mangohud_path, "version": version}
            else:
                return {"installed": False, "path": "", "version": ""}
        except Exception as e:
            return {"installed": False, "path": "", "version": "", "error": str(e)}

    async def write_mangohud_config(self) -> dict:
        """RPC: Write the MangoHud logging config to ~/.config/MangoHud/MangoHud.conf.
        Returns {success: bool, path: str, error: str?}."""
        try:
            home = os.path.expanduser("~")
            config_dir = os.path.join(home, ".config", "MangoHud")
            config_path = os.path.join(config_dir, "MangoHud.conf")
            os.makedirs(config_dir, exist_ok=True)

            # MangoHud config that enables logging with the metrics we need.
            # output_folder is required for logging to work.
            # We log to /tmp so the plugin can read it after the session.
            config_content = """\
# DeckyVault MangoHud logging config
output_folder=/tmp
output_file=deckyvault-mangohud.log
log_duration=0
fps
frame_timing
cpu_power
gpu_power
cpu_temp
gpu_temp
benchmark_percentiles=97,AVG,1,0.1
"""
            with open(config_path, 'w') as f:
                f.write(config_content)

            return {"success": True, "path": config_path}
        except Exception as e:
            return {"success": False, "path": "", "error": str(e)}

    async def get_mangohud_config(self) -> dict:
        """RPC: Read the current MangoHud config. Returns {exists: bool, content: str, path: str}."""
        home = os.path.expanduser("~")
        config_path = os.path.join(home, ".config", "MangoHud", "MangoHud.conf")
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return {"exists": True, "content": f.read(), "path": config_path}
        return {"exists": False, "content": "", "path": config_path}