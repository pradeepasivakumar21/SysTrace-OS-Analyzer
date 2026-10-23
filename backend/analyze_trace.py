import re
import sys
from collections import defaultdict

if len(sys.argv) != 2:
    print("Usage: python3 analyze_trace.py <trace_file>")
    sys.exit(1)

trace_file = sys.argv[1]

stats = defaultdict(lambda: {
    "calls": 0,
    "errors": 0,
    "total_time": 0.0
})

total_calls = 0
total_errors = 0
total_time = 0.0

try:
    with open(trace_file, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()

            # Extract the system-call name.
            syscall_match = re.match(
                r"^\d{2}:\d{2}:\d{2}\.\d+\s+([A-Za-z_][A-Za-z0-9_]*)\(",
                line
            )

            # Extract the return value.
            result_match = re.search(r"\)\s+=\s+(-?\d+)", line)

            # Extract the duration at the end of the line.
            duration_match = re.search(r"<([\d.]+)>$", line)

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

except FileNotFoundError:
    print(f"Error: Trace file '{trace_file}' was not found.")
    sys.exit(1)

print("\n========== SysTrace Analyzer ==========")
print(f"Trace file: {trace_file}")
print(f"Total system calls analyzed: {total_calls}")
print(f"Failed system calls:         {total_errors}")
print(f"Total measured time:         {total_time * 1_000_000:.2f} microseconds")

print("\n--------------- Statistics ---------------")
print(
    f"{'System Call':<18}"
    f"{'Calls':>8}"
    f"{'Errors':>8}"
    f"{'Total (us)':>15}"
    f"{'Average (us)':>16}"
)
print("-" * 65)

for name, data in sorted(
    stats.items(),
    key=lambda item: item[1]["total_time"],
    reverse=True
):
    calls = data["calls"]
    errors = data["errors"]
    total_us = data["total_time"] * 1_000_000
    average_us = total_us / calls

    print(
        f"{name:<18}"
        f"{calls:>8}"
        f"{errors:>8}"
        f"{total_us:>15.2f}"
        f"{average_us:>16.2f}"
    )

print("-" * 65)
print("Analysis completed successfully!")
