import json
import platform
import socket
from datetime import datetime, timezone
from pathlib import Path

import psutil


DMI_PATH = Path("/sys/class/dmi/id")
OS_RELEASE_PATH = Path("/etc/os-release")


def read_file(path: Path) -> str:
    """Read a system metadata file safely."""
    try:
        return path.read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        return ""


def get_os_version() -> str:
    """Read the operating system version."""
    values = {}

    for line in read_file(OS_RELEASE_PATH).splitlines():
        key, separator, value = line.partition("=")

        if separator:
            values[key] = value.strip().strip('"').strip("'")

    return values.get("PRETTY_NAME", platform.system() or "Unknown")


def get_cpu() -> str:
    """Collect CPU information without executing commands."""
    cpu_info = read_file(Path("/proc/cpuinfo"))

    for line in cpu_info.splitlines():
        key, separator, value = line.partition(":")

        if separator and key.strip() in (
            "model name",
            "Hardware",
            "Processor",
        ):
            return value.strip()[:1000]

    return platform.processor() or "Unknown"


def get_ram() -> str:
    """Return the OS-visible physical memory."""
    try:
        memory_bytes = psutil.virtual_memory().total
        return f"{memory_bytes / (1024 ** 3):.2f} GB"
    except (OSError, ValueError):
        return "Unknown"


def get_storage() -> str:
    """Return the combined capacity of visible block devices."""
    total_bytes = 0
    found_device = False

    try:
        for device in Path("/sys/block").iterdir():
            if device.name.startswith(("loop", "ram", "zram")):
                continue

            size = read_file(device / "size")

            if not size.isdigit():
                continue

            sectors = int(size)

            if sectors > 0:
                total_bytes += sectors * 512
                found_device = True

    except OSError:
        return "Unknown"

    if not found_device:
        return "Unknown"

    return f"{total_bytes / (1024 ** 3):.2f} GB"


def get_device_audit() -> dict:
    """Collect the fields required by the AWS audit schema."""

    make = read_file(DMI_PATH / "sys_vendor")
    model = read_file(DMI_PATH / "product_name")
    serial = read_file(DMI_PATH / "product_serial")

    placeholders = {
        "unknown",
        "none",
        "default string",
        "system serial number",
        "to be filled by o.e.m.",
    }

    if serial.lower() in placeholders:
        serial = ""

    return {
        "Host": socket.gethostname() or "Unknown",
        "Make": make or "Unknown",
        "Model": model or "Unknown",
        "Serial": serial,
        "OsVersion": get_os_version(),
        "Kernel": platform.release() or "Unknown",
        "CPU": get_cpu(),
        "Ram": get_ram(),
        "Storage": get_storage(),
        "AuditTime": datetime.now(timezone.utc).isoformat(),
    }


def main():
    audit = get_device_audit()
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()