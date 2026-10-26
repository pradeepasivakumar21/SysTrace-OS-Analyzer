
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import re

app = FastAPI(
    title="SysTrace API",
    description="Backend API for system call tracing and process analysis.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent

TRACE_FILES = {
    "Pipe Demo": BASE_DIR / "ipc" / "pipe_trace.txt",
    "Shared Memory Demo": BASE_DIR / "ipc" / "shm_trace.txt"
}


@app.get("/")
def home():
    return {
        "project": "SysTrace",
        "message": "System Call Tracing and Process Analyzer API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "SysTrace Backend"
    }


@app.get("/api/traces")
def get_traces():
    traces = []

    for name, path in TRACE_FILES.items():
        calls = []
        errors = 0

        if path.exists():
            with path.open("r", encoding="utf-8") as file:
                for line in file:
                    match = re.search(
                        r"\b([A-Za-z_][A-Za-z0-9_]*)\(.*\)\s+=\s+(-?\d+)",
                        line
                    )

                    if match:
                        syscall = match.group(1)
                        result = int(match.group(2))
                        calls.append(syscall)

                        if result == -1:
                            errors += 1

        traces.append({
            "trace": name,
            "total_calls": len(calls),
            "total_errors": errors,
            "system_calls": calls
        })

    return {"traces": traces}
