
def get_os():
    for line in read_file("/etc/os-release").splitlines():
        if line.startswith("PRETTY_NAME="):
            return line.split("=", 1)[1].strip().strip('"')
    return platform.platform()


def collect_audit():
    return {
        "Host": socket.gethostname(),
        "Make": read_dmi("sys_vendor"),
        "Model": read_dmi("product_name"),
        "Serial": read_dmi("product_serial"),
        "OsVersion": get_os(),
        "Kernel": platform.release(),
        "CPU": get_cpu(),
        "Ram": str(get_ram_gb() or ""),
        "Storage": str(get_storage_gb() or ""),
    }


def main():
    audit = collect_audit()

    print("\nDeviceAudit - Agent")
    print("===================")
    print(json.dumps(audit, indent=2))
    print("\nAudit collected successfully.")


if __name__ == "__main__":
    main()
