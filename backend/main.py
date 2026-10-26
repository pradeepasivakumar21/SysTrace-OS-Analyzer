import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException

try:
    from .analyze_trace import analyze_trace_file
    from .analyze_process import analyze_process_trace
except ImportError:
    from analyze_trace import analyze_trace_file
    from analyze_process import analyze_process_trace


PROJECT_ROOT = Path(__file__).resolve().parent.parent

DEMOS = {
    "process": {
        "name": "Process Creation",
        "description": "Demonstrates fork, child processes, and waitpid.",
        "source": "backend/process_demo.c",
        "libraries": [],
    },
    "file": {
        "name": "File Operations",
        "description": "Demonstrates file creation, writing, and closing.",
        "source": "backend/file_demo.c",
        "libraries": [],
    },
    "pipe": {
        "name": "Pipe IPC",
        "description": "Demonstrates communication through a pipe.",
        "source": "ipc/pipe_demo.c",
        "libraries": [],
    },
    "shared-memory": {
        "name": "Shared Memory IPC",
        "description": "Demonstrates shared memory between processes.",
        "source": "ipc/shm_demo.c",
        "libraries": ["-lrt"],
    },
}


app = FastAPI(
    title="SysTrace API",
    description="Backend API for system call tracing and process analysis.",
    version="1.1.0",
)


@app.get("/")
def home():
    return {
        "project": "SysTrace",
        "message": "System Call Tracing and Process Analyzer API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "SysTrace Backend",
    }


@app.get("/api/demos")
def list_demos():
    """List the predefined demonstration programs available for tracing."""

    return {
        "demos": [
            {
                "id": demo_id,
                "name": details["name"],
                "description": details["description"],
            }
            for demo_id, details in DEMOS.items()
        ]
    }


@app.get("/api/trace-program/{demo_id}")
def trace_demo_program(demo_id: str):
    """Compile, execute, and analyze one predefined C demonstration."""

    demo = DEMOS.get(demo_id)

    if demo is None:
        raise HTTPException(
            status_code=404,
            detail="Unknown demo. Request GET /api/demos for available demos.",
        )

    gcc_path = shutil.which("gcc")
    strace_path = shutil.which("strace")

    if gcc_path is None:
        raise HTTPException(
            status_code=503,
            detail="gcc is not installed or is not available in PATH.",
        )

    if strace_path is None:
        raise HTTPException(
            status_code=503,
            detail="strace is not installed or is not available in PATH.",
        )

    source_path = PROJECT_ROOT / demo["source"]

    if not source_path.is_file():
        raise HTTPException(
            status_code=500,
            detail=f"Demo source file is missing: {demo['source']}",
        )

    try:
        with tempfile.TemporaryDirectory(prefix="systrace-demo-") as temp_dir:
            work_dir = Path(temp_dir)
            binary_path = work_dir / "demo_program"
            trace_path = work_dir / "program.trace"

            compilation = subprocess.run(
                [
                    gcc_path,
                    str(source_path),
                    "-o",
                    str(binary_path),
                    *demo["libraries"],
                ],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )

            if compilation.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "message": "Demo compilation failed.",
                        "error": compilation.stderr.strip(),
                    },
                )

            completed = subprocess.run(
                [
                    strace_path,
                    "-f",
                    "-tt",
                    "-T",
                    "-o",
                    str(trace_path),
                    str(binary_path),
                ],
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )

            if completed.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "message": "The demo program could not be traced successfully.",
                        "exit_code": completed.returncode,
                        "error": completed.stderr.strip(),
                        "program_output": completed.stdout.strip(),
                    },
                )

            analysis = analyze_process_trace(trace_path)

            return {
                "status": "success",
                "demo_id": demo_id,
                "demo_name": demo["name"],
                "demo_command": (
                    f"gcc {demo['source']} -o demo_program"
                    f"{' ' + ' '.join(demo['libraries']) if demo['libraries'] else ''}"
                    " && strace -f ./demo_program"
                ),
                "program_output": completed.stdout.strip(),
                "analysis": analysis,
            }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="The demo compilation or execution exceeded 10 seconds.",
        )

    except OSError as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to run the demo: {error}",
        )


@app.get("/api/demo-trace")
def run_demo_trace():
    """Preserve the original basic system-call tracing demonstration."""

    strace_path = shutil.which("strace")

    if strace_path is None:
        raise HTTPException(
            status_code=503,
            detail="strace is not installed or is not available in PATH.",
        )

    trace_path = None

    try:
        with tempfile.NamedTemporaryFile(
            prefix="systrace-api-",
            suffix=".trace",
            delete=False,
        ) as trace_file:
            trace_path = Path(trace_file.name)

        completed = subprocess.run(
            [
                strace_path,
                "-tt",
                "-T",
                "-o",
                str(trace_path),
                "/bin/echo",
                "SysTrace API demo",
            ],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )

        if completed.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "The demo command could not be traced.",
                    "error": completed.stderr.strip(),
                },
            )

        analysis = analyze_trace_file(trace_path)

        return {
            "status": "success",
            "demo_command": "/bin/echo SysTrace API demo",
            "program_output": completed.stdout.strip(),
            "analysis": analysis,
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="The demo trace exceeded the 10-second time limit.",
        )

    except OSError as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to run the demo trace: {error}",
        )

    finally:
        if trace_path is not None:
            trace_path.unlink(missing_ok=True)
