from fastapi import FastAPI

app = FastAPI(
    title="SysTrace API",
    description="Backend API for system call tracing and process analysis.",
    version="1.0.0"
)


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
