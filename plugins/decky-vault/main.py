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
    cpu_power_col = None

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
                if 'cpu_power' in columns:
                    cpu_power_col = columns.index('cpu_power')
                header_idx = i
                break

    if header_idx is None:
        return {"error": "Could not find FPS column in log header"}

    fps_values = []
    frametime_values = []
    gpu_power_values = []
    cpu_power_values = []

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
            if cpu_power_col is not None and cpu_power_col < len(parts):
                cpu_power_values.append(float(parts[cpu_power_col]))
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
    total_power_values = []
    if gpu_power_values and cpu_power_values:
        # Sum GPU and CPU power for total APU power
        for gp, cp in zip(gpu_power_values, cpu_power_values):
            total_power_values.append(gp + cp)
    elif gpu_power_values:
        total_power_values = gpu_power_values
    elif cpu_power_values:
        total_power_values = cpu_power_values
    if total_power_values:
        # MangoHud's cpu_power + gpu_power is the APU draw only. Add a fixed
        # overhead for the Steam Deck's screen, fan, speakers, and other
        # peripherals to get a closer estimate of total system power draw.
        SYSTEM_OVERHEAD_W = 3.0
        tdp_watts = round(
            sum(total_power_values) / len(total_power_values) + SYSTEM_OVERHEAD_W,
            1,
        )

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
        """RPC: Check if MangoHud is installed."""
        import os
        import re
        try:
            path = "/usr/bin/mangohud"
            exists = os.path.exists(path)
            if not exists:
                return {"installed": False, "path": "", "version": ""}

            # Read version from the shell script itself
            version = ""
            try:
                with open(path, 'r') as f:
                    content = f.read()
                # Look for the version line: echo v0.8.3-rc1-24-g33c2c7dd+
                m = re.search(r'echo\s+(v?[\d.]+[^\s]*)', content)
                if m:
                    version = m.group(1)
                    if "-" in version:
                        version = version.split("-")[0]
            except:
                pass

            return {"installed": True, "path": path, "version": version}
        except Exception as e:
            return {"installed": False, "path": "", "version": "", "error": str(e)}

    async def write_mangohud_config(self) -> dict:
        """RPC: Write the MangoHud logging config and a wrapper script."""
        try:
            home = os.path.expanduser("~")
            config_dir = os.path.join(home, ".config", "MangoHud")
            config_path = os.path.join(config_dir, "MangoHud.conf")
            os.makedirs(config_dir, exist_ok=True)

            config_content = """\
# DeckyVault MangoHud logging config
output_folder=/tmp
control=mangohud
autostart_log=1
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

            # Write a wrapper script that forces MangoHud to use our config
            wrapper_path = os.path.join(home, "deckyvault-mangohud.sh")
            wrapper_content = """\
