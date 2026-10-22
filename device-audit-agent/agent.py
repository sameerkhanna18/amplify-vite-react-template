#!/usr/bin/env python3

import json
import platform
import re
import shutil
import socket
import subprocess
import threading
import time
import webbrowser

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


def run_sudo_command(command, timeout=15):
    if shutil.which("sudo") is None:
        return ""

    return run_command(["sudo", "-n"] + command, timeout=timeout)


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
        "not available",
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


def get_dmi_section(section):
    return run_sudo_command(
        ["dmidecode", "--type", str(section)],
        timeout=20,
    )


def parse_dmi_fields(output):
    result = {}

    for line in output.splitlines():
        if ":" not in line:
            continue

        key, value = line.split(":", 1)

        result[key.strip().lower()] = clean_value(value)

    return result


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
        "1": "Other",
        "2": "Unknown",
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
        "18": "Expansion Chassis",
        "19": "Sub Chassis",
        "20": "Bus Expansion Chassis",
        "21": "Peripheral Chassis",
        "22": "RAID Chassis",
        "23": "Rack Mount Chassis",
        "24": "Sealed-case PC",
        "25": "Multi-system Chassis",
        "26": "Compact PCI",
        "27": "Advanced TCA",
        "28": "Blade",
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
        product_type = chassis_types.get(chassis_value, "Other")

        if product_type != "Unknown":
            return product_type

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
        read_file("/sys/class/dmi/id/sys_vendor"),
    )

    model = first_nonempty(
        get_dmi_value("system-product-name"),
        read_file("/sys/class/dmi/id/product_name"),
    )

    chassis = first_nonempty(
        get_dmi_value("chassis-type"),
        read_file("/sys/class/dmi/id/chassis_type"),
    )

    # A computer's SKU is not necessarily its motherboard part number.
    # Prefer the actual system SKU when firmware provides one.
    system_sku = first_nonempty(
        get_dmi_value("system-sku-number"),
        read_file("/sys/class/dmi/id/product_sku"),
    )

    system_version = first_nonempty(
        get_dmi_value("system-version"),
        read_file("/sys/class/dmi/id/product_version"),
    )

    system_family = first_nonempty(
        get_dmi_value("system-family"),
        read_file("/sys/class/dmi/id/product_family"),
    )

    system_serial = first_nonempty(
        get_dmi_value("system-serial-number"),
        read_file("/sys/class/dmi/id/product_serial"),
    )

    # Do not silently substitute the motherboard product name for
    # the system SKU. Only use system version/family as a fallback.
    part_number = first_nonempty(
    get_dmi_value("system-sku-number"),
    )

    system_uuid = first_nonempty(
        get_dmi_value("system-uuid"),
        read_file("/sys/class/dmi/id/product_uuid"),
    )

    board_manufacturer = first_nonempty(
        get_dmi_value("baseboard-manufacturer"),
        read_file("/sys/class/dmi/id/board_vendor"),
    )

    board_model = first_nonempty(
        get_dmi_value("baseboard-product-name"),
        read_file("/sys/class/dmi/id/board_name"),
    )

    board_serial = first_nonempty(
        get_dmi_value("baseboard-serial-number"),
        read_file("/sys/class/dmi/id/board_serial"),
    )

    board_part_number = first_nonempty(
        get_dmi_value("baseboard-part-number"),
        read_file("/sys/class/dmi/id/board_part_number"),
    )

    board_version = first_nonempty(
        get_dmi_value("baseboard-version"),
        read_file("/sys/class/dmi/id/board_version"),
    )

    board_asset_tag = first_nonempty(
        get_dmi_value("baseboard-asset-tag"),
        read_file("/sys/class/dmi/id/board_asset_tag"),
    )

    # CPU manufacturer is deliberately not used as the
    # motherboard manufacturer.
    motherboard = {
        "name": "Motherboard",
        "manufacturer": board_manufacturer,
        "model": board_model,
        "serial": board_serial,
        "part_number": board_part_number,
        "version": board_version,
        "asset_tag": board_asset_tag,
        "product": board_model,
    }

    return {
        "manufacturer": manufacturer,
        "model": model,
        "serial": system_serial,
        "part_number": part_number,
        "system_sku": system_sku,
        "system_version": system_version,
        "system_uuid": system_uuid,
        "product_type": detect_product_type(chassis, model),
        "chassis_type": chassis,
        "motherboard": motherboard,
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

    cpu_vendor = first_nonempty(
        fields.get("vendor"),
        vendor_id,
    )

    manufacturer = ""

    if "genuineintel" in vendor_id.lower():
        manufacturer = "Intel"
    elif "authenticamd" in vendor_id.lower():
        manufacturer = "AMD"
    elif "intel" in cpu_vendor.lower():
        manufacturer = "Intel"
    elif "amd" in cpu_vendor.lower():
        manufacturer = "AMD"
    elif "apple" in model.lower():
        manufacturer = "Apple"
    elif "qualcomm" in model.lower():
        manufacturer = "Qualcomm"
    elif "arm" in model.lower():
        manufacturer = "ARM"

    if not manufacturer:
        match = re.search(
            r"\b(Intel|AMD|Apple|Qualcomm|ARM)\b",
            model,
            re.IGNORECASE,
        )

        if match:
            manufacturer = match.group(1)

    def frequency_mhz(value):
        try:
            number = float(value)

            if number <= 0:
                return ""

            return f"{number / 1000:.2f} GHz"

        except (ValueError, TypeError):
            return ""

    def read_cpu_frequency(filename):
        value = read_file(filename)

        try:
            # Linux cpufreq sysfs files report kHz.
            mhz = float(value) / 1000

            if mhz > 0:
                return f"{mhz / 1000:.2f} GHz"

        except (ValueError, TypeError):
            pass

        return ""

    current_mhz = fields.get("cpu mhz", "")
    max_mhz = fields.get("cpu max mhz", "")
    min_mhz = fields.get("cpu min mhz", "")

    current_speed = frequency_mhz(current_mhz)
    maximum_speed = frequency_mhz(max_mhz)
    minimum_speed = frequency_mhz(min_mhz)

    if not current_speed:
        current_speed = read_cpu_frequency(
            "/sys/devices/system/cpu/cpu0/cpufreq/"
            "scaling_cur_freq"
        )

    if not maximum_speed:
        maximum_speed = read_cpu_frequency(
            "/sys/devices/system/cpu/cpu0/cpufreq/"
            "scaling_max_freq"
        )

    if not minimum_speed:
        minimum_speed = read_cpu_frequency(
            "/sys/devices/system/cpu/cpu0/cpufreq/"
            "scaling_min_freq"
        )

    # Some CPUs expose their nominal maximum frequency through
    # cpuinfo_max_freq even when scaling_max_freq is unavailable.
    if not maximum_speed:
        maximum_speed = read_cpu_frequency(
            "/sys/devices/system/cpu/cpu0/cpufreq/"
            "cpuinfo_max_freq"
        )

    reported_speed = first_nonempty(
        maximum_speed,
        current_speed,
        minimum_speed,
    )

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
        "threads_per_core": fields.get("thread(s) per core", ""),
        "logical_processors": fields.get("cpu(s)", ""),
        "speed": reported_speed,
        "current_speed": current_speed,
        "minimum_speed": minimum_speed,
        "maximum_speed": maximum_speed,
        "identifier": vendor_id,
        "socket_count": fields.get("socket(s)", ""),
        "virtualization": fields.get("virtualization", ""),
    }


