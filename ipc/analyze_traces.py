
import re
import json
from collections import Counter
from pathlib import Path

results = []

for filename in ["pipe_trace.txt", "shm_trace.txt"]:
    path = Path("ipc") / filename
    text = path.read_text()

    calls = re.findall(
        r"^\s*(?:\[pid\s+\d+\]\s+|\d+\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\(",
        text,
        re.MULTILINE
    )

    counts = Counter(calls)

    events = []

    for line in text.splitlines():
        match = re.match(
            r"^\s*(?:\[pid\s+(\d+)\]\s+|(\d+)\s+)?"
            r"([a-zA-Z_][a-zA-Z0-9_]*)\(",
            line
        )

        if match:
            events.append({
                "process_id": match.group(1) or match.group(2) or "unknown",
                "name": match.group(3),
                "details": line.strip()
            })

    results.append({
        "trace": filename,
        "total_calls": len(calls),
        "system_calls": [
            {"name": name, "count": count}
            for name, count in counts.most_common()
        ],
        "events": events
    })

output = Path("dashboard/public/traces.json")
output.write_text(json.dumps(results, indent=2))

print("Trace data saved to dashboard/public/traces.json")

for result in results:
    print(f"{result['trace']}: {result['total_calls']} system-call entries")
    print(f"Timeline events: {len(result['events'])}")
