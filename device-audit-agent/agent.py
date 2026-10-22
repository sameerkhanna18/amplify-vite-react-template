#!/usr/bin/env python3

import json
import platform
import re
import shutil
import socket
import subprocess
import threading

from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


# ============================================================
# Configuration
# ============================================================

HOST = "127.0.0.1"
PORT = 8765

AMPLIFY_URL = (
    "https://device-audit.d3io5lnwh2u6as.amplifyapp.com"
)

ALLOWED_ORIGIN = AMPLIFY_URL


# ============================================================
# Command execution
# ============================================================

def run_command(command, timeout=15):
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )

        if result.returncode == 0:
            return result.stdout.strip()

    except (OSError, subprocess.TimeoutExpired):
        pass

    return ""


def run_sudo_command(command):
    """
    Execute a command through sudo without prompting for a password.

    Configure narrowly scoped sudo permissions for dmidecode if
    firmware information must be collected without an interactive
    password prompt.
    """
    return run_command(["sudo", "-n"] + command)


def clean_value(value):
    if value is None:
        return ""

    value = str(value).strip()

    unavailable = {
        "",
        "unknown",
        "none",
        "not specified",
        "not provided",
        "not applicable",
        "to be filled by o.e.m.",
        "to be filled by oem",
        "default string",
        "system serial number",
        "00000000-0000-0000-0000-000000000000",
    }

    if value.lower() in unavailable:
        return ""

    return value


def first_nonempty(*values):
    for value in values:
        value = clean_value(value)

        if value:
            return value

    return ""


def read_file(path):
    try:
        return clean_value(
            Path(path).read_text(encoding="utf-8")
        )
    except (OSError, UnicodeError):
        return ""


def get_dmi_value(field):
    return clean_value(
        run_sudo_command(["dmidecode", "-s", field])
    )


# ============================================================
# Operating system
# ============================================================

def get_os_information():
    result = {
        "name": platform.platform(),
        "kernel": platform.release(),
        "architecture": platform.machine(),
    }

    try:
        with open(
            "/etc/os-release",
            encoding="utf-8",
        ) as file:
            for line in file:
                if line.startswith("PRETTY_NAME="):
                    result["name"] = (
                        line.split("=", 1)[1]
                        .strip()
                        .strip('"')
                    )
                    break

    except OSError:
        pass

    return result


# ============================================================
# Computer type detection
# ============================================================

def detect_product_type(chassis, model):
    chassis_value = clean_value(chassis).lower()
    model_value = clean_value(model).lower()

    # SMBIOS/DMI chassis type values.
    chassis_types = {
        "1": "Other",
        "2": "Unknown",
        "3": "Desktop",
        "4": "Low Profile Desktop",
        "5": "Pizza Box",
        "6": "Mini Tower",
        "7": "Tower",
        "8": "Portable",
        "9": "Laptop",
        "10": "Notebook",
        "11": "Handheld",
        "12": "Docking Station",
        "13": "All-in-One",
        "14": "Sub Notebook",
        "15": "Space-saving PC",
        "16": "Lunch Box PC",
        "17": "Main Server Chassis",
        "18": "Expansion Chassis",
        "19": "Sub Chassis",
        "20": "Bus Expansion Chassis",
        "21": "Peripheral Chassis",
        "22": "RAID Chassis",
        "23": "Rack Mount Server",
        "24": "Sealed-case PC",
        "25": "Multi-system Chassis",
        "26": "Compact PCI",
        "27": "Advanced TCA",
        "28": "Blade Server",
        "29": "Blade Enclosure",
        "30": "Tablet",
        "31": "Convertible",
        "32": "Detachable",
        "33": "IoT Gateway",
        "34": "Embedded PC",
        "35": "Mini PC",
        "36": "Stick PC",
    }

    if chassis_value.isdigit():
        product_type = chassis_types.get(
            chassis_value,
            "",
        )

        if product_type and product_type != "Unknown":
            return product_type

    # Some firmware returns a textual chassis description.
    if any(
        word in chassis_value
        for word in (
            "laptop",
            "notebook",
            "portable",
            "sub notebook",
        )
    ):
        return "Laptop"

    if "tablet" in chassis_value:
        return "Tablet"

    if "convertible" in chassis_value:
        return "Convertible"

    if "detachable" in chassis_value:
        return "Detachable"

    if "all-in-one" in chassis_value or "all in one" in chassis_value:
        return "All-in-One"

    if "mini pc" in chassis_value:
        return "Mini PC"

    if "desktop" in chassis_value:
        return "Desktop"

    if "tower" in chassis_value:
        return "Tower"

    # Model-based fallback when chassis data is missing.
    laptop_patterns = (
        r"\blaptop\b",
        r"\bnotebook\b",
        r"\bthinkpad\b",
        r"\bthinkbook\b",
        r"\blatitude\b",
        r"\bvostro\b",
        r"\binspiron\b",
        r"\belitebook\b",
        r"\bprobook\b",
        r"\bmacbook\b",
        r"\bpavilion\b",
        r"\bzenbook\b",
        r"\bvivobook\b",
        r"\bspectre\b",
        r"\btravelmate\b",
        r"\bswift\b",
    )

    if any(
        re.search(pattern, model_value)
        for pattern in laptop_patterns
    ):
        return "Laptop"

    desktop_patterns = (
        r"\boptiplex\b",
        r"\bthinkcentre\b",
        r"\bprodesk\b",
        r"\belitedesk\b",
        r"\bprecision tower\b",
        r"\bpoweredge\b",
        r"\bminipc\b",
        r"\bmini pc\b",
        r"\bmac mini\b",
        r"\bmac studio\b",
    )

    if any(
        re.search(pattern, model_value)
        for pattern in desktop_patterns
    ):
        if "poweredge" in model_value:
            return "Server"

        if "mini" in model_value:
            return "Mini PC"

        return "Desktop"

    if model_value:
        return "Computer"

    return "Unknown"


# ============================================================
# Computer and motherboard identification
# ============================================================

def get_system_information():
    manufacturer = get_dmi_value("system-manufacturer")
    model = get_dmi_value("system-product-name")
    chassis = get_dmi_value("chassis-type")

    # Use the actual system SKU only.
    # Do not substitute the motherboard product name/version.
    part_number = get_dmi_value("system-sku-number")

    serial = get_dmi_value("system-serial-number")
    system_uuid = get_dmi_value("system-uuid")

    board_manufacturer = get_dmi_value(
        "baseboard-manufacturer"
    )

    board_model = get_dmi_value(
        "baseboard-product-name"
    )

    board_serial = get_dmi_value(
        "baseboard-serial-number"
    )

    board_version = get_dmi_value(
        "baseboard-version"
    )

    board_asset_tag = get_dmi_value(
        "baseboard-asset-tag"
    )

    motherboard = {
        "name": "Motherboard",
        "manufacturer": board_manufacturer,
        "model": board_model,
        "serial": board_serial,
        "type": "",
        "speed": "",
        "size": "",
        "version": board_version,
        "asset_tag": board_asset_tag,
    }

    return {
        "manufacturer": manufacturer,
        "model": model,
        "serial": serial,
        "part_number": part_number,
        "system_uuid": system_uuid,
        "product_type": detect_product_type(
            chassis,
            model,
        ),
        "chassis_type": chassis,
        "motherboard": motherboard