# ============================================================
# RAM
# ============================================================

def get_ram_information():
    output = get_dmi_section("memory")

    modules = []
    slots_total = 0
    device = None

    def finish_device(item):
        if not item:
            return

        size_mb = item.get("size_mb", 0)

        if not isinstance(size_mb, (int, float)) or size_mb <= 0:
            return

        part_number = first_nonempty(
            item.get("part_number"),
        )

        manufacturer = clean_value(
            item.get("manufacturer")
        )

        modules.append({
            "name": "RAM",
            "manufacturer": manufacturer,
            "model": first_nonempty(
                item.get("model"),
                part_number,
            ),
            "serial": clean_value(item.get("serial")),
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
        if re.match(r"^\s*Memory Device\s*$", line):
            finish_device(device)
            device = {}
            slots_total += 1
            continue

        if device is None or ":" not in line:
            continue

        key, value = line.split(":", 1)

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

                multiplier = {
                    "MB": 1,
                    "GB": 1024,
                    "TB": 1024 * 1024,
                }[unit]

                device["size_mb"] = number * multiplier

            elif value.lower() == "no module installed":
                device["size_mb"] = 0

        elif key == "locator":
            device["locator"] = value

        elif key == "device locator":
            device["locator"] = value

        elif key == "bank locator":
            device["bank_locator"] = value

        elif key == "form factor":
            device["form_factor"] = value

        elif key == "type":
            device["type"] = value

        elif key == "speed":
            device["speed"] = value

        elif key == "configured memory speed":
            device["configured_speed"] = value

        elif key == "manufacturer":
            device["manufacturer"] = value

        elif key == "serial number":
            device["serial"] = value

        elif key == "part number":
            device["part_number"] = value

        elif key == "asset tag":
            device["asset_tag"] = value

        elif key == "rank":
            device["rank"] = value

        elif key in (
            "minimum voltage",
            "configured voltage",
        ):
            device["voltage"] = value

    finish_device(device)

    # Fall back to /proc/meminfo for total memory when DMI is
    # unavailable. This does not invent physical module details.
    total_mb = sum(module["size_mb"] for module in modules)

    if total_mb <= 0:
        meminfo = read_file("/proc/meminfo")

        match = re.search(
            r"^MemTotal:\s*(\d+)\s+kB",
            meminfo,
            re.MULTILINE,
        )

        if match:
            total_mb = int(match.group(1)) / 1024

    return {
        "total_gb": round(total_mb / 1024, 2),
        "modules_installed": len(modules),
        "slots_used": len(modules),
        "slots_available": max(0, slots_total - len(modules)),
        "slots_total": slots_total,
        "modules": modules,
    }


# ============================================================
# Storage
# ============================================================

def get_udev_properties(device_path):
    output = run_command([
        "udevadm",
        "info",
        "--query=property",
        "--name",
        device_path,
    ])

    properties = {}

    for line in output.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            properties[key.strip()] = value.strip()

    return properties


def get_nvme_information(device_path):
    if not shutil.which("nvme"):
        return {}

    output = run_command([
        "nvme",
        "id-ctrl",
        device_path,
        "-o",
        "json",
    ])

    if not output:
        return {}

    try:
        return json.loads(output)
    except json.JSONDecodeError:
        return {}


def get_disk_information():
    output = run_command([
        "lsblk",
        "-J",
        "-b",
        "-o",
        "NAME,PATH,SIZE,TYPE,TRAN,RM,MODEL,SERIAL,"
        "VENDOR,WWN,ROTA,REV",
    ])

    if not output:
        return []

    try:
        devices = json.loads(output).get("blockdevices", [])
    except (json.JSONDecodeError, AttributeError):
        return []

    disks = []

    for item in devices:
        if item.get("type") != "disk":
            continue

        if str(item.get("rm", "0")) == "1":
            continue

        if (item.get("tran") or "").lower() == "usb":
            continue

        name = item.get("name", "")
        path = item.get("path") or f"/dev/{name}"

        properties = get_udev_properties(path)
        sys_path = f"/sys/block/{name}"

        vendor = first_nonempty(
            item.get("vendor"),
            properties.get("ID_VENDOR_FROM_DATABASE"),
            properties.get("ID_VENDOR"),
            read_file(f"{sys_path}/device/vendor"),
        )

        model = first_nonempty(
            item.get("model"),
            properties.get("ID_MODEL_FROM_DATABASE"),
            properties.get("ID_MODEL"),
            read_file(f"{sys_path}/device/model"),
        )

        serial = first_nonempty(
            item.get("serial"),
            properties.get("ID_SERIAL_SHORT"),
            properties.get("ID_SERIAL"),
            read_file(f"{sys_path}/device/serial"),
        )

        wwn = first_nonempty(
            item.get("wwn"),
            properties.get("ID_WWN"),
            properties.get("ID_WWN_WITH_EXTENSION"),
        )

        try:
            size_bytes = int(item.get("size") or 0)
        except (TypeError, ValueError):
            size_bytes = 0

        if not vendor:
            match = re.match(
                r"^\s*(Samsung|Kingston|Crucial|Micron|"
                r"Intel|Seagate|Western Digital|WDC|"
                r"Toshiba|SanDisk|SK hynix|Kioxia|"
                r"Solidigm)\b",
                model,
                re.IGNORECASE,
            )

            if match:
                vendor = match.group(1)

        transport = first_nonempty(
            item.get("tran"),
            properties.get("ID_BUS"),
        )

        if not transport:
            if name.startswith("nvme"):
                transport = "NVMe"
            elif name.startswith("sd"):
                transport = "SATA/SCSI"
            elif name.startswith("mmcblk"):
                transport = "MMC"

        if transport.upper() == "NVME":
            transport = "NVMe"

        # lsblk does not report actual storage transfer speed.
        # Report interface type rather than inventing a speed.
        speed = ""

        disks.append({
            "name": "Storage",
            "device": path,
            "manufacturer": clean_value(vendor),
            "model": clean_value(model),
            "serial": clean_value(serial),
            "part_number": clean_value(
                properties.get("ID_PART_NUMBER")
            ),
            "capacity_bytes": size_bytes,
            "capacity_gb": round(
                size_bytes / 1_000_000_000,
                2,
            ),
            "capacity_gib": round(
                size_bytes / (1024 ** 3),
                2,
            ),
            "type": transport,
            "interface": transport,
            "speed": speed,
            "revision": clean_value(item.get("rev")),
            "rotational": item.get("rota"),
            "wwn": clean_value(wwn),
            "hardware_id": clean_value(wwn),
            "vendor_id": clean_value(vendor),
        })

    return disks


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
    disks = get_disk_information()
    os_info = get_os_information()

    collected_at = datetime.now().astimezone().isoformat()

    return {
        "host": socket.gethostname(),

        "manufacturer": system["manufacturer"],
        "model": system["model"],
        "serial": system["serial"],
        "part_number": system["part_number"],
        "system_sku": system["system_sku"],
        "system_version": system["system_version"],
        "system_uuid": system["system_uuid"],
        "hwid": system["system_uuid"],
        "product_type": system["product_type"],
        "chassis_type": system["chassis_type"],
        "motherboard": system["motherboard"],

        "os_version": os_info["name"],
        "kernel": os_info["kernel"],
        "architecture": os_info["architecture"],

        "cpu": cpu["model"],
        "cpu_info": cpu,

        "ram": ram,
        "disks": disks,

        "imei": get_imei(),
        "collected_at": collected_at,
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

        self.send_header("Cache-Control", "no-store")

        origin = self.headers.get("Origin", "")

        if origin == ALLOWED_ORIGIN:
            self.send_header(
                "Access-Control-Allow-Origin",
                ALLOWED_ORIGIN,
            )

        self.send_header("Vary", "Origin")
        self.end_headers()

        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

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
            self.send_json(200, {
                "status": "running",
                "service": "computer-audit",
                "endpoints": ["/audit"],
            })
            return

        if path == "/audit":
            try:
                self.send_json(200, collect_audit())

            except Exception as error:
                print(f"[AUDIT ERROR] {error}")

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
        print(
            "Warning: dmidecode is not installed. "
            "Some firmware information may be unavailable."
        )

    if shutil.which("lsblk") is None:
        print(
            "Warning: lsblk is not installed. "
            "Storage detection may be unavailable."
        )

    if shutil.which("lscpu") is None:
        print(
            "Warning: lscpu is not installed. "
            "CPU information may be incomplete."
        )

    print("==========================================")
    print("         COMPUTER AUDIT AGENT")
    print("==========================================")

    print(f"Hostname: {socket.gethostname()}")
    print(f"API: http://{HOST}:{PORT}")
    print(f"Audit endpoint: http://{HOST}:{PORT}/audit")
    print(f"Website: {AMPLIFY_URL}")

    try:
        server = ThreadingHTTPServer(
            (HOST, PORT),
            AuditHandler,
        )
    except OSError as error:
        raise SystemExit(
            f"Cannot start server on {HOST}:{PORT}: {error}"
        )

    server.daemon_threads = True

    threading.Timer(
        1.0,
        lambda: webbrowser.open(AMPLIFY_URL),
    ).start()

    try:
        server.serve_forever()

    except KeyboardInterrupt:
        print("\nAudit agent stopped.")

    finally:
        server.server_close()


if __name__ == "__main__":
    main()
