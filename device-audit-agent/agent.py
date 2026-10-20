#!/usr/bin/env python3

import csv
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import threading
import webbrowser

from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


# ============================================================
# Configuration
# ============================================================

SCRIPT_DIR = Path(__file__).resolve().parent
CSV_FILE = SCRIPT_DIR / "audit.csv"

HOST = "127.0.0.1"
PORT = 8765

AMPLIFY_URL = (
    "https://device-audit.d3io5lnwh2u6as.amplifyapp.com"
)

ALLOWED_ORIGIN = AMPLIFY_URL


# ============================================================
# Safe command execution
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
    Run a privileged hardware query without prompting for
    a password.

    If sudo permissions are unavailable, return an empty
    result instead of stopping the entire audit.
    """
    return run_command(["sudo", "-n"] + command)


def clean_value(value):
    """Convert unavailable firmware values into empty strings."""

    if value is None:
        return ""

    value = str(value).strip()

    unavailable = {
        "",
        "unknown",
        "none",
        "not specified",
        "not provided",
        "to be filled by o.e.m.",
        "to be filled by oem",
        "default string",
        "system serial number",
    }

    if value.lower() in unavailable:
        return ""

    return value


def first_nonempty(*values):
    for value in values:
        cleaned = clean_value(value)

        if cleaned:
            return cleaned

    return ""


# ============================================================
# System identification
# ============================================================

def get_dmi_value(field):
    return clean_value(
        run_sudo_command(["dmidecode", "-s", field])
    )


def detect_product_type():
    chassis = get_dmi_value("chassis-type").lower()

    laptop_types = (
        "laptop",
        "notebook",
        "portable",
        "sub notebook",
    )

    desktop_types = (
        "desktop",
        "tower",
        "mini tower",
        "low profile desktop",
        "pizza box",
    )

    if any(item in chassis for item in laptop_types):
        return "Laptop"

    if any(item in chassis for item in desktop_types):
        return "Desktop"

    model = get_dmi_value("system-product-name").lower()

    if any(
        word in model
        for word in (
            "laptop",
            "notebook",
            "thinkpad",
            "latitude",
            "vostro",
            "inspiron",
            "elitebook",
            "probook",
            "macbook",
        )
    ):
        return "Laptop"

    if any(
        word in model
        for word in (
            "desktop",
            "optiplex",
            "thinkcentre",
            "prodesk",
            "elitedesk",
            "tower",
        )
    ):
        return "Desktop"

    return "Unknown"


def get_system_information():
    return {
        "manufacturer": get_dmi_value("system-manufacturer"),
        "model": get_dmi_value("system-product-name"),
        "serial": get_dmi_value("system-serial-number"),
        "part_number": get_dmi_value("system-sku-number"),
        "system_uuid": get_dmi_value("system-uuid"),
        "product_type": detect_product_type(),
    }


# ============================================================
# CPU detection
# ============================================================

def get_cpu_information():
    output = run_command(["lscpu"])

    fields = {}

    for line in output.splitlines():
        if ":" not in line:
            continue

        key, value = line.split(":", 1)
        fields[key.strip().lower()] = value.strip()

    vendor_id = fields.get("vendor id", "")
    model_name = fields.get("model name", "")

    if "GenuineIntel" in vendor_id:
        manufacturer = "Intel"
    elif "AuthenticAMD" in vendor_id:
        manufacturer = "AMD"
    else:
        manufacturer = vendor_id

    if not model_name:
        model_name = (
            platform.processor()
            or platform.machine()
        )

    cpu_mhz = fields.get("cpu mhz", "")
    max_mhz = fields.get("cpu max mhz", "")

    def format_frequency(value):
        try:
            return f"{float(value) / 1000:.2f} GHz"
        except (ValueError, TypeError):
            return ""

    return {
        "name": "CPU",
        "manufacturer": manufacturer,
        "model": model_name,
        "serial": "",
        "part_number": "",
        "architecture": fields.get("architecture", ""),
        "cores": fields.get("cpu(s)", ""),
        "threads_per_core": fields.get("thread(s) per core", ""),
        "logical_processors": fields.get("on-line cpu(s) list", ""),
        "speed": format_frequency(max_mhz)
        or format_frequency(cpu_mhz),
        "current_speed": format_frequency(cpu_mhz),
        "identifier": vendor_id,
    }


# ============================================================
# RAM detection
# ============================================================

def get_ram_information():
    output = run_sudo_command([
        "dmidecode",
        "--type",
        "memory",
    ])

    modules = []
    slot_count = 0
    current_device = None

    def finish_device(device):
        if not device:
            return

        size_mb = device.get("size_mb")

        # Skip empty RAM slots and devices without a valid size.
        if size_mb is None or size_mb <= 0:
            return

        manufacturer = clean_value(
            device.get("manufacturer")
        )

        part_number = clean_value(
            device.get("part_number")
        )

        model = first_nonempty(
            device.get("model"),
            part_number,
        )

        modules.append({
            "name": f"RAM {len(modules) + 1}",

            # Manufacturer and model identification
            "manufacturer": manufacturer,
            "model": model,
            "part_number": part_number,

            # Serial and asset identification
            "serial": clean_value(
                device.get("serial")
            ),
            "asset_tag": clean_value(
                device.get("asset_tag")
            ),

            # Memory capacity
            "size_mb": size_mb,
            "capacity_gb": round(
                size_mb / 1024,
                2,
            ),

            # Memory location and physical form
            "locator": clean_value(
                device.get("locator")
            ),
            "form_factor": clean_value(
                device.get("form_factor")
            ),

            # Memory type and speed
            "type": clean_value(
                device.get("type")
            ),
            "speed": first_nonempty(
                device.get("configured_speed"),
                device.get("speed"),
            ),
            "configured_speed": clean_value(
                device.get("configured_speed")
            ),
        })

    for line in output.splitlines():

        # Start a new physical memory device.
        if re.match(
            r"^\s*Memory Device\s*$",
            line,
        ):
            finish_device(current_device)
            current_device = {}
            slot_count += 1
            continue

        if current_device is None:
            continue

        match = re.match(
            r"^\s*([^:]+):\s*(.*?)\s*$",
            line,
        )

        if not match:
            continue

        key = match.group(1).strip().lower()
        value = match.group(2).strip()

        # RAM capacity
        if key == "size":

            if value.lower() == "no module installed":
                current_device["size_mb"] = None

            else:
                capacity = re.match(
                    r"^(\d+)\s*(MB|GB|TB)$",
                    value,
                    re.IGNORECASE,
                )

                if capacity:
                    number = int(
                        capacity.group(1)
                    )

                    unit = capacity.group(2).upper()

                    multiplier = {
                        "MB": 1,
                        "GB": 1024,
                        "TB": 1024 * 1024,
                    }[unit]

                    current_device["size_mb"] = (
                        number * multiplier
                    )

        # RAM slot / location
        elif key in (
            "locator",
            "device locator",
        ):
            if value and value.lower() not in (
                "unknown",
                "not specified",
            ):
                current_device["locator"] = value

        # RAM physical form factor
        elif key == "form factor":
            current_device["form_factor"] = value

        # RAM technology, e.g. DDR4 or DDR5
        elif key == "type":
            current_device["type"] = value

        # RAM rated speed
        elif key == "speed":
            current_device["speed"] = value

        # RAM configured operating speed
        elif key == "configured memory speed":
            current_device["configured_speed"] = value

        # RAM manufacturer
        elif key == "manufacturer":
            current_device["manufacturer"] = value

        # RAM serial number
        elif key == "serial number":
            current_device["serial"] = value

        # RAM model / part number
        elif key == "part number":
            current_device["part_number"] = value

        # RAM asset tag
        elif key == "asset tag":
            current_device["asset_tag"] = value

    # Process the last memory device.
    finish_device(current_device)

    total_mb = sum(
        module["size_mb"]
        for module in modules
    )

    return {
        "total_gb": round(
            total_mb / 1024,
            2,
        ),
        "modules_installed": len(modules),
        "slots_used": len(modules),
        "slots_available": max(
            0,
            slot_count - len(modules),
        ),
        "slots_total": slot_count,
        "modules": modules,
    }


# ============================================================
# Storage detection
# ============================================================

def get_disk_information():
    output = run_command([
        "lsblk",
        "-J",
        "-b",
        "-o",
        "NAME,SIZE,TYPE,TRAN,RM,MODEL,SERIAL,VENDOR,WWN",
    ])

    if not output:
        return []

    try:
        devices = json.loads(output).get(
            "blockdevices",
            [],
        )
    except (json.JSONDecodeError, AttributeError):
        return []

    disks = []

    for device in devices:
        if device.get("type") != "disk":
            continue

        # Exclude removable and USB-connected disks.
        if (device.get("tran") or "").lower() == "usb":
            continue

        if str(device.get("rm", "0")) == "1":
            continue

        try:
            size_bytes = int(device.get("size") or 0)
        except (TypeError, ValueError):
            size_bytes = 0

        model = clean_value(device.get("model"))
        vendor = clean_value(device.get("vendor"))

        serial = clean_value(device.get("serial"))
        wwn = clean_value(device.get("wwn"))

        disks.append({
            "name": f"Disk {len(disks) + 1}",
            "device": device.get("name", ""),
            "manufacturer": vendor,
            "model": model,
            "serial": serial,
            "part_number": "",
            "capacity_gb": round(
                size_bytes / 1_000_000_000,
                2,
            ),
            "type": device.get("tran") or "",
            "speed": "",
            "locator": "",
            "wwn": wwn,
            "hardware_id": wwn,
        })

    return disks


# ============================================================
# IMEI detection
# ============================================================

def get_imei():
    """
    Attempt to retrieve an IMEI from a modem managed by
    ModemManager.

    Returns an empty string when no suitable modem is
    available or the identifier cannot be retrieved.
    """

    if not shutil.which("mmcli"):
        return ""

    output = run_command(["mmcli", "-L"])

    modem_ids = re.findall(
        r"/Modem/(\d+)",
        output,
        re.IGNORECASE,
    )

    for modem_id in modem_ids:
        modem_output = run_command([
            "mmcli",
            "-m",
            modem_id,
        ])

        match = re.search(
            r"equipment identifier:\s*([0-9]+)",
            modem_output,
            re.IGNORECASE,
        )

        if match:
            return match.group(1)

    return ""


# ============================================================
# Collect audit
# ============================================================

def collect_audit():
    system = get_system_information()
    ram = get_ram_information()
    disks = get_disk_information()
    cpu = get_cpu_information()

    os_name = platform.platform()

    try:
        with open(
            "/etc/os-release",
            encoding="utf-8",
        ) as file:
            for line in file:
                if line.startswith("PRETTY_NAME="):
                    os_name = (
                        line.split("=", 1)[1]
                        .strip()
                        .strip('"')
                    )
                    break
    except OSError:
        pass

    hostname = socket.gethostname()

    return {
        # Existing fields retained for frontend compatibility.
        "host": hostname,
        "manufacturer": system["manufacturer"],
        "model": system["model"],
        "serial": system["serial"],
        "product_type": system["product_type"],
        "os_version": os_name,
        "kernel": platform.release(),

        # System identification.
        "part_number": system["part_number"],
        "system_uuid": system["system_uuid"],
        "hwid": system["system_uuid"],
        "imei": get_imei(),

        # Structured hardware.
        "cpu": cpu["model"],
        "cpu_info": cpu,
        "ram": ram,
        "disks": disks,

        "collected_at": datetime.now()
        .astimezone()
        .isoformat(),
    }


# ============================================================
# CSV output
# ============================================================

def save_csv(audit):
    row = {
        "Hostname": audit["host"],
        "Manufacturer": audit["manufacturer"],
        "ProductType": audit["product_type"],
        "Model": audit["model"],
        "Serial": audit["serial"],
        "PartNumber": audit["part_number"],
        "SystemUUID": audit["system_uuid"],
        "IMEI": audit["imei"],
        "OsVersion": audit["os_version"],
        "Kernel": audit["kernel"],
        "CPUManufacturer": audit["cpu_info"]["manufacturer"],
        "CPUModel": audit["cpu_info"]["model"],
        "CPUCores": audit["cpu_info"]["cores"],
        "CPUSpeed": audit["cpu_info"]["speed"],
        "TotalRAM_GB": audit["ram"]["total_gb"],
        "RAMSlotsUsed": audit["ram"]["slots_used"],
        "RAMSlotsAvailable": audit["ram"]["slots_available"],
        "RAMSlotsTotal": audit["ram"]["slots_total"],
    }

    for index, module in enumerate(
        audit["ram"]["modules"],
        start=1,
    ):
        row[f"RAM{index}_Manufacturer"] = module["manufacturer"]
        row[f"RAM{index}_Model"] = module["model"]
        row[f"RAM{index}_Serial"] = module["serial"]
        row[f"RAM{index}_PartNumber"] = module["part_number"]
        row[f"RAM{index}_GB"] = module["capacity_gb"]
        row[f"RAM{index}_Speed"] = module["speed"]
        row[f"RAM{index}_Type"] = module["type"]
        row[f"RAM{index}_Slot"] = module["locator"]

    for index, disk in enumerate(
        audit["disks"],
        start=1,
    ):
        row[f"Disk{index}_Manufacturer"] = disk["manufacturer"]
        row[f"Disk{index}_Model"] = disk["model"]
        row[f"Disk{index}_Serial"] = disk["serial"]
        row[f"Disk{index}_GB"] = disk["capacity_gb"]
        row[f"Disk{index}_WWN"] = disk["wwn"]

    with open(
        CSV_FILE,
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=list(row.keys()),
        )

        writer.writeheader()
        writer.writerow(row)


# ============================================================
# Terminal report
# ============================================================

def display_audit(audit):
    print("\n==========================================")
    print("          COMPUTER AUDIT REPORT")
    print("==========================================")

    print(f"Hostname: {audit['host']}")
    print(f"Manufacturer: {audit['manufacturer']}")
    print(f"Product Type: {audit['product_type']}")
    print(f"Model: {audit['model']}")
    print(f"Serial Number: {audit['serial']}")
    print(f"Part Number: {audit['part_number']}")
    print(f"System UUID / HWID: {audit['system_uuid']}")
    print(f"IMEI: {audit['imei'] or 'Not available'}")
    print(f"Operating System: {audit['os_version']}")
    print(f"Kernel: {audit['kernel']}")

    cpu = audit["cpu_info"]

    print("\nCPU INFORMATION")
    print(f"Manufacturer: {cpu['manufacturer']}")
    print(f"Model: {cpu['model']}")
    print(f"Cores: {cpu['cores']}")
    print(f"Speed: {cpu['speed']}")
    print("CPU serial number: Not generally exposed")

    ram = audit["ram"]

    print("\nRAM INFORMATION")
    print(f"Total RAM: {ram['total_gb']} GB")
    print(f"Slots Used: {ram['slots_used']}")
    print(f"Slots Available: {ram['slots_available']}")
    print(f"Total Slots: {ram['slots_total']}")

    for module in ram["modules"]:
        print(f"\n{module['name']}")

        for key in (
            "manufacturer",
            "model",
            "serial",
            "part_number",
            "capacity_gb",
            "type",
            "speed",
            "locator",
        ):
            print(f"  {key}: {module.get(key, '')}")

    print("\nSTORAGE INFORMATION")

    if audit["disks"]:
        for disk in audit["disks"]:
            print(f"\n{disk['name']}")

            for key in (
                "manufacturer",
                "model",
                "serial",
                "part_number",
                "capacity_gb",
                "device",
                "wwn",
            ):
                print(f"  {key}: {disk.get(key, '')}")
    else:
        print("No internal disks detected.")

    print(f"\nCSV saved to: {CSV_FILE}")


# ============================================================
# Local HTTP server
# ============================================================

class AuditHandler(BaseHTTPRequestHandler):

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")

        self.send_response(status)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )
        self.send_header(
            "Content-Length",
            str(len(body)),
        )
        self.send_header("Cache-Control", "no-store")
        self.send_header(
            "Access-Control-Allow-Origin",
            ALLOWED_ORIGIN,
        )
        self.send_header("Vary", "Origin")
        self.end_headers()

        self.wfile.write(body)

    def do_OPTIONS(self):
        origin = self.headers.get("Origin", "")

        if origin != ALLOWED_ORIGIN:
            self.send_json(
                403,
                {"error": "Origin not allowed"},
            )
            return

        self.send_response(204)
        self.send_header(
            "Access-Control-Allow-Origin",
            ALLOWED_ORIGIN,
        )
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, OPTIONS",
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type",
        )
        self.send_header(
            "Access-Control-Max-Age",
            "600",
        )
        self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self):
        origin = self.headers.get("Origin", "")

        if origin and origin != ALLOWED_ORIGIN:
            self.send_json(
                403,
                {"error": "Origin not allowed"},
            )
            return

        path = urlparse(self.path).path

        if path == "/":
            self.send_json(
                200,
                {
                    "status": "running",
                    "service": "computer-audit",
                    "endpoints": ["/audit"],
                },
            )
            return

        if path == "/audit":
            try:
                audit = collect_audit()
                self.send_json(200, audit)
            except Exception:
                self.send_json(
                    500,
                    {"error": "Failed to collect audit data"},
                )

            return

        self.send_json(404, {"error": "Not found"})

    def log_message(self, format_string, *args):
        print("[HTTP]", format_string % args)


# ============================================================
# Main
# ============================================================

def main():
    if shutil.which("dmidecode") is None:
        print("Warning: dmidecode is not installed.")

    audit = collect_audit()

    save_csv(audit)
    display_audit(audit)

    try:
        server = ThreadingHTTPServer(
            (HOST, PORT),
            AuditHandler,
        )
    except OSError as error:
        raise SystemExit(
            f"Cannot start server on {HOST}:{PORT}: {error}"
        )

    print("\n==========================================")
    print("Starting local audit server...")
    print("==========================================")
    print(f"Audit server: http://{HOST}:{PORT}")
    print(f"Allowed website: {AMPLIFY_URL}")
    print(f"Audit endpoint: http://{HOST}:{PORT}/audit")

    threading.Timer(
        1.0,
        lambda: webbrowser.open(AMPLIFY_URL),
    ).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAudit server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
