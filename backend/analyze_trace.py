import re
import sys
from pathlib import Path
from collections import defaultdict


SYSCALL_PATTERN = re.compile(
    r"^\d{2}:\d{2}:\d{2}\.\d+\s+([A-Za-z_][A-Za-z0-9_]*)\("
)

RESULT_PATTERN = re.compile(r"\)\s+=\s+(-?\d+)(?:\s|$)")
DURATION_PATTERN = re.compile(r"<([\d.]+)>$")


def analyze_trace_file(trace_file):
    """Analyze a timestamped strace log and return structured statistics."""

    trace_path = Path(trace_file)

    stats = defaultdict(
        lambda: {"calls": 0, "errors": 0, "total_time": 0.0}
    )

    total_calls = 0
    total_errors = 0
    total_time = 0.0

    with trace_path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()

            syscall_match = SYSCALL_PATTERN.match(line)
            result_match = RESULT_PATTERN.search(line)
            duration_match = DURATION_PATTERN.search(line)

            if not (syscall_match and result_match and duration_match):
                continue

            syscall = syscall_match.group(1)
            result = int(result_match.group(1))
            duration = float(duration_match.group(1))

            stats[syscall]["calls"] += 1
            stats[syscall]["total_time"] += duration

            total_calls += 1
            total_time += duration

            if result == -1:
                stats[syscall]["errors"] += 1
                total_errors += 1

    syscall_results = []

    for name, data in sorted(
        stats.items(),
        key=lambda item: item[1]["total_time"],
        reverse=True,
    ):
        calls = data["calls"]
        total_us = data["total_time"] * 1_000_000

        syscall_results.append({
            "name": name,
            "calls": calls,
            "errors": data["errors"],
            "total_time_microseconds": round(total_us, 2),
            "average_time_microseconds": round(total_us / calls, 2),
        })

    return {
        "trace_file": str(trace_path),
        "total_calls": total_calls,
        "failed_calls": total_errors,
        "total_time_microseconds": round(total_time * 1_000_000, 2),
        "syscalls": syscall_results,
    }


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 analyze_trace.py <trace_file>")
        sys.exit(1)

    trace_file = sys.argv[1]

    try:
        result = analyze_trace_file(trace_file)
    except FileNotFoundError:
        print(f"Error: Trace file '{trace_file}' was not found.")
        sys.exit(1)

    print("\n========== SysTrace Analyzer ==========")
    print(f"Trace file: {result['trace_file']}")
    print(f"Total system calls analyzed: {result['total_calls']}")
    print(f"Failed system calls:         {result['failed_calls']}")
    print(
        "Total measured time:         "
        f"{result['total_time_microseconds']:.2f} microseconds"
    )

    print("\n--------------- Statistics ---------------")
    print(
        f"{'System Call':<18}"
        f"{'Calls':>8}"
        f"{'Errors':>8}"
        f"{'Total (us)':>15}"
        f"{'Average (us)':>16}"
    )
    print("-" * 65)

    for item in result["syscalls"]:
        print(
            f"{item['name']:<18}"
            f"{item['calls']:>8}"
            f"{item['errors']:>8}"
            f"{item['total_time_microseconds']:>15.2f}"
            f"{item['average_time_microseconds']:>16.2f}"
        )

    print("-" * 65)
    print("Analysis completed successfully!")


if __name__ == "__main__":
    main()
