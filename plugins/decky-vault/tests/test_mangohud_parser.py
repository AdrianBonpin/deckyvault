"""Tests for MangoHud log parsing."""
import os

# Parser functions — these will be imported from main.py once implemented.
# For now we define them here to test the logic, then move to main.py.

def parse_mangohud_log(log_content: str) -> dict:
    """Parse a MangoHud log file's content and return FPS stats.

    Returns: {fpsAvg, fpsLow, fpsHigh, fpsOnePercentLow, tdpWatts, error?}
    """
    lines = log_content.strip().split('\n')

    # Find the header row (first non-comment, non-empty line that looks like column names)
    header_idx = None
    fps_col = 0
    frametime_col = None
    gpu_power_col = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        # Check if this is a header (contains 'fps')
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

    # Extract data rows (lines after header that start with a number)
    fps_values = []
    frametime_values = []
    gpu_power_values = []

    for line in lines[header_idx + 1:]:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        # Check if it's a summary line (e.g. "97%,\t62" or "AVG,\t60")
        if stripped.startswith(('97%', 'AVG', '1%', '0.1%', '5%')):
            continue
        parts = [p.strip() for p in stripped.split(',')]
        try:
            fps = float(parts[fps_col])
            fps_values.append(fps)
            if frametime_col is not None and frametime_col < len(parts):
                ft = float(parts[frametime_col])
                frametime_values.append(ft)
            if gpu_power_col is not None and gpu_power_col < len(parts):
                gp = float(parts[gpu_power_col])
                gpu_power_values.append(gp)
        except (ValueError, IndexError):
            continue

    if not fps_values:
        return {"error": "No FPS data found in log"}

    # Compute stats
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
        # Fall back: sort FPS values, take 1st percentile from bottom
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


# ── Tests ──────────────────────────────────────────────────────────

def test_parse_basic_log():
    log = """\
# MangoHud v0.8.4
fps,frametime,cpu_load,gpu_load,cpu_temp,gpu_temp,gpu_power,cpu_power
60,16.67,45,80,55,65,15,10
62,16.13,46,82,55,65,15,10
58,17.24,44,78,56,66,14,10
"""
    result = parse_mangohud_log(log)
    assert "error" not in result
    assert result["fpsAvg"] == 60.0
    assert result["fpsLow"] == 58.0
    assert result["fpsHigh"] == 62.0
    assert result["tdpWatts"] == 14.7  # avg of 15,15,14 = 14.667 -> 14.7


def test_parse_log_with_summary_section():
    """The summary section (97%, AVG, 1%, 0.1%) should be skipped as data."""
    log = """\
# MangoHud v0.8.4
fps,frametime,cpu_load,gpu_power
60,16.67,45,15
62,16.13,46,15
58,17.24,44,14
# benchmark summary
97%,	62
AVG,	60
1%,	57
0.1%,	57
"""
    result = parse_mangohud_log(log)
    assert "error" not in result
    assert result["fpsAvg"] == 60.0
    # Should not have tried to parse summary lines as data
    assert result["fpsLow"] == 58.0
    assert result["fpsHigh"] == 62.0


def test_parse_empty_log_returns_error():
    result = parse_mangohud_log("")
    assert "error" in result


def test_parse_log_without_fps_column():
    log = """\
# no fps here
cpu_load,gpu_load
45,80
"""
    result = parse_mangohud_log(log)
    assert "error" in result


def test_parse_log_without_gpu_power():
    """tdpWatts should be None if gpu_power column is absent."""
    log = """\
fps,frametime,cpu_load
60,16.67,45
62,16.13,46
"""
    result = parse_mangohud_log(log)
    assert result["tdpWatts"] is None


def test_parse_one_percent_low_from_frametime():
    """1% low should be computed from frame times when available."""
    log = """\
fps,frametime
60,16.67
30,33.33
60,16.67
60,16.67
60,16.67
60,16.67
60,16.67
60,16.67
60,16.67
60,16.67
"""
    result = parse_mangohud_log(log)
    # The 33.33ms frame time is the worst — 1% low should be ~30 fps
    assert result["fpsOnePercentLow"] is not None
    assert result["fpsOnePercentLow"] <= 35  # roughly 1000/33.33 = 30


def test_parse_fixture_file():
    """Parse the actual fixture file."""
    fixture_path = os.path.join(
        os.path.dirname(__file__), "fixtures", "sample_mangohud.log"
    )
    with open(fixture_path, 'r') as f:
        content = f.read()
    result = parse_mangohud_log(content)
    assert "error" not in result
    assert result["fpsAvg"] == 60.1  # avg of the 10 data rows
    assert result["fpsLow"] == 57.0
    assert result["fpsHigh"] == 63.0
    assert result["tdpWatts"] is not None