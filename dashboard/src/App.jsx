
import { useEffect, useState } from 'react'
import './index.css'

function App() {
  const [traces, setTraces] = useState([])

  useEffect(() => {
    fetch('/traces.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Could not load trace data')
        }
        return response.json()
      })
      .then(data => setTraces(data))
      .catch(error => console.error('Error loading traces:', error))
  }, [])

  const totalCalls = traces.reduce(
    (total, trace) => total + trace.total_calls,
    0
  )

  const ipcEvents = traces.reduce((total, trace) => {
    return total + trace.system_calls
      .filter(call =>
        ['pipe2', 'clone', 'read', 'write', 'mmap', 'ftruncate'].includes(call.name)
      )
      .reduce((sum, call) => sum + call.count, 0)
  }, 0)

  const allCalls = traces.flatMap(trace =>
    trace.system_calls.map(call => ({
      ...call,
      trace: trace.trace
    }))
  )

  const getCallCount = (traceName, callName) => {
    const trace = traces.find(item => item.trace === traceName)
    const call = trace?.system_calls.find(item => item.name === callName)
    return call ? call.count : 0
  }

  const visibleCalls = [
    ...allCalls.filter(call => call.trace === 'pipe_trace.txt').slice(0, 5),
    ...allCalls.filter(call => call.trace === 'shm_trace.txt').slice(0, 5)
  ]

  const getTimelineEvents = (trace) => {
    const priority = [
      'pipe2',
      'ftruncate',
      'read',
      'write',
      'clone',
      'munmap',
      'unlink',
      'mmap',
      'openat'
    ]

    return [...(trace.events || [])]
      .sort((a, b) => {
        const aPriority = priority.indexOf(a.name)
        const bPriority = priority.indexOf(b.name)

        return (
          (aPriority === -1 ? priority.length : aPriority) -
          (bPriority === -1 ? priority.length : bPriority)
        )
      })
      .slice(0, 10)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>SysTrace</h2>
        <p className="subtitle">OS ANALYTICS</p>

        <div className="active">Dashboard</div>
        <div className="menu-item">System Calls</div>
        <div className="menu-item">Process Monitor</div>
        <div className="menu-item">IPC Analysis</div>
        <div className="menu-item">Event Timeline</div>

        <div className="sidebar-bottom">
          <span className="status-dot"></span>
          Tracing engine not connected
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">SYSTEM MONITORING / OVERVIEW</p>
            <h1>System Dashboard</h1>
            <p className="description">
              Monitor system calls, processes and inter-process communication.
            </p>
          </div>
          <span className="badge">TRACE DATA</span>
        </header>

        <section className="stats">
          <article className="stat-card">
            <p>Total System Calls</p>
            <h2>{totalCalls.toLocaleString()}</h2>
            <span>Loaded from IPC trace files</span>
          </article>

          <article className="stat-card">
            <p>Active Processes</p>
            <h2>2</h2>
            <span>Parent and child in demo programs</span>
          </article>

          <article className="stat-card">
            <p>IPC Events</p>
            <h2>{ipcEvents}</h2>
            <span>Selected IPC-related call counts</span>
          </article>

          <article className="stat-card">
            <p>Failed Calls</p>
            <h2>—</h2>
            <span>Failure counting not implemented</span>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h3>System Call Activity</h3>
                <p>System-call counts from captured traces</p>
              </div>
              <span className="small-tag">TRACE DATA</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>System Call</th>
                    <th>Trace Source</th>
                    <th>Duration</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCalls.map((call, index) => (
                    <tr key={`${call.trace}-${call.name}-${index}`}>
                      <td>{call.name}()</td>
                      <td>
                        {call.trace === 'pipe_trace.txt'
                          ? 'Pipe demo'
                          : 'Shared memory demo'}
                      </td>
                      <td>—</td>
                      <td>
                        <span className="success">{call.count}</span>
                      </td>
                    </tr>
                  ))}

                  {traces.length === 0 && (
                    <tr>
                      <td colSpan="4">Loading trace data...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h3>IPC Activity</h3>
                <p>Pipe and shared-memory system calls</p>
              </div>
              <span className="small-tag">COMPARISON</span>
            </div>

            <div className="ipc-item">
              <div className="ipc-icon">P</div>
              <div className="ipc-info">
                <strong>Pipe Communication</strong>
                <p>pipe2: {getCallCount('pipe_trace.txt', 'pipe2')}</p>
                <p>read: {getCallCount('pipe_trace.txt', 'read')}</p>
                <p>write: {getCallCount('pipe_trace.txt', 'write')}</p>
                <p>clone: {getCallCount('pipe_trace.txt', 'clone')}</p>
              </div>
              <span className="success">Captured</span>
            </div>

            <div className="ipc-item">
              <div className="ipc-icon">S</div>
              <div className="ipc-info">
                <strong>Shared Memory</strong>
                <p>mmap: {getCallCount('shm_trace.txt', 'mmap')}</p>
                <p>ftruncate: {getCallCount('shm_trace.txt', 'ftruncate')}</p>
                <p>openat: {getCallCount('shm_trace.txt', 'openat')}</p>
                <p>clone: {getCallCount('shm_trace.txt', 'clone')}</p>
              </div>
              <span className="success">Captured</span>
            </div>

            <div className="process-flow">
              <div className="process-box">Parent Process</div>
              <div className="flow-arrow">↓ IPC message ↓</div>
              <div className="process-box child">Child Process</div>
            </div>
          </article>
        </section>

        <section className="panel event-timeline">
          <div className="panel-heading">
            <div>
              <h3>Event Timeline</h3>
              <p>IPC-related calls from captured trace entries</p>
            </div>
            <span className="small-tag">TRACE DATA</span>
          </div>

          {traces.map(trace => (
            <div key={trace.trace} className="timeline-group">
              <h3>
                {trace.trace === 'pipe_trace.txt'
                  ? 'Pipe Demo'
                  : 'Shared Memory Demo'}
              </h3>

              {trace.events?.length ? (
                getTimelineEvents(trace).map((event, index) => (
                  <div
                    className="timeline-event"
                    key={`${trace.trace}-${index}`}
                  >
                    <span className="timeline-number">{index + 1}</span>
                    <div>
                      <strong>{event.name}()</strong>
                      <p>{event.details}</p>
                      <small>Process ID: {event.process_id}</small>
                    </div>
                  </div>
                ))
              ) : (
                <p>No individual events available for this trace.</p>
              )}
            </div>
          ))}

          {traces.length === 0 && <p>Loading timeline data...</p>}
        </section>

        <footer>
          SysTrace · Operating Systems Project · Member 2
          <p>
            Displaying captured IPC trace summaries and individual trace entries.
            Live tracing is not connected yet.
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
