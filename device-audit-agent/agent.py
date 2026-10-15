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
# Run system commands safely
# ============================================================

def run_command(command, timeout=10):
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
    Run a hardware query through sudo.

    Configure sudo permissions appropriately if passwordless
    execution is required. Do not embed a sudo password here.
    """
    return run_command(["sudo", "-n"] + command)


# ============================================================
# Hardware identification
# ============================================================

def get_dmi_value(field):
    return run_sudo_command(["dmidecode", "-s", field])


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


# ============================================================
# RAM detection
# ============================================================

def get_ram_information():
    output = run_sudo_command(["dmidecode", "--type", "memory"])

    modules = []
    slot_count = 0
    current_device = None

    def finish_device(device):
        if not device:
            return

        size_mb = device.get("size_mb")

        if size_mb is not None and size_mb > 0:
            modules.append({
                "name": f"RAM {len(modules) + 1}",
                "size_mb": size_mb,
                "capacity_gb": round(size_mb / 1024, 2),
                "locator": device.get("locator", ""),
                "type": device.get("type", ""),
                "speed": device.get("speed", ""),
            })

    for line in output.splitlines():
        if re.match(r"^\s*Memory Device\s*$", line):
            finish_device(current_device)
            current_device = {}
            slot_count += 1
            continue

        if current_device is None:
            continue

        match = re.match(r"^\s*Size:\s*(.+?)\s*$", line)

        if match:
            value = match.group(1)

            if value.lower() == "no module installed":
                current_device["size_mb"] = None
            else:
                capacity = re.match(
                    r"^(\d+)\s*(MB|GB|TB)$",
                    value,
                    re.IGNORECASE,
                )

                if capacity:
                    number = int(capacity.group(1))
                    unit = capacity.group(2).upper()

                    multiplier = {
                        "MB": 1,
                        "GB": 1024,
                        "TB": 1024 * 1024,
                    }[unit]

                    current_device["size_mb"] = number * multiplier

            continue

        for key, pattern in (
            ("locator", r"^\s*Locator:\s*(.+)$"),
            ("type", r"^\s*Type:\s*(.+)$"),
            ("speed", r"^\s*Speed:\s*(.+)$"),
        ):
            match = re.match(pattern, line)

            if match:
                current_device[key] = match.group(1).strip()

    finish_device(current_device)

    total_mb = sum(module["size_mb"] for module in modules)

    return {
        "total_gb": round(total_mb / 1024, 2),
        "modules_installed": len(modules),
        "slots_used": len(modules),
        "slots_available": max(0, slot_count - len(modules)),
        "slots_total": slot_count,
        "modules": modules,
    }


# ============================================================
# Disk detection
# ============================================================

def get_disk_information():
    output = run_command([
        "lsblk",
        "-J",
        "-b",
        "-o",
        "NAME,SIZE,TYPE,TRAN,RM,MODEL",
    ])

    if not output:
        return []

    try:
        devices = json.loads(output).get("blockdevices", [])
    except json.JSONDecodeError:
        return []

    disks = []

    for device in devices:
        if device.get("type") != "disk":
            continue

        # Exclude USB-connected disks and removable devices.
        if (device.get("tran") or "").lower() == "usb":
            continue

        if str(device.get("rm", "0")) == "1":
            continue

        size_bytes = int(device.get("size") or 0)

        disks.append({
            "name": f"Disk {len(disks) + 1}",
            "device": device.get("name", ""),
            "capacity_gb": round(size_bytes / 1_000_000_000),
            "model": (device.get("model") or "").strip(),
        })

    return disks


# ============================================================
# Collect complete audit
# ============================================================

def collect_audit():
    ram = get_ram_information()
    disks = get_disk_information()

    os_name = "Unknown"

    try:
        with open("/etc/os-release", encoding="utf-8") as file:
            for line in file:
                if line.startswith("PRETTY_NAME="):
                    os_name = line.split("=", 1)[1].strip().strip('"')
                    break
    except OSError:
        os_name = platform.platform()

    audit = {
        "host": socket.gethostname(),
        "hostname": socket.gethostname(),
        "manufacturer": get_dmi_value("system-manufacturer"),
        "model": get_dmi_value("system-product-name"),
        "serial": get_dmi_value("system-serial-number"),
        "product_type": detect_product_type(),
        "os_version": os_name,
        "kernel": platform.release(),
        "cpu": platform.processor() or run_command(
            ["bash", "-c", "lscpu | awk -F: '/Model name/ {print $2; exit}'"]
        ).strip(),
        "ram": ram,
        "disks": disks,
        "collected_at": datetime.now().astimezone().isoformat(),
    }

    return audit


# ============================================================
# CSV output
# ============================================================

def save_csv(audit):
    row = {
        "Hostname": audit["host"],
        "Make": audit["manufacturer"],
        "Model": audit["model"],
        "Serial": audit["serial"],
        "ProductType": audit["product_type"],
        "OsVersion": audit["os_version"],
        "Kernel": audit["kernel"],
        "CPU": audit["cpu"],
        "TotalRAM_GB": audit["ram"]["total_gb"],
        "RAMSlotsUsed": audit["ram"]["slots_used"],
        "RAMSlotsAvailable": audit["ram"]["slots_available"],
        "RAMSlotsTotal": audit["ram"]["slots_total"],
    }

    for index, module in enumerate(audit["ram"]["modules"], start=1):
        row[f"RAM{index}_GB"] = module["capacity_gb"]

    for index, disk in enumerate(audit["disks"], start=1):
        row[f"Disk{index}_GB"] = disk["capacity_gb"]

    with open(CSV_FILE, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(row.keys()))
        writer.writeheader()
        writer.writerow(row)


# ============================================================
# Display report
# ============================================================

def display_audit(audit):
    print("\n==========================================")
    print("          COMPUTER AUDIT REPORT")
    print("==========================================")

    print(f"Hostname: {audit['host']}")
    print(f"Manufacturer: {audit['manufacturer']}")
    print(f"Model: {audit['model']}")
    print(f"Serial: {audit['serial']}")
    print(f"Product Type: {audit['product_type']}")
    print(f"OS: {audit['os_version']}")
    print(f"Kernel: {audit['kernel']}")
    print(f"CPU: {audit['cpu']}")

    ram = audit["ram"]

    print("\nRAM INFORMATION")
    print(f"Total RAM: {ram['total_gb']} GB")
    print(f"RAM Slots Used: {ram['slots_used']}")
    print(f"RAM Slots Available: {ram['slots_available']}")
    print(f"Total RAM Slots: {ram['slots_total']}")

    for module in ram["modules"]:
        print(
            f"{module['name']}: {module['capacity_gb']} GB"
            + (
                f" ({module['locator']})"
                if module["locator"]
                else ""
            )
        )

    print("\nDISK INFORMATION")

    if audit["disks"]:
        for disk in audit["disks"]:
            print(f"{disk['name']}: {disk['capacity_gb']} GB")
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
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Vary", "Origin")
        self.end_headers()

        self.wfile.write(body)

    def do_OPTIONS(self):
        origin = self.headers.get("Origin", "")

        if origin != ALLOWED_ORIGIN:
            self.send_json(403, {"error": "Origin not allowed"})
            return

        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self):
        origin = self.headers.get("Origin", "")

        # Prevent unrelated websites from reading the audit data.
        if origin and origin != ALLOWED_ORIGIN:
            self.send_json(403, {"error": "Origin not allowed"})
            return

        path = urlparse(self.path).path

        if path == "/":
            self.send_json(200, {
                "status": "running",
                "service": "computer-audit",
                "endpoints": ["/audit"],
            })
            return

        if path == "/audit":
            audit = collect_audit()
            self.send_json(200, audit)
            return

        self.send_json(404, {"error": "Not found"})

    def log_message(self, format_string, *args):
        print("[HTTP]", format_string % args)


# ============================================================
# Main program
# ============================================================

def main():
    if shutil.which("dmidecode") is None:
        print("Warning: dmidecode is not installed.")

    audit = collect_audit()

    save_csv(audit)
    display_audit(audit)

    try:
        server = ThreadingHTTPServer((HOST, PORT), AuditHandler)
    except OSError as error:
        raise SystemExit(
            f"Cannot start server on {HOST}:{PORT}: {error}"
        )

    print("\n==========================================")
    print("Starting local audit server...")
    print("==========================================")
    print(f"Audit server listening on http://{HOST}:{PORT}")
    print(f"Allowed website: {AMPLIFY_URL}")
    print("Audit endpoint: http://127.0.0.1:8765/audit")

    # Open the existing AWS Amplify website.
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
