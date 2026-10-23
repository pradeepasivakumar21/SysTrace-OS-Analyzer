import re
import sys
from collections import defaultdict

if len(sys.argv) != 2:
    print("Usage: python3 analyze_process.py <trace_file>")
    sys.exit(1)

trace_file = sys.argv[1]

syscall_stats = defaultdict(lambda: {
    "calls": 0,
    "errors": 0,
    "total_time": 0.0
})

process_stats = defaultdict(lambda: {
    "calls": 0,
    "errors": 0
})

parent_of = {}
all_pids = set()

total_calls = 0
total_errors = 0
total_time = 0.0

# Match normal syscall entries containing a PID and timestamp.
normal_pattern = re.compile(
    r"^\s*(\d+)\s+\d{2}:\d{2}:\d{2}\.\d+\s+"
    r"([A-Za-z_][A-Za-z0-9_]*)\("
)

# Match resumed syscalls, such as a resumed wait4().
resumed_pattern = re.compile(
    r"^\s*(\d+)\s+\d{2}:\d{2}:\d{2}\.\d+\s+"
    r"<\.\.\.\s+([A-Za-z_][A-Za-z0-9_]*)\s+resumed>"
)

# Extract the final syscall result, allowing an optional duration.
result_pattern = re.compile(r"\)\s+=\s+(-?\d+|\?)(?=\s|$)")

duration_pattern = re.compile(r"<([\d.]+)>\s*$")

try:
    with open(trace_file, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()

            normal = normal_pattern.match(line)
            resumed = resumed_pattern.match(line)

            if normal:
                pid = int(normal.group(1))
                syscall = normal.group(2)

                # Count this call when its resumed entry appears.
                if "<unfinished ...>" in line:
                    continue

            elif resumed:
                pid = int(resumed.group(1))
                syscall = resumed.group(2)

            else:
                continue

            result_match = result_pattern.search(line)
            if not result_match:
                continue

            result = result_match.group(1)

            duration_match = duration_pattern.search(line)
            duration = (
                float(duration_match.group(1))
                if duration_match
                else 0.0
            )

            all_pids.add(pid)
            total_calls += 1

            syscall_stats[syscall]["calls"] += 1
            process_stats[pid]["calls"] += 1

            total_time += duration
            syscall_stats[syscall]["total_time"] += duration

            if result == "-1":
                total_errors += 1
                syscall_stats[syscall]["errors"] += 1
                process_stats[pid]["errors"] += 1

            # Identify child processes created by fork/clone calls.
            if syscall in ("clone", "clone3", "fork", "vfork"):
                if result.isdigit() and int(result) > 0:
                    child_pid = int(result)
                    parent_of[child_pid] = pid
                    all_pids.add(child_pid)

except FileNotFoundError:
    print(f"Error: File '{trace_file}' was not found.")
    sys.exit(1)

print("\n========== SysTrace Process Analyzer ==========")
print(f"Trace file: {trace_file}")
print(f"Processes observed: {len(all_pids)}")
print(f"Completed syscall events: {total_calls}")
print(f"Failed syscall events: {total_errors}")
print(f"Measured syscall duration: {total_time * 1_000_000:.2f} us")

print("\n----------- Process Relationships -----------")

if parent_of:
    for child, parent in sorted(parent_of.items()):
        print(f"Parent PID {parent} -> Child PID {child}")
else:
    print("No process-creation relationships detected.")

print("\n------------- Per-Process Stats -------------")
print(f"{'PID':<12}{'Calls':>10}{'Errors':>10}")
print("-" * 32)

for pid, data in sorted(process_stats.items()):
    print(
        f"{pid:<12}"
        f"{data['calls']:>10}"
        f"{data['errors']:>10}"
    )

print("\n------------- Syscall Statistics ------------")
print(
    f"{'System Call':<18}"
    f"{'Calls':>8}"
    f"{'Errors':>8}"
    f"{'Total (us)':>15}"
)

print("-" * 49)

for name, data in sorted(
    syscall_stats.items(),
    key=lambda item: item[1]["total_time"],
    reverse=True
):
    print(
        f"{name:<18}"
        f"{data['calls']:>8}"
        f"{data['errors']:>8}"
        f"{data['total_time'] * 1_000_000:>15.2f}"
    )

print("-" * 49)
print("Process analysis completed!")
