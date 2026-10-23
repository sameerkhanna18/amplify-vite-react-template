#!/usr/bin/env python3

import json
import platform
import re
import shutil
import socket
import subprocess
import threading
import webbrowser

from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
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
    Run commands using non-interactive sudo.

    The agent does not prompt for a password.
    Commands requiring unavailable sudo permissions
    may return empty results.
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
        with open(path, encoding="utf-8") as file:
            return clean_value(file.read())

    except (OSError, UnicodeError):
        return ""


def get_dmi_value(field):
    return clean_value(
        run_sudo_command(["dmidecode", "-s", field])
    )


def get_dmidecode_section(section_type):
    return run_sudo_command(
        ["dmidecode", "--type", str(section_type)]
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
        with open("/etc/os-release", encoding="utf-8") as file:
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
# Computer identification
# ============================================================

def detect_product_type(chassis, model):
    chassis_value = clean_value(chassis).lower()
    model_value = clean_value(model).lower()

    chassis_types = {
        "3": "Desktop",
        "4": "Desktop",
        "5": "Mini Tower",
        "6": "Tower",
        "7": "All-in-One",
        "8": "Portable",
        "9": "Laptop",
        "10": "Notebook",
        "11": "Handheld",
        "12": "Docking Station",
        "13": "All-in-One",
        "14": "Sub Notebook",
        "15": "Space-saving",
        "16": "Lunch Box",
        "17": "Main Server Chassis",
        "23": "Rack Mount Server",
        "30": "Tablet",
        "31": "Convertible",
        "32": "Detachable",
        "33": "IoT Gateway",
        "34": "Embedded PC",
        "35": "Mini PC",
        "36": "Stick PC",
    }

    if chassis_value.isdigit():
        result = chassis_types.get(chassis_value, "")

        if result:
            return result

    if any(word in chassis_value for word in (
        "laptop",
        "notebook",
        "portable",
        "sub notebook",
        "tablet",
        "convertible",
        "detachable",
    )):
        return "Laptop"

    if any(word in chassis_value for word in (
        "desktop",
        "tower",
        "pizza box",
        "space-saving",
        "all-in-one",
    )):
        return "Desktop"

    if any(word in model_value for word in (
        "laptop",
        "notebook",
        "thinkpad",
        "latitude",
        "vostro",
        "inspiron",
        "elitebook",
        "probook",
        "macbook",
    )):
        return "Laptop"

    if any(word in model_value for word in (
        "desktop",
        "optiplex",
        "thinkcentre",
        "prodesk",
        "elitedesk",
        "tower",
    )):
        return "Desktop"

    return "Unknown"


def get_system_information():
    manufacturer = first_nonempty(
        get_dmi_value("system-manufacturer"),
        get_dmi_value("baseboard-manufacturer"),
    )

    model = get_dmi_value("system-product-name")
    chassis = get_dmi_value("chassis-type")
    system_sku = get_dmi_value("system-sku-number")
    serial = get_dmi_value("system-serial-number")
    system_uuid = get_dmi_value("system-uuid")

    part_number = first_nonempty(
        system_sku,
        get_dmi_value("baseboard-part-number"),
        get_dmi_value("baseboard-product-name"),
    )

    return {
        "manufacturer": manufacturer,
        "model": model,
        "serial": serial,
        "part_number": part_number,
        "system_sku": system_sku,
        "system_uuid": system_uuid,
        "product_type": detect_product_type(
            chassis,
            model,
        ),
        "chassis_type": chassis,
    }


# ============================================================
# CPU
# ============================================================

def get_cpu_information():
    output = run_command(["lscpu"])
    fields = {}

    for line in output.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip().lower()] = value.strip()

    vendor_id = fields.get("vendor id", "")

    model = first_nonempty(
        fields.get("model name"),
        fields.get("cpu"),
        platform.processor(),
        platform.machine(),
    )

    if "GenuineIntel" in vendor_id or "Intel" in model:
        manufacturer = "Intel"
    elif "AuthenticAMD" in vendor_id or "AMD" in model:
        manufacturer = "AMD"
    elif "Apple" in model:
        manufacturer = "Apple"
    elif "Qualcomm" in model:
        manufacturer = "Qualcomm"
    else:
        manufacturer = vendor_id

    def frequency(value):
        try:
            number = float(value)

            if number <= 0:
                return ""

            return f"{number / 1000:.2f} GHz"

        except (ValueError, TypeError):
            return ""

    current_mhz = fields.get("cpu mhz", "")
    max_mhz = fields.get("cpu max mhz", "")
    min_mhz = fields.get("cpu min mhz", "")

    if not current_mhz:
        current_khz = read_file(
            "/sys/devices/system/cpu/cpu0/cpufreq/"
            "scaling_cur_freq"
        )

        try:
            current_mhz = str(float(current_khz) / 1000)
        except (ValueError, TypeError):
            current_mhz = ""

    if not max_mhz:
        max_khz = read_file(
            "/sys/devices/system/cpu/cpu0/cpufreq/"
            "cpuinfo_max_freq"
        )

        try:
            max_mhz = str(float(max_khz) / 1000)
        except (ValueError, TypeError):
            max_mhz = ""

    if not min_mhz:
        min_khz = read_file(
            "/sys/devices/system/cpu/cpu0/cpufreq/"
            "cpuinfo_min_freq"
        )

        try:
            min_mhz = str(float(min_khz) / 1000)
        except (ValueError, TypeError):
            min_mhz = ""

    if not current_mhz:
        proc_cpuinfo = read_file("/proc/cpuinfo")

        match = re.search(
            r"^\s*cpu MHz\s*:\s*([\d.]+)",
            proc_cpuinfo,
            re.MULTILINE | re.IGNORECASE,
        )

        if match:
            current_mhz = match.group(1)

    return {
        "name": "CPU",
        "manufacturer": manufacturer,
        "model": model,
        "serial": "",
        "part_number": "",
        "architecture": fields.get(
            "architecture",
            platform.machine(),
        ),
        "cores": fields.get("core(s) per socket", ""),
        "threads_per_core": fields.get(
            "thread(s) per core",
            "",
        ),
        "logical_processors": fields.get("cpu(s)", ""),
        "speed": frequency(max_mhz) or frequency(current_mhz),
        "current_speed": frequency(current_mhz),
        "minimum_speed": frequency(min_mhz),
        "maximum_speed": frequency(max_mhz),
        "identifier": vendor_id,
        "socket_count": fields.get("socket(s)", ""),
        "virtualization": fields.get("virtualization", ""),
    }


