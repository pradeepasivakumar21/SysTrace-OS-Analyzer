import re
import sys
from pathlib import Path
from collections import defaultdict


NORMAL_PATTERN = re.compile(
    r"^\s*(\d+)\s+\d{2}:\d{2}:\d{2}\.\d+\s+"
    r"([A-Za-z_][A-Za-z0-9_]*)\("
)

RESUMED_PATTERN = re.compile(
    r"^\s*(\d+)\s+\d{2}:\d{2}:\d{2}\.\d+\s+"
    r"<\.\.\.\s+([A-Za-z_][A-Za-z0-9_]*)\s+resumed>"
)

RESULT_PATTERN = re.compile(
    r"\)\s+=\s+(-1|0x[0-9A-Fa-f]+|-?\d+|\?)(?=\s|$)"
)

DURATION_PATTERN = re.compile(r"<([\d.]+)>\s*$")


def analyze_process_trace(trace_file):
    """Analyze a strace log and return structured process statistics."""

    trace_path = Path(trace_file)

    syscall_stats = defaultdict(
        lambda: {"calls": 0, "errors": 0, "total_time": 0.0}
    )

    process_stats = defaultdict(
        lambda: {"calls": 0, "errors": 0}
    )

    parent_of = {}
    all_pids = set()
    total_calls = 0
    total_errors = 0
    total_time = 0.0
    events = []

    with trace_path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()

            normal = NORMAL_PATTERN.match(line)
            resumed = RESUMED_PATTERN.match(line)

            if normal:
                pid = int(normal.group(1))
                syscall = normal.group(2)

                if "<unfinished ...>" in line:
                    continue

            elif resumed:
                pid = int(resumed.group(1))
                syscall = resumed.group(2)

            else:
                continue

            result_match = RESULT_PATTERN.search(line)

            if not result_match:
                continue

            result = result_match.group(1)

            duration_match = DURATION_PATTERN.search(line)
            duration = (
                float(duration_match.group(1))
                if duration_match
                else 0.0
            )
            events.append({
                "process_id": str(pid),
                "name": syscall,
                "details": line,
            })

            all_pids.add(pid)
            total_calls += 1

            syscall_stats[syscall]["calls"] += 1
            process_stats[pid]["calls"] += 1
            syscall_stats[syscall]["total_time"] += duration
            total_time += duration

            if result == "-1":
                total_errors += 1
                syscall_stats[syscall]["errors"] += 1
                process_stats[pid]["errors"] += 1

            if syscall in ("clone", "clone3", "fork", "vfork"):
                if result.isdigit() and int(result) > 0:
                    child_pid = int(result)
                    parent_of[child_pid] = pid
                    all_pids.add(child_pid)

    syscalls = []

    for name, data in sorted(
        syscall_stats.items(),
        key=lambda item: item[1]["total_time"],
        reverse=True,
    ):
        calls = data["calls"]
        total_us = data["total_time"] * 1_000_000

        syscalls.append({
            "name": name,
            "calls": calls,
            "errors": data["errors"],
            "total_time_microseconds": round(total_us, 2),
            "average_time_microseconds": round(total_us / calls, 2),
        })

    processes = [
        {
            "pid": pid,
            "calls": data["calls"],
            "errors": data["errors"],
        }
        for pid, data in sorted(process_stats.items())
    ]

    relationships = [
        {"parent_pid": parent, "child_pid": child}
        for child, parent in sorted(parent_of.items())
    ]

    return {
        "trace_file": str(trace_path),
        "processes_observed": len(all_pids),
        "total_calls": total_calls,
        "failed_calls": total_errors,
        "total_time_microseconds": round(total_time * 1_000_000, 2),
        "process_relationships": relationships,
        "processes": processes,
        "syscalls": syscalls,
        "events": events,
    }


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 analyze_process.py <trace_file>")
        sys.exit(1)

    try:
        result = analyze_process_trace(sys.argv[1])
    except FileNotFoundError:
        print(f"Error: Trace file '{sys.argv[1]}' was not found.")
        sys.exit(1)

    print("\n========== SysTrace Process Analyzer ==========")
    print(f"Trace file: {result['trace_file']}")
    print(f"Processes observed: {result['processes_observed']}")
    print(f"Completed syscall events: {result['total_calls']}")
    print(f"Failed syscall events: {result['failed_calls']}")
    print(
        "Measured syscall duration: "
        f"{result['total_time_microseconds']:.2f} us"
    )

    print("\n----------- Process Relationships -----------")

    if result["process_relationships"]:
        for relationship in result["process_relationships"]:
            print(
                f"Parent PID {relationship['parent_pid']} -> "
                f"Child PID {relationship['child_pid']}"
            )
    else:
        print("No process-creation relationships detected.")

    print("\n------------- Per-Process Stats -------------")
    print(f"{'PID':<12}{'Calls':>10}{'Errors':>10}")
    print("-" * 32)

    for process in result["processes"]:
        print(
            f"{process['pid']:<12}"
            f"{process['calls']:>10}"
            f"{process['errors']:>10}"
        )

    print("\n------------- Syscall Statistics ------------")
    print(
        f"{'System Call':<18}"
        f"{'Calls':>8}"
        f"{'Errors':>8}"
        f"{'Total (us)':>15}"
    )
    print("-" * 49)

    for syscall in result["syscalls"]:
        print(
            f"{syscall['name']:<18}"
            f"{syscall['calls']:>8}"
            f"{syscall['errors']:>8}"
            f"{syscall['total_time_microseconds']:>15.2f}"
        )

    print("-" * 49)
    print("Process analysis completed!")


if __name__ == "__main__":
    main()
