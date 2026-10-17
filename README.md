# SysTrace — OS Analyzer

A system-call analysis and visualization dashboard for exploring Inter-Process Communication (IPC) in operating systems.

## About the Project

SysTrace analyzes system-call traces collected from IPC demo programs and presents the results through a React-based dashboard. It helps users understand how processes communicate using pipes and shared memory.

## Features

- **System Call Analysis:** Counts and summarizes system calls from captured trace files.
- **IPC Analysis:** Examines pipe-based and shared-memory communication.
- **Interactive Dashboard:** Displays system-call statistics, IPC comparisons, process flow, and event timelines.
- **Trace Processing:** Uses Python to analyze `strace` output and generate JSON data.
- **Visual Comparison:** Presents captured pipe and shared-memory traces for easier understanding.

## Technologies Used

- **Frontend:** React, JavaScript, CSS, Vite
- **Analysis:** Python
- **Operating System Tools:** Linux, `strace`
- **IPC Programming:** C, pipes, shared memory
- **Version Control:** Git and GitHub

## Project Structure

```text
SysTrace/
├── dashboard/
│   ├── public/
│   │   └── traces.json
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       └── index.css
├── ipc/
│   ├── analyze_traces.py
│   ├── pipe_demo.c
│   ├── pipe_trace.txt
│   ├── shm_demo.c
│   └── shm_trace.txt
├── .gitignore
└── README.md
```

## Requirements

- Node.js and npm
- Python 3
- GCC compiler
- Linux or Ubuntu on WSL
- `strace`

## How to Run

### 1. Clone the repository

```bash
git clone https://github.com/pradeepasivakumar21/SysTrace-OS-Analyzer.git
cd SysTrace-OS-Analyzer
```

### 2. Run the IPC demo programs

Compile the pipe demo:

```bash
gcc ipc/pipe_demo.c -o ipc/pipe_demo
```

Compile the shared-memory demo:

```bash
gcc ipc/shm_demo.c -o ipc/shm_demo
```

### 3. Capture system-call traces

```bash
strace -f -o ipc/pipe_trace.txt ./ipc/pipe_demo
strace -f -o ipc/shm_trace.txt ./ipc/shm_demo
```

### 4. Analyze the traces

From the project root, run:

```bash
python3 ipc/analyze_traces.py
```

The analyzer processes the captured traces and generates `dashboard/public/traces.json` for the dashboard.

### 5. Start the dashboard

Open a terminal in the dashboard folder:

```bash
cd dashboard
npm install
npm run dev
```

Open the local URL displayed by Vite in your browser.

## Current Project Status

The current version displays summaries and visualizations based on captured system-call traces. Live tracing and backend integration are not yet connected.

## Future Enhancements

- Integrate the dashboard with the backend API.
- Improve identification and classification of IPC-related system calls.
- Add failure detection and error statistics.
- Support live trace updates.
- Expand testing with additional IPC programs.

## Contributors

Developed as an operating systems project focused on system-call analysis, IPC behavior, and visualization.

## Repository

GitHub: https://github.com/pradeepasivakumar21/SysTrace-OS-Analyzer
