import asyncio
import json
import os
import ssl

def _get_ssl_context():
    """Create an SSL context, trying verification first, falling back to unverified.
    This handles systems where the CA bundle is missing or outdated (e.g., Steam Deck)."""
    try:
        ctx = ssl.create_default_context()
        # Test that the context can actually verify by checking it has CAs
        if ctx.get_ca_certs():
            return ctx
    except Exception:
        pass
    # Fall back to unverified if default context fails
    return ssl._create_unverified_context()

try:
    import decky
except ImportError:
    # Allow running tests without the decky module (tests mock the path)
    decky = None


def parse_mangohud_log(log_content: str) -> dict:
    """Parse a MangoHud log file's content and return FPS stats.

    Returns: {fpsAvg, fpsLow, fpsHigh, fpsOnePercentLow, tdpWatts, error?}
    """
    lines = log_content.strip().split('\n')

    header_idx = None
    fps_col = 0
    frametime_col = None
    gpu_power_col = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        if 'fps' in stripped.lower() and ',' in stripped:
            columns = [c.strip().lower() for c in stripped.split(',')]
            if 'fps' in columns:
                fps_col = columns.index('fps')
                if 'frametime' in columns:
                    frametime_col = columns.index('frametime')
                if 'gpu_power' in columns:
                    gpu_power_col = columns.index('gpu_power')
                header_idx = i
                break

    if header_idx is None:
        return {"error": "Could not find FPS column in log header"}

    fps_values = []
    frametime_values = []
    gpu_power_values = []

    for line in lines[header_idx + 1:]:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        if stripped.startswith(('97%', 'AVG', '1%', '0.1%', '5%')):
            continue
        parts = [p.strip() for p in stripped.split(',')]
        try:
            fps = float(parts[fps_col])
            fps_values.append(fps)
            if frametime_col is not None and frametime_col < len(parts):
                frametime_values.append(float(parts[frametime_col]))
            if gpu_power_col is not None and gpu_power_col < len(parts):
                gpu_power_values.append(float(parts[gpu_power_col]))
        except (ValueError, IndexError):
            continue

    if not fps_values:
        return {"error": "No FPS data found in log"}

    fps_avg = round(sum(fps_values) / len(fps_values), 1)
    fps_low = round(min(fps_values), 1)
    fps_high = round(max(fps_values), 1)

    # 1% low: average the slowest 1% of frame times (largest frametimes),
    # then convert to FPS. Falls back to the lowest FPS percentile if no
    # frametime data is available.
    if frametime_values:
        sorted_ft = sorted(frametime_values)
        one_percent_count = max(1, int(len(sorted_ft) * 0.01))
        worst_ft = sorted_ft[-one_percent_count:]
        avg_worst_ft = sum(worst_ft) / len(worst_ft)
        fps_one_percent_low = round(1000.0 / avg_worst_ft, 1) if avg_worst_ft > 0 else None
    else:
        sorted_fps = sorted(fps_values)
        one_percent_idx = max(0, int(len(sorted_fps) * 0.01))
        fps_one_percent_low = round(sorted_fps[one_percent_idx], 1)

    tdp_watts = None
    if gpu_power_values:
        tdp_watts = round(sum(gpu_power_values) / len(gpu_power_values), 1)

    return {
        "fpsAvg": fps_avg,
        "fpsLow": fps_low,
        "fpsHigh": fps_high,
        "fpsOnePercentLow": fps_one_percent_low,
        "tdpWatts": tdp_watts,
    }


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

    async def read_and_parse_mangohud_log(self, log_path: str = "/tmp/deckyvault-mangohud.log") -> dict:
        """RPC: Read the MangoHud log file and return parsed FPS stats.
        Returns parsed stats dict or {error: str}."""
        if not os.path.exists(log_path):
            return {"error": f"MangoHud log not found at {log_path}. Make sure MangoHud is enabled and logging."}
        try:
            with open(log_path, 'r') as f:
                content = f.read()
            if not content.strip():
                return {"error": "MangoHud log is empty. Recording may have been too short."}
            return parse_mangohud_log(content)
        except Exception as e:
            return {"error": f"Failed to read log: {str(e)}"}

    async def clear_mangohud_log(self, log_path: str = "/tmp/deckyvault-mangohud.log") -> dict:
        """RPC: Delete the MangoHud log file so the next recording starts fresh."""
        try:
            if os.path.exists(log_path):
                os.remove(log_path)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_hardware_info(self) -> dict:
        """RPC: Detect hardware model from DMI. Returns {slug, name, raw}."""
        # Steam Deck models: Jupiter = LCD, Galileo = OLED
        product_name = ""
        try:
            with open("/sys/class/dmi/id/product_name", 'r') as f:
                product_name = f.read().strip()
        except (IOError, FileNotFoundError):
            pass

        slug = "unknown"
        name = "Unknown Device"

        if product_name == "Jupiter":
            slug = "steamdeck-lcd"
            name = "Steam Deck LCD"
        elif product_name == "Galileo":
            slug = "steamdeck-oled"
            name = "Steam Deck OLED"
        elif product_name:
            name = product_name
            slug = product_name.lower().replace(" ", "-")

        return {"slug": slug, "name": name, "raw": product_name}

    async def get_os_version(self) -> str:
        """RPC: Read OS version from /etc/os-release."""
        try:
            with open("/etc/os-release", 'r') as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        return line.split("=", 1)[1].strip().strip('"')
            return "unknown"
        except (IOError, FileNotFoundError):
            return "unknown"

    async def get_proton_version(self, app_id: int) -> str:
        """RPC: Attempt to read the Proton version for a Steam app.
        Reads from the Steam compatdata directory."""
        try:
            home = os.path.expanduser("~")
            # Steam compat data lives in ~/.steam/steam/steamapps/compatdata/<appid>/
            compat_path = os.path.join(home, ".steam", "steam", "steamapps", "compatdata", str(app_id))
            version_file = os.path.join(compat_path, "version")
            if os.path.exists(version_file):
                with open(version_file, 'r') as f:
                    return f.read().strip()
            return ""
        except (IOError, FileNotFoundError):
            return ""

    async def get_launch_options(self, app_id: int) -> str:
        """RPC: Read launch options for a Steam app from localconfig.vdf.
        This is best-effort — the VDF format is not officially documented."""
        try:
            home = os.path.expanduser("~")
            # localconfig.vdf path varies; try common locations
            config_paths = [
                os.path.join(home, ".steam", "steam", "usercfg", "localconfig.vdf"),
                os.path.join(home, ".local", "share", "Steam", "usercfg", "localconfig.vdf"),
            ]
            for config_path in config_paths:
                if os.path.exists(config_path):
                    with open(config_path, 'r') as f:
                        content = f.read()
                    # Best-effort: look for LaunchOptions near the app ID
                    # This is a simple heuristic — VDF parsing is complex
                    app_str = f'"{app_id}"'
                    idx = content.find(app_str)
                    if idx != -1:
                        # Search for LaunchOptions within ~2000 chars after app ID
                        search_region = content[idx:idx + 2000]
                        lo_idx = search_region.find('"LaunchOptions"')
                        if lo_idx != -1:
                            # Extract the value between quotes
                            value_start = search_region.find('"', lo_idx + len('"LaunchOptions"')) + 1
                            value_end = search_region.find('"', value_start)
                            if value_start > 0 and value_end > value_start:
                                return search_region[value_start:value_end]
                    return ""
            return ""
        except (IOError, FileNotFoundError):
            return ""

    async def export_to_file(self, data: dict, export_path: str) -> dict:
        """RPC: Write a DeckyVaultImportV1 payload as JSON to the given path.
        Returns {success: bool, path: str, error: str?}."""
        try:
            # Sanitize the filename — the frontend passes a full path including filename
            export_dir = os.path.dirname(export_path)
            if export_dir and not os.path.exists(export_dir):
                os.makedirs(export_dir, exist_ok=True)

            with open(export_path, 'w') as f:
                json.dump(data, f, indent=2)

            return {"success": True, "path": export_path}
        except PermissionError:
            return {"success": False, "path": "", "error": f"Permission denied writing to {export_path}"}
        except Exception as e:
            return {"success": False, "path": "", "error": str(e)}

    async def upload_to_deckyvault(self, data: dict, api_key: str, base_url: str = "https://deckyvault.xyz") -> dict:
        """RPC: Upload a DeckyVaultImportV1 payload to the DeckyVault API.
        Uses urllib to avoid external dependencies.
        Returns {success: bool, data: dict?, error: str?, status: int?}."""
        import urllib.request
        import urllib.error

        try:
            url = f"{base_url}/api/performance/import"
            payload = json.dumps(data).encode('utf-8')

            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                },
                method="POST"
            )

            context = _get_ssl_context()
            with urllib.request.urlopen(req, timeout=30, context=context) as response:
                status = response.status
                body = response.read().decode('utf-8')
                result = json.loads(body)

                if status == 201:
                    return {"success": True, "data": result, "status": status}
                else:
                    return {"success": False, "error": result.get("error", "Upload failed"), "status": status}

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            try:
                error_msg = json.loads(error_body).get("error", error_body)
            except json.JSONDecodeError:
                error_msg = error_body
            return {"success": False, "error": error_msg, "status": e.code}
        except urllib.error.URLError as e:
            return {"success": False, "error": f"Network error: {str(e.reason)}", "status": 0}
        except Exception as e:
            return {"success": False, "error": str(e), "status": 0}

    async def test_api_key(self, api_key: str, base_url: str = "https://deckyvault.xyz") -> dict:
        """RPC: Test if an API key is valid by calling the games lookup endpoint.
        Returns {valid: bool, error: str?}."""
        import urllib.request
        import urllib.error

        try:
            url = f"{base_url}/api/games/lookup?steamAppId=0"
            req = urllib.request.Request(
                url,
                headers={"x-api-key": api_key},
                method="GET"
            )
            context = _get_ssl_context()
            with urllib.request.urlopen(req, timeout=10, context=context) as response:
                # A 404 (game not found) still means the API key is valid
                return {"valid": True}
        except urllib.error.HTTPError as e:
            if e.code == 401:
                return {"valid": False, "error": "Invalid API key"}
            elif e.code == 404:
                return {"valid": True}  # Key works, just no game with ID 0
            else:
                return {"valid": False, "error": f"Server returned status {e.code}"}
        except urllib.error.URLError as e:
            return {"valid": False, "error": f"Network error: {str(e.reason)}"}
        except Exception as e:
            return {"valid": False, "error": str(e)}