#!/bin/bash
export MANGOHUD_CONFIGFILE="$HOME/.config/MangoHud/MangoHud.conf"
exec mangohud "$@"
"""
            with open(wrapper_path, 'w') as f:
                f.write(wrapper_content)
            os.chmod(wrapper_path, 0o755)

            return {"success": True, "path": config_path, "wrapper": wrapper_path}
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

    async def start_mangohud_logging(self) -> dict:
        """RPC: Start MangoHud logging via mangohudctl."""
        import subprocess
        try:
            result = subprocess.run(
                ["mangohudctl", "set", "log_session", "true"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                return {"success": True}
            else:
                return {"success": False, "error": result.stderr.strip() or "mangohudctl failed"}
        except FileNotFoundError:
            return {"success": False, "error": "mangohudctl not found. Is MangoHud running?"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def start_mangohud_logging(self) -> dict:
        """RPC: Start MangoHud logging via mangohudctl.
        Retries a few times in case MangoHud hasn't started yet."""
        import subprocess
        import time
        for attempt in range(5):
            try:
                result = subprocess.run(
                    ["mangohudctl", "set", "log_session", "true"],
                    capture_output=True, text=True, timeout=2
                )
                if result.returncode == 0:
                    return {"success": True}
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass
            if attempt < 4:
                await asyncio.sleep(2)
        return {"success": False, "error": "Could not connect to MangoHud. Is the game running?"}

    async def stop_mangohud_logging(self) -> dict:
        """RPC: Stop MangoHud logging via mangohudctl. Best-effort."""
        import subprocess
        try:
            result = subprocess.run(
                ["mangohudctl", "set", "log_session", "false"],
                capture_output=True, text=True, timeout=2
            )
            if result.returncode == 0:
                return {"success": True}
            return {"success": False, "error": result.stderr.strip() or "mangohudctl failed"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _find_mangohud_log(self) -> str | None:
        """Find the most recent MangoHud log file in /tmp/."""
        import glob
        import time
        candidates = []
        now = time.time()
        for pattern in ["/tmp/*MangoHud*", "/tmp/*.csv", "/tmp/*.log"]:
            for f in glob.glob(pattern):
                if os.path.isdir(f):
                    continue
                # Only consider files modified in the last hour
                try:
                    mtime = os.path.getmtime(f)
                    if now - mtime > 3600:
                        continue
                except:
                    pass
                # Check if it looks like a MangoHud log
                try:
                    with open(f, 'r') as fh:
                        first_lines = "".join(fh.readline() for _ in range(5))
                        if 'fps' in first_lines.lower() or 'MangoHud' in first_lines:
                            candidates.append(f)
                except:
                    candidates.append(f)  # Add anyway if we can't read it
        if not candidates:
            return None
        candidates.sort(key=lambda f: os.path.getmtime(f), reverse=True)
        return candidates[0]

    async def debug_list_tmp(self) -> dict:
        """RPC: List all files in /tmp/ for debugging."""
        import glob
        files = []
        for f in glob.glob("/tmp/*"):
            if os.path.isfile(f):
                try:
                    mtime = os.path.getmtime(f)
                    size = os.path.getsize(f)
                    files.append({"name": os.path.basename(f), "size": size, "mtime": mtime})
                except:
                    pass
        files.sort(key=lambda x: x["mtime"], reverse=True)
        return {"files": files[:30]}

    async def read_and_parse_mangohud_log(self, log_path: str | None = None) -> dict:
        """RPC: Read the MangoHud log file and return parsed FPS stats.
        If no log_path given, searches /tmp/ for the most recent MangoHud log.
        Returns parsed stats dict or {error: str}."""
        if log_path is None:
            log_path = await self._find_mangohud_log()
            if log_path is None:
                return {"error": "No MangoHud log found in /tmp/. Make sure MangoHud is enabled and logging."}
        if not os.path.exists(log_path):
            return {"error": f"MangoHud log not found at {log_path}."}
        try:
            with open(log_path, 'r') as f:
                content = f.read()
            if not content.strip():
                return {"error": "MangoHud log is empty. Recording may have been too short."}
            return parse_mangohud_log(content)
        except Exception as e:
            return {"error": f"Failed to read log: {str(e)}"}

    async def clear_mangohud_log(self) -> dict:
        """RPC: Delete all MangoHud log files in /tmp/ so the next recording starts fresh."""
        import glob
        try:
            for pattern in ["/tmp/*MangoHud*", "/tmp/*.csv", "/tmp/*.log"]:
                for f in glob.glob(pattern):
                    if os.path.isfile(f):
                        try:
                            os.remove(f)
                        except (IOError, PermissionError):
                            pass
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
        """RPC: Read OS version from /etc/os-release.
        SteamOS only puts 'SteamOS' in PRETTY_NAME, so we build a more
        useful string from VERSION_ID (and BUILD_ID) instead."""
        try:
            pretty = ""
            version_id = ""
            build_id = ""
            with open("/etc/os-release", 'r') as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        pretty = line.split("=", 1)[1].strip().strip('"')
                    elif line.startswith("VERSION_ID="):
                        version_id = line.split("=", 1)[1].strip().strip('"')
                    elif line.startswith("BUILD_ID="):
                        build_id = line.split("=", 1)[1].strip().strip('"')
            # For SteamOS, combine name + version id for a meaningful label
            if version_id:
                name = "SteamOS" if (pretty == "SteamOS" or not pretty) else pretty
                label = f"{name} {version_id}".strip()
                if build_id:
                    label += f" (build {build_id})"
                return label
            return pretty or "unknown"
        except (IOError, FileNotFoundError):
            return "unknown"

    async def get_proton_version(self, app_id: int) -> str:
        """RPC: Read the Proton version for a Steam app from config_info."""
        try:
            home = os.path.expanduser("~")
            config_path = os.path.join(home, ".steam", "steam", "steamapps", "compatdata", str(app_id), "config_info")
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    lines = f.readlines()
                if len(lines) >= 2:
                    proton_path = lines[1].strip()
                    import re
                    m = re.search(r'Proton[\s]+([\d.]+)', proton_path)
                    if m:
                        return m.group(1)
                    return proton_path.split("/")[-1] if proton_path else ""
            return ""
        except (IOError, FileNotFoundError):
            return ""

    async def detect_current_game(self) -> dict:
        """RPC: Detect the currently running game by checking processes.
        Returns {appId: int?, name: str}."""
        import subprocess
        import re

        home = os.path.expanduser("~")
        steam_path = os.path.join(home, ".steam", "steam")
        compat_dir = os.path.join(steam_path, "steamapps", "compatdata")

        # Get all running PIDs and their cmdlines
        try:
            r = subprocess.run(
                ["ps", "-eo", "pid,args", "--no-headers"],
                capture_output=True, text=True, timeout=3
            )
            if r.returncode != 0:
                return {"appId": None, "name": ""}
            all_procs = r.stdout
        except:
            return {"appId": None, "name": ""}

        # Check each compatdata directory for running processes
        if os.path.exists(compat_dir):
            for app_id_str in sorted(os.listdir(compat_dir), reverse=True):
                if not app_id_str.isdigit():
                    continue
                # Check if this app has a running process by searching for the app ID
                # in the process tree (Steam runtime includes app ID in some form)
                try:
                    r = subprocess.run(
                        ["pgrep", "-f", app_id_str],
                        capture_output=True, timeout=2
                    )
                    if r.returncode == 0:
                        # Found a running game! Get its proper name from appmanifest
                        manifest_path = os.path.join(steam_path, "steamapps", f"appmanifest_{app_id_str}.acf")
                        if os.path.exists(manifest_path):
                            with open(manifest_path, 'r') as f:
                                content = f.read()
                            m = re.search(r'"name"\s+"([^"]+)"', content)
                            if m:
                                return {"appId": int(app_id_str), "name": m.group(1)}
                        return {"appId": int(app_id_str), "name": f"App {app_id_str}"}
                except:
                    continue

        # Fallback: extract name from .exe path
        for line in all_procs.split('\n'):
            if '.exe' in line.lower() and 'proton' in line.lower():
                m = re.search(r'/([^/]+)\.exe', line, re.IGNORECASE)
                if m:
                    return {"appId": None, "name": m.group(1)}

        return {"appId": None, "name": ""}

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
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:136.0) Gecko/20100101 Firefox/136.0",
                    "Accept": "application/json",
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

    async def list_screenshots(self, limit: int = 12) -> dict:
        """RPC: List recent Steam Deck screenshots from ~/Pictures/Screenshots/.
        Returns {screenshots: [{path, name, mtime, size}], error?}.
        Steam saves timestamped JPGs in a 'Steam Client' subfolder and keeps
        a 'most_recent.jpg' symlink-like copy at the top level."""
        import glob
        import time
        try:
            home = os.path.expanduser("~")
            base = os.path.join(home, "Pictures", "Screenshots")
            patterns = [
                os.path.join(base, "*.jpg"),
                os.path.join(base, "*.png"),
                os.path.join(base, "Steam Client", "*.jpg"),
                os.path.join(base, "Steam Client", "*.png"),
            ]
            seen = set()
            files = []
            for pat in patterns:
                for f in glob.glob(pat):
                    if not os.path.isfile(f) or f in seen:
                        continue
                    # Skip the most_recent.jpg duplicate if a real timestamped
                    # copy exists — it's just a pointer to the latest one.
                    if os.path.basename(f) == "most_recent.jpg":
                        continue
                    seen.add(f)
                    try:
                        files.append({
                            "path": f,
                            "name": os.path.basename(f),
                            "mtime": os.path.getmtime(f),
                            "size": os.path.getsize(f),
                        })
                    except OSError:
                        continue
            files.sort(key=lambda x: x["mtime"], reverse=True)
            return {"screenshots": files[:limit]}
        except Exception as e:
            return {"screenshots": [], "error": str(e)}

    async def upload_screenshots(self, entry_id: str, screenshot_paths: list, api_key: str, base_url: str = "https://deckyvault.xyz") -> dict:
        """RPC: Upload up to 2 screenshots to a performance entry as multipart/form-data.
        Returns {success: bool, uploaded: int, error?: str, status?: int}.
        The server enforces the 2-screenshot limit per entry."""
        import urllib.request
        import urllib.error
        import uuid

        # Hard cap at 2 — matches the website limit
        paths = [p for p in screenshot_paths if p][:2]
        if not paths:
            return {"success": False, "error": "No screenshots selected"}

        try:
            url = f"{base_url}/api/performance/{entry_id}/screenshots"

            # Build a multipart/form-data body manually (urllib has no helper)
            boundary = "----DeckyVaultBoundary" + uuid.uuid4().hex
            encoded = b""
            valid_paths = []
            for p in paths:
                if not os.path.exists(p):
                    continue
                valid_paths.append(p)
                with open(p, "rb") as fh:
                    file_bytes = fh.read()
                fname = os.path.basename(p)
                ext = os.path.splitext(fname)[1].lower()
                mime = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else "image/jpeg")
                encoded += (
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="screenshots"; filename="{fname}"\r\n'
                    f"Content-Type: {mime}\r\n\r\n"
                ).encode("utf-8")
                encoded += file_bytes
                encoded += b"\r\n"
            encoded += f"--{boundary}--\r\n".encode("utf-8")

            if not valid_paths:
                return {"success": False, "error": "No readable screenshot files"}

            req = urllib.request.Request(
                url,
                data=encoded,
                headers={
                    "Content-Type": f"multipart/form-data; boundary={boundary}",
                    "x-api-key": api_key,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:136.0) Gecko/20100101 Firefox/136.0",
                    "Accept": "application/json",
                },
                method="POST",
            )
            context = _get_ssl_context()
            with urllib.request.urlopen(req, timeout=30, context=context) as response:
                result = json.loads(response.read().decode("utf-8"))
                uploaded = len(result.get("data", [])) if isinstance(result.get("data"), list) else 0
                return {"success": True, "uploaded": uploaded}
        except urllib.error.HTTPError as e:
            try:
                err = json.loads(e.read().decode("utf-8"))
                return {"success": False, "error": err.get("error", f"Server returned status {e.code}"), "status": e.code}
            except Exception:
                return {"success": False, "error": f"Server returned status {e.code}", "status": e.code}
        except urllib.error.URLError as e:
            return {"success": False, "error": f"Network error: {str(e.reason)}", "status": 0}
        except Exception as e:
            return {"success": False, "error": str(e), "status": 0}

    async def test_api_key(self, api_key: str, base_url: str = "https://deckyvault.xyz") -> dict:
        """RPC: Test if an API key is valid by calling the dedicated verify endpoint.
        Returns {valid: bool, error: str?, userName?: str, userImage?: str}."""
        import urllib.request
        import urllib.error

        if not api_key:
            return {"valid": False, "error": "No API key provided"}

        try:
            url = f"{base_url}/api/plugin/verify-key"
            req = urllib.request.Request(
                url,
                headers={
                    "x-api-key": api_key,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:136.0) Gecko/20100101 Firefox/136.0",
                    "Accept": "application/json",
                },
                method="GET"
            )
            context = _get_ssl_context()
            with urllib.request.urlopen(req, timeout=10, context=context) as response:
                result = json.loads(response.read().decode('utf-8'))
                return {
                    "valid": True,
                    "userName": result.get("user", {}).get("name"),
                    "userImage": result.get("user", {}).get("image"),
                }
        except urllib.error.HTTPError as e:
            if e.code == 401:
                return {"valid": False, "error": "Invalid or revoked API key"}
            try:
                err = json.loads(e.read().decode('utf-8'))
                return {"valid": False, "error": err.get("error", f"Server returned status {e.code}")}
            except Exception:
                return {"valid": False, "error": f"Server returned status {e.code}"}
        except urllib.error.URLError as e:
            return {"valid": False, "error": f"Network error: {str(e.reason)}"}
        except Exception as e:
            return {"valid": False, "error": str(e)}

    async def export_config(self, settings: dict) -> dict:
        """RPC: Export current settings to Downloads/deckyvault-config.json.
        Returns {success: bool, path?: str, error?: str}."""
        try:
            home = os.path.expanduser("~")
            config_path = os.path.join(home, "Downloads", "deckyvault-config.json")
            with open(config_path, 'w') as f:
                json.dump(settings, f, indent=2)
            return {"success": True, "path": config_path}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def import_config(self) -> dict:
        """RPC: Import settings from the latest deckyvault-config.json in Downloads.
        Returns {success: bool, settings?: dict, error?: str}."""
        try:
            home = os.path.expanduser("~")
            config_path = os.path.join(home, "Downloads", "deckyvault-config.json")
            if not os.path.exists(config_path):
                return {"success": False, "error": "No deckyvault-config.json found in Downloads"}
            with open(config_path, 'r') as f:
                settings = json.load(f)
            return {
                "success": True,
                "settings": {
                    "apiKey": settings.get("apiKey", ""),
                    "exportPath": settings.get("exportPath", "/home/deck/Downloads"),
                    "baseUrl": settings.get("baseUrl", "https://deckyvault.xyz"),
                    "hardwareSlug": settings.get("hardwareSlug", None),
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def initiate_pair(self, base_url: str = "https://deckyvault.xyz") -> dict:
        """RPC: Start a plugin pairing session. Returns {success, token, qrUrl, expiresAt, error?}.
        The qrUrl should be shown as a QR code in the plugin UI."""
        import urllib.request
        import urllib.error
        try:
            url = f"{base_url}/api/plugin/pair/initiate"
            req = urllib.request.Request(
                url,
                data=b"{}",
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:136.0) Gecko/20100101 Firefox/136.0",
                    "Accept": "application/json",
                },
                method="POST"
            )
            context = _get_ssl_context()
            with urllib.request.urlopen(req, timeout=10, context=context) as response:
                result = json.loads(response.read().decode('utf-8'))
                return {
                    "success": True,
                    "token": result.get("token", ""),
                    "qrUrl": result.get("qrUrl", ""),
                    "expiresAt": result.get("expiresAt", ""),
                }
        except urllib.error.HTTPError as e:
            return {"success": False, "error": f"Server returned status {e.code}"}
        except urllib.error.URLError as e:
            return {"success": False, "error": f"Network error: {str(e.reason)}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def check_pair_status(self, token: str, base_url: str = "https://deckyvault.xyz") -> dict:
        """RPC: Poll pairing status. Returns {status: 'pending'|'confirmed'|'expired'|'invalid', apiKey?, error?}."""
        import urllib.request
        import urllib.error
        try:
            url = f"{base_url}/api/plugin/pair/status/{token}"
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:136.0) Gecko/20100101 Firefox/136.0",
                    "Accept": "application/json",
                },
                method="GET"
            )
            context = _get_ssl_context()
            with urllib.request.urlopen(req, timeout=10, context=context) as response:
                result = json.loads(response.read().decode('utf-8'))
                return {
                    "status": result.get("status", "pending"),
                    "apiKey": result.get("apiKey"),
                    "keyName": result.get("keyName"),
                }
        except urllib.error.HTTPError as e:
            try:
                err = json.loads(e.read().decode('utf-8'))
                return {"status": err.get("status", "invalid"), "error": err.get("error", f"status {e.code}")}
            except Exception:
                return {"status": "invalid", "error": f"Server returned status {e.code}"}
        except urllib.error.URLError as e:
            return {"status": "invalid", "error": f"Network error: {str(e.reason)}"}
        except Exception as e:
            return {"status": "invalid", "error": str(e)}