# ============================================================
# RAM
# ============================================================

def get_ram_information():
    output = get_dmidecode_section("memory")

    modules = []
    slots_total = 0
    device = None

    def finish_device(item):
        if not item:
            return

        size_mb = item.get("size_mb", 0)

        if not isinstance(size_mb, (int, float)) or size_mb <= 0:
            return

        manufacturer = first_nonempty(
            item.get("manufacturer"),
            item.get("manufacturer_id"),
            item.get("vendor"),
        )

        part_number = first_nonempty(
            item.get("part_number"),
            item.get("part_number_raw"),
        )

        model = first_nonempty(
            item.get("model"),
            part_number,
        )

        serial = first_nonempty(
            item.get("serial"),
            item.get("serial_number"),
        )

        modules.append({
            "name": "RAM",
            "manufacturer": manufacturer,
            "model": model,
            "serial": serial,
            "part_number": part_number,
            "asset_tag": clean_value(item.get("asset_tag")),
            "size_mb": size_mb,
            "capacity_gb": round(size_mb / 1024, 2),
            "locator": clean_value(item.get("locator")),
            "bank_locator": clean_value(item.get("bank_locator")),
            "form_factor": clean_value(item.get("form_factor")),
            "type": clean_value(item.get("type")),
            "speed": clean_value(item.get("speed")),
            "configured_speed": clean_value(
                item.get("configured_speed")
            ),
            "rank": clean_value(item.get("rank")),
            "voltage": clean_value(item.get("voltage")),
        })

    for line in output.splitlines():
        stripped = line.strip()

        if stripped.lower() == "memory device":
            finish_device(device)
            device = {}
            slots_total += 1
            continue

        if device is None or ":" not in stripped:
            continue

        key, value = stripped.split(":", 1)
        key = key.strip().lower()
        value = value.strip()

        if key == "size":
            match = re.match(
                r"^(\d+)\s*(MB|GB|TB)$",
                value,
                re.IGNORECASE,
            )

            if match:
                number = int(match.group(1))
                unit = match.group(2).upper()

                multipliers = {
                    "MB": 1,
                    "GB": 1024,
                    "TB": 1024 * 1024,
                }

                device["size_mb"] = number * multipliers[unit]

            elif value.lower() == "no module installed":
                device["size_mb"] = 0

        elif key in ("locator", "device locator"):
            device["locator"] = value

        elif key == "bank locator":
            device["bank_locator"] = value

        elif key in ("manufacturer", "module manufacturer"):
            device["manufacturer"] = value

        elif key in ("serial number", "serial"):
            device["serial"] = value

        elif key in ("part number", "partnumber"):
            device["part_number"] = value

        elif key == "asset tag":
            device["asset_tag"] = value

        elif key in ("form factor", "form_factor"):
            device["form_factor"] = value

        elif key in ("type", "memory type"):
            device["type"] = value

        elif key in ("speed", "memory speed"):
            device["speed"] = value

        elif key in (
            "configured memory speed",
            "configured speed",
        ):
            device["configured_speed"] = value

        elif key == "rank":
            device["rank"] = value

        elif key in ("minimum voltage", "configured voltage"):
            device["voltage"] = value

    finish_device(device)

    total_mb = sum(module["size_mb"] for module in modules)

    return {
        "total_gb": round(total_mb / 1024, 2),
        "modules_installed": len(modules),
        "slots_used": len(modules),
        "slots_available": max(0, slots_total - len(modules)),
        "slots_total": slots_total,
        "modules": modules,
    }


# ============================================================
# Motherboard
# ============================================================

def get_motherboard_information():
    manufacturer = get_dmi_value("baseboard-manufacturer")
    model = get_dmi_value("baseboard-product-name")
    serial = get_dmi_value("baseboard-serial-number")
    part_number = get_dmi_value("baseboard-part-number")
    version = get_dmi_value("baseboard-version")

    return {
        "name": "Motherboard",
        "manufacturer": manufacturer,
        "model": model,
        "serial": serial,
        "part_number": part_number,
        "version": version,
        "type": "Motherboard",
    }


# ============================================================
# Storage
# ============================================================

def get_storage_information():
    """
    Collect physical block-device information using lsblk.

    Partitions and loop devices are excluded.
    Device serial numbers and models depend on OS access.
    """

    output = run_command([
        "lsblk",
        "--json",
        "--bytes",
        "-d",
        "-o",
        "NAME,PATH,TYPE,SIZE,MODEL,SERIAL,WWN,ROTA,TRAN,VENDOR",
    ])

    if not output:
        return []

    try:
        data = json.loads(output)
    except json.JSONDecodeError:
        return []

    devices = []

    for device in data.get("blockdevices", []):
        if clean_value(device.get("type")).lower() != "disk":
            continue

        name = clean_value(device.get("name"))
        path = clean_value(device.get("path"))

        try:
            size_bytes = int(device.get("size") or 0)
        except (TypeError, ValueError):
            size_bytes = 0

        size_gb = round(size_bytes / (1000 ** 3), 2)
        size_tb = round(size_bytes / (1000 ** 4), 3)

        model = clean_value(device.get("model"))
        vendor = clean_value(device.get("vendor"))
        serial = clean_value(device.get("serial"))
        rotation = device.get("rota")
        transport = clean_value(device.get("tran"))

        if rotation is True or str(rotation) == "1":
            drive_type = "HDD"
        elif rotation is False or str(rotation) == "0":
            drive_type = "SSD"
        else:
            drive_type = "Unknown"

        if transport.lower() == "nvme":
            drive_type = "NVMe SSD"

        manufacturer = vendor

        if not manufacturer and model:
            manufacturer = model.split()[0]

        devices.append({
            "name": "Storage",
            "device": name,
            "path": path or (f"/dev/{name}" if name else ""),
            "manufacturer": manufacturer,
            "model": model,
            "serial": serial,
            "part_number": "",
            "type": drive_type,
            "transport": transport,
            "size_bytes": size_bytes,
            "size_gb": size_gb,
            "size_tb": size_tb,
            "wwn": clean_value(device.get("wwn")),
        })

    return devices


# ============================================================
# IMEI
# ============================================================

def get_imei():
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
    cpu = get_cpu_information()
    ram = get_ram_information()
    motherboard = get_motherboard_information()
    storage = get_storage_information()
    os_info = get_os_information()

    collected_at = datetime.now().astimezone().isoformat()

    return {
        "manufacturer": system["manufacturer"],
        "model": system["model"],
        "serial": system["serial"],
        "part_number": system["part_number"],
        "system_sku": system["system_sku"],
        "system_uuid": system["system_uuid"],
        "hwid": system["system_uuid"],
        "product_type": system["product_type"],
        "chassis_type": system["chassis_type"],

        "os_version": os_info["name"],
        "kernel": os_info["kernel"],
        "architecture": os_info["architecture"],

        "cpu": cpu["model"],
        "cpu_info": cpu,

        "ram": ram,
        "motherboard": motherboard,
        "storage": storage,

        "imei": get_imei(),

        # Hostname is intentionally nested here.
        "additional_info": {
            "hostname": socket.gethostname(),
            "collected_at": collected_at,
            "agent_version": "1.1.0",
        },
    }


# ============================================================
# Local HTTP API
# ============================================================

