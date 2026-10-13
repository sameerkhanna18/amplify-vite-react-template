import json
import os
import platform
import socket
import subprocess
import sys

from datetime import datetime, timezone
from pathlib import Path

import psutil


DMI_PATH = Path("/sys/class/dmi/id")
OS_RELEASE_PATH = Path("/etc/os-release")

INVALID_SERIALS = {
    "",
    "unknown",
    "none",
    "default string",
    "system serial number",
    "to be filled by o.e.m.",
    "not specified",
    "not applicable",
    "n/a",
    "na",
    "0",
}


class AuditError(Exception):
    """Raised when mandatory audit information cannot be collected."""


def read_file(path: Path) -> str:
    """Read a system metadata file without executing commands."""
    try:
        return path.read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        return ""


def is_valid_serial(value: str) -> bool:
    """Reject empty and common firmware placeholder values."""
    return value.strip().lower() not in INVALID_SERIALS


def get_serial() -> str:
    """
    Obtain a valid system serial number.

    First try normal file access. If permission is denied, attempt
    a non-interactive sudo read. This requires sudo authorization
    to have already been configured for the user.
    """

    serial_path = DMI_PATH / "product_serial"

    try:
        serial = serial_path.read_text(
            encoding="utf-8"
        ).strip()

        if is_valid_serial(serial):
            return serial

    except PermissionError:
        pass

    except (OSError, UnicodeError):
        pass

    # Do not invoke sudo when the agent is already running as root.
    if os.geteuid() != 0:
        try:
            result = subprocess.run(
                [
                    "sudo",
                    "-n",
                    "/usr/bin/cat",
                    str(serial_path),
                ],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )

            if result.returncode == 0:
                serial = result.stdout.strip()

                if is_valid_serial(serial):
                    return serial

        except (
            OSError,
            subprocess.TimeoutExpired,
        ):
            pass

    raise AuditError(
        "A valid hardware serial number could not be obtained. "
        "The audit was not submitted. Check hardware availability "
        "and the user's authorized access."
    )


def get_os_version() -> str:
    """Read the operating system version."""
    values = {}

    for line in read_file(OS_RELEASE_PATH).splitlines():
        key, separator, value = line.partition("=")

        if separator:
            values[key] = value.strip().strip('"').strip("'")

    return values.get(
        "PRETTY_NAME",
        platform.system() or "Unknown",
    )


def get_cpu() -> str:
    """Read CPU information through the Linux proc interface."""
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
    """Return OS-visible physical memory."""
    try:
        memory_bytes = psutil.virtual_memory().total
        return f"{memory_bytes / (1024 ** 3):.2f} GB"

    except (OSError, ValueError):
        return "Unknown"


def get_storage() -> str:
    """Calculate visible block-device capacity through sysfs."""
    total_bytes = 0
    found_device = False

    try:
        for device in Path("/sys/block").iterdir():
            if device.name.startswith(
                ("loop", "ram", "zram")
            ):
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
    """Collect the fields required by the DeviceAudit schema."""

    serial = get_serial()

    make = read_file(DMI_PATH / "sys_vendor")
    model = read_file(DMI_PATH / "product_name")

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
        "AuditTime": datetime.now(
            timezone.utc
        ).isoformat(),
    }


def main():
    try:
        audit = get_device_audit()

        print(json.dumps(audit, indent=2))

    except AuditError as error:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "message": str(error),
                },
                indent=2,
            ),
            file=sys.stderr,
        )

        sys.exit(1)


if __name__ == "__main__":
    main()