class AuditHandler(BaseHTTPRequestHandler):

    def send_json(self, status, data):
        body = json.dumps(
            data,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )

        self.send_header(
            "Content-Length",
            str(len(body)),
        )

        self.send_header(
            "Cache-Control",
            "no-store",
        )

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
                self.send_json(
                    200,
                    collect_audit(),
                )

            except Exception as error:
                print("[AUDIT ERROR]", repr(error))

                self.send_json(
                    500,
                    {
                        "error": "Failed to collect audit data",
                    },
                )

            return

        self.send_json(
            404,
            {"error": "Not found"},
        )

    def log_message(self, format_string, *args):
        print("[HTTP]", format_string % args)


# ============================================================
# Main
# ============================================================

def main():
    if shutil.which("dmidecode") is None:
        print(
            "Warning: dmidecode is not installed. "
            "Hardware manufacturer, serial and RAM module "
            "information may be incomplete."
        )

    if shutil.which("lscpu") is None:
        print(
            "Warning: lscpu is unavailable. "
            "CPU information may be incomplete."
        )

    if shutil.which("lsblk") is None:
        print(
            "Warning: lsblk is unavailable. "
            "Storage information may be incomplete."
        )

    print("=" * 50)
    print("         COMPUTER AUDIT AGENT")
    print("=" * 50)

    print(f"Hostname: {socket.gethostname()}")
    print(f"API: http://{HOST}:{PORT}")
    print(f"Audit endpoint: http://{HOST}:{PORT}/audit")
    print(f"Website: {AMPLIFY_URL}")

    system = get_system_information()
    cpu = get_cpu_information()
    ram = get_ram_information()
    motherboard = get_motherboard_information()
    storage = get_storage_information()

    print("\nSystem Information:")
    print("  Manufacturer:", system["manufacturer"] or "Unavailable")
    print("  Model:", system["model"] or "Unavailable")
    print("  Serial:", system["serial"] or "Unavailable")
    print("  Product Type:", system["product_type"])

    print("\nCPU Information:")
    print("  Manufacturer:", cpu["manufacturer"] or "Unavailable")
    print("  Model:", cpu["model"] or "Unavailable")
    print("  Speed:", cpu["speed"] or "Unavailable")
    print("  Cores:", cpu["cores"] or "Unavailable")

    print("\nRAM Information:")
    print("  Total RAM:", f'{ram["total_gb"]} GB')
    print("  Modules Installed:", ram["modules_installed"])
    print("  Slots Used:", ram["slots_used"])
    print("  Slots Available:", ram["slots_available"])

    for index, module in enumerate(ram["modules"], start=1):
        print(f"\n  RAM Module {index}:")
        print("    Manufacturer:", module["manufacturer"] or "Unavailable")
        print("    Model:", module["model"] or "Unavailable")
        print("    Serial:", module["serial"] or "Unavailable")
        print("    Part Number:", module["part_number"] or "Unavailable")
        print("    Capacity:", f'{module["capacity_gb"]} GB')
        print("    Type:", module["type"] or "Unavailable")
        print("    Speed:", module["speed"] or "Unavailable")
        print("    Slot:", module["locator"] or "Unavailable")

    print("\nMotherboard Information:")
    print("  Manufacturer:", motherboard["manufacturer"] or "Unavailable")
    print("  Model:", motherboard["model"] or "Unavailable")
    print("  Serial:", motherboard["serial"] or "Unavailable")
    print("  Part Number:", motherboard["part_number"] or "Unavailable")

    print("\nStorage Information:")

    if not storage:
        print("  No physical storage devices detected.")

    for index, drive in enumerate(storage, start=1):
        print(f"  Drive {index}:")
        print("    Device:", drive["path"] or "Unavailable")
        print("    Manufacturer:", drive["manufacturer"] or "Unavailable")
        print("    Model:", drive["model"] or "Unavailable")
        print("    Serial:", drive["serial"] or "Unavailable")
        print("    Type:", drive["type"])
        print("    Size:", f'{drive["size_gb"]} GB')

    print("\nAdditional Information:")
    print("  Hostname:", socket.gethostname())
    print("  Collected At:", datetime.now().astimezone().isoformat())
    print("  Agent Version: 1.1.0")

    try:
        server = ThreadingHTTPServer(
            (HOST, PORT),
            AuditHandler,
        )

    except OSError as error:
        raise SystemExit(
            f"Cannot start server on {HOST}:{PORT}: {error}"
        )

    threading.Timer(
        1.0,
        lambda: webbrowser.open(AMPLIFY_URL),
    ).start()

    print("\nAudit agent is running.")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()

    except KeyboardInterrupt:
        print("\nAudit agent stopped.")

    finally:
        server.server_close()


if __name__ == "__main__":
    main()
