import { useCallback, useEffect, useState } from 'react'
import './index.css'

function App() {
  const [traces, setTraces] = useState([])
  const [activeView, setActiveView] = useState('Dashboard')

  const menuItems = [
    'Dashboard',
    'System Calls',
    'Process Monitor',
    'IPC Analysis',
    'Event Timeline'
  ]

  const descriptions = {
    Dashboard: 'Overview of live system calls, processes and IPC activity.',
    'System Calls': 'Inspect live system-call counts, errors and timings.',
    'Process Monitor': 'View parent-child process relationships.',
    'IPC Analysis': 'Compare pipe and shared-memory communication.',
    'Event Timeline': 'Explore events recorded in live system traces.'
  }

  const showOverview = activeView === 'Dashboard'
  const showCalls = showOverview || activeView === 'System Calls'
  const showIPC = showOverview || activeView === 'IPC Analysis'
  const showTimeline = showOverview || activeView === 'Event Timeline'
  const [demos, setDemos] = useState([])
  const [selectedDemo, setSelectedDemo] = useState('process')
  const [liveTrace, setLiveTrace] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')
  const [apiError, setApiError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const loadLiveTrace = useCallback(async () => {
    try {
      const response = await fetch(`/api/trace-program/${selectedDemo}`)

      if (!response.ok) {
        let message = `Backend request failed (${response.status})`

        try {
          const errorBody = await response.json()

          if (errorBody.detail) {
            message = typeof errorBody.detail === 'string'
              ? errorBody.detail
              : JSON.stringify(errorBody.detail)
          }
        } catch {
          // Keep the HTTP status message if the response isn't JSON.
        }

        throw new Error(message)
      }

      const data = await response.json()
      setLiveTrace(data)
      setApiStatus('connected')
      setApiError('')
    } catch (error) {
      setApiStatus('disconnected')
      setApiError(error.message || 'Unable to contact the backend.')
    }
  }, [selectedDemo])

  const refreshLiveTrace = useCallback(async () => {
    setRefreshing(true)

    try {
      await loadLiveTrace()
    } finally {
      setRefreshing(false)
    }
  }, [loadLiveTrace])

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

  useEffect(() => {
    let cancelled = false

    fetch('/api/demos')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Could not load demos (${response.status})`)
        }
        return response.json()
      })
      .then(data => {
        if (!cancelled) setDemos(data.demos || [])
      })
      .catch(error => {
        if (!cancelled) console.error('Error loading demos:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch(`/api/trace-program/${selectedDemo}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Backend request failed (${response.status})`)
        }
        return response.json()
      })
      .then(data => {
        if (cancelled) return
        setLiveTrace(data)
        setApiStatus('connected')
        setApiError('')
      })
      .catch(error => {
        if (cancelled) return
        setApiStatus('disconnected')
        setApiError(error.message || 'Unable to contact the backend.')
      })

    return () => {
      cancelled = true
    }
  }, [selectedDemo])

  const totalCalls = traces.reduce(
    (total, trace) => total + trace.total_calls,
    0
  )

  const ipcCallNames = [
    'pipe', 'pipe2', 'clone', 'fork', 'vfork',
    'read', 'write', 'mmap', 'ftruncate'
  ]

  const ipcEvents = liveTrace?.analysis?.syscalls
    ? liveTrace.analysis.syscalls
        .filter(call => ipcCallNames.includes(call.name))
        .reduce((total, call) => total + call.calls, 0)
    : traces.reduce((total, trace) => {
        return total + trace.system_calls
          .filter(call => ipcCallNames.includes(call.name))
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

  const getTimelineEvents = trace => {
    const priority = [
      'pipe2',
      'ftruncate',
      'clone',
      'read',
      'write',
      'munmap',
      'unlink',
      'mmap',
      'openat',
      'wait4',
      'waitpid'
    ]

    return [...(trace.events || [])]
      .filter(event => priority.includes(event.name))
      .sort((a, b) => priority.indexOf(a.name) - priority.indexOf(b.name))
      .slice(0, 10)
  }

  const getEventDescription = event => {
    const descriptions = {
      pipe2: 'Creates a pipe that processes can use to exchange data.',
      clone: 'Creates a child process or thread.',
      fork: 'Creates a child process.',
      read: 'Reads data from a file descriptor or communication channel.',
      write: 'Writes data to a file descriptor or communication channel.',
      openat: 'Opens a file or shared-memory object.',
      ftruncate: 'Sets the size of a file or shared-memory object.',
      mmap: 'Maps memory into the process address space.',
      munmap: 'Removes a memory mapping from the process.',
      unlink: 'Removes a file or shared-memory name.',
      close: 'Closes an open file descriptor.',
      wait4: 'Waits for a child process and collects its status.',
      waitpid: 'Waits for a specified child process.',
      execve: 'Starts a program by replacing the current process image.',
      brk: 'Adjusts the process heap used for dynamic memory allocation.',
      nanosleep: 'Pauses the process for a specified duration.'
    }

    return descriptions[event.name] ||
      'System call observed in the captured trace.'
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>SysTrace</h2>
        <p className="subtitle">OS ANALYTICS</p>

        <nav aria-label="Main navigation">
          {menuItems.map(item => (
            <button
              type="button"
              key={item}
              className={activeView === item ? 'active' : 'menu-item'}
              onClick={() => setActiveView(item)}
              aria-current={activeView === item ? 'page' : undefined}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span className="status-dot"></span>
          {apiStatus === 'connected'
            ? 'Backend connected'
            : apiStatus === 'disconnected'
              ? 'Backend disconnected'
              : 'Connecting to backend...'}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">SYSTEM MONITORING / {activeView.toUpperCase()}</p>
            <h1>{activeView === 'Dashboard' ? 'System Dashboard' : activeView}</h1>
            <p className="description">{descriptions[activeView]}</p>
          </div>
          <span className="badge">
            {apiStatus === 'connected'
              ? 'LIVE API CONNECTED'
              : apiStatus === 'disconnected'
                ? 'API DISCONNECTED'
                : 'CONNECTING...'}
          </span>
        </header>

        {showOverview && (
          <section className="stats">
          <article className="stat-card">
            <p>Total System Calls</p>
            <h2>
              {(liveTrace?.analysis?.total_calls ?? totalCalls).toLocaleString()}
            </h2>
            <span>
              {liveTrace
                ? 'From the latest live demo trace'
                : 'Showing saved IPC trace count until connected'}
            </span>
          </article>

          <article className="stat-card">
            <p>Active Processes</p>
            <h2>
              {liveTrace?.analysis?.processes_observed ?? '—'}
            </h2>
            <span>Processes observed in the selected demo</span>
          </article>

          <article className="stat-card">
            <p>IPC-Related Calls</p>
            <h2>{ipcEvents}</h2>
            <span>Selected IPC-related call counts</span>
          </article>

          <article className="stat-card">
            <p>Failed Calls</p>
            <h2>
              {liveTrace
                ? liveTrace.analysis.failed_calls.toLocaleString()
                : '—'}
            </h2>
            <span>
              {liveTrace
                ? 'Failed calls in the latest live trace'
                : 'Waiting for live trace data'}
            </span>
          </article>
        </section>
        )}

        {(showOverview || activeView === 'System Calls') && (
        <section className="panel live-analysis-panel">
          <div className="panel-heading">
            <div>
              <h3>Live System Call Analysis</h3>
              <p>Select a demo to capture and analyze its system calls</p>
            </div>

            <div>
              <label htmlFor="demo-selector" style={{ marginRight: '8px', fontSize: '13px' }}>
                Demo:
              </label>
              <select
                id="demo-selector"
                value={selectedDemo}
                onChange={event => setSelectedDemo(event.target.value)}
                disabled={refreshing}
                style={{ padding: '9px 10px', borderRadius: '8px', marginRight: '12px', maxWidth: '220px' }}
              >
                {demos.map(demo => (
                  <option key={demo.id} value={demo.id}>
                    {demo.name}
                  </option>
                ))}
              </select>

              <span className="small-tag">
                {apiStatus === 'connected'
                  ? 'CONNECTED'
                  : apiStatus === 'disconnected'
                    ? 'DISCONNECTED'
                    : 'CONNECTING'}
              </span>

              <button
                type="button"
                onClick={refreshLiveTrace}
                disabled={refreshing}
                style={{
                  marginLeft: '12px',
                  padding: '9px 14px',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  cursor: refreshing ? 'wait' : 'pointer',
                  opacity: refreshing ? 0.65 : 1,
                }}
              >
                {refreshing ? 'Tracing...' : 'Run / Refresh Demo'}
              </button>
            </div>
          </div>

         <div
  style={{
    display: 'grid',
    gap: '16px',
    margin: '20px 0',
    color: '#e5e7eb',
  }}
>
  <h3 style={{ margin: 0, fontSize: '22px', color: '#f8fafc' }}>
    Process Demo Results
  </h3>

  <div
    style={{
      background: '#111c30',
      border: '1px solid #2b3b55',
      borderRadius: '14px',
      padding: '20px',
    }}
  >
    <p style={{ margin: '0 0 12px', color: '#93c5fd', fontWeight: 600 }}>
      Demo Command
    </p>
    <code
      style={{
        display: 'block',
        padding: '14px',
        background: '#080f1d',
        borderRadius: '8px',
        color: '#a7f3d0',
        overflowWrap: 'anywhere',
        lineHeight: 1.7,
      }}
    >
      {liveTrace?.demo_command || '/bin/echo SysTrace API demo'}
    </code>
  </div>

  <div
    style={{
      background: '#111c30',
      border: '1px solid #2b3b55',
      borderRadius: '14px',
      padding: '20px',
    }}
  >
    <p style={{ margin: '0 0 10px', color: '#93c5fd', fontWeight: 600 }}>
      Total Measured System Call Time
    </p>
    <div style={{ fontSize: '32px', fontWeight: 700, color: '#6ee7b7' }}>
      {liveTrace
        ? `${liveTrace.analysis.total_time_microseconds.toLocaleString()} µs`
        : '—'}
    </div>
  </div>

  <div
    style={{
      background: '#111c30',
      border: '1px solid #2b3b55',
      borderRadius: '14px',
      padding: '20px',
    }}
  >
    <p style={{ margin: '0 0 12px', color: '#93c5fd', fontWeight: 600 }}>
      Program Output
    </p>
    <pre
      style={{
        margin: 0,
        padding: '14px',
        background: '#080f1d',
        borderRadius: '8px',
        color: '#d1d5db',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        fontFamily: 'monospace',
        lineHeight: 1.8,
      }}
    >
      {liveTrace?.program_output || 'Waiting for program output...'}
    </pre>
  </div>

  <div
    style={{
      background: '#111c30',
      border: '1px solid #2b3b55',
      borderRadius: '14px',
      padding: '20px',
    }}
  >
    <p style={{ margin: '0 0 16px', color: '#93c5fd', fontWeight: 600 }}>
      Process Relationships
    </p>

    {liveTrace?.analysis?.process_relationships?.length > 0 ? (
      <div style={{ display: 'grid', gap: '12px' }}>
        {liveTrace.analysis.process_relationships.map((relationship, index) => (
          <div
            key={`${relationship.parent_pid}-${relationship.child_pid}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '16px',
              background: '#182942',
              border: '1px solid #344b68',
              borderRadius: '10px',
            }}
          >
            <div style={{ flex: '1 1 120px' }}>
              <div style={{ fontSize: '11px', color: '#93c5fd' }}>PARENT</div>
              <strong style={{ fontSize: '17px' }}>
                PID {relationship.parent_pid}
              </strong>
            </div>

            <span style={{ fontSize: '22px', color: '#6ee7b7' }}>→</span>

            <div style={{ flex: '1 1 120px' }}>
              <div style={{ fontSize: '11px', color: '#6ee7b7' }}>CHILD</div>
              <strong style={{ fontSize: '17px' }}>
                PID {relationship.child_pid}
              </strong>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p style={{ margin: 0, color: '#9ca3af' }}>
        No process relationships detected yet.
      </p>
    )}
  </div>
</div>

{apiError && (
            <p role="alert" style={{ color: '#ef4444', margin: '12px 0' }}>
              Backend error: {apiError}
            </p>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>System Call</th>
                  <th>Calls</th>
                  <th>Errors</th>
                  <th>Total Time (µs)</th>
                  <th>Average Time (µs)</th>
                </tr>
              </thead>
              <tbody>
                {liveTrace?.analysis?.syscalls?.length > 0 ? (
                  liveTrace.analysis.syscalls.map(call => (
                    <tr key={call.name}>
                      <td>{call.name}()</td>
                      <td>{call.calls.toLocaleString()}</td>
                      <td>{call.errors.toLocaleString()}</td>
                      <td>{call.total_time_microseconds.toLocaleString()}</td>
                      <td>{call.average_time_microseconds.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">
                      {refreshing
                        ? 'Collecting and analyzing system calls...'
                        : apiStatus === 'disconnected'
                          ? 'Live data is unavailable. Check that the backend server is running.'
                          : 'Waiting for syscall results...'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {(showCalls || showIPC) && (
        <section className="content-grid">
          {showCalls && (
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
          )}

          {showIPC && (
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
          )}
        </section>
        )}

        {activeView === 'Process Monitor' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Process Monitor</h3>
                <p>Parent-child relationships from the selected live demo</p>
              </div>
              <span className="small-tag">LIVE PROCESS VIEW</span>
            </div>

            <div className="process-flow">
              <div className="process-box">Parent Process</div>
              <div className="flow-arrow">↓ Process communication ↓</div>
              <div className="process-box child">Child Process</div>
            </div>

            <p>
              Processes observed: {liveTrace?.analysis?.processes_observed ?? 'Waiting for live data'}
            </p>

            {liveTrace?.analysis?.process_relationships?.length > 0 ? (
              liveTrace.analysis.process_relationships.map((relationship, index) => (
                <p key={`${relationship.parent_pid}-${relationship.child_pid}-${index}`}>
                  Parent PID {relationship.parent_pid}
                  {' → '}
                  Child PID {relationship.child_pid}
                </p>
              ))
            ) : (
              <p>
                {liveTrace
                  ? 'No parent-child relationship was reported for this demo.'
                  : 'Waiting for live process data.'}
              </p>
            )}

            {liveTrace?.program_output && (
              <p>Program output: {liveTrace.program_output}</p>
            )}
          </section>
        )}

        {showTimeline && (
        <section className="panel event-timeline">
          <div className="panel-heading">
            <div>
              <h3>Event Timeline</h3>
              <p>Key system calls explained, with original trace details available</p>
            </div>
            <span className="small-tag">
              {liveTrace?.analysis?.events?.length > 0
                ? 'LIVE TRACE'
                : 'SAVED TRACE'}
            </span>
          </div>

          {liveTrace?.analysis?.events?.length > 0 ? (
            <div className="timeline-group">
              <h3>
                {demos.find(demo => demo.id === selectedDemo)?.name || selectedDemo}
                {' — Live Events'}
              </h3>

              {getTimelineEvents({
                events: liveTrace.analysis.events
              }).length > 0 ? (
                getTimelineEvents({
                  events: liveTrace.analysis.events
                }).map((event, index) => (
                  <div
                    className="timeline-event"
                    key={`live-${event.process_id}-${event.name}-${index}`}
                  >
                    <span className="timeline-number">{index + 1}</span>
                    <div>
                      <strong>{event.name}()</strong>
                      <p>{getEventDescription(event)}</p>
                      <small>Process ID: {event.process_id}</small>
                      <details style={{ marginTop: '8px' }}>
                        <summary style={{ cursor: 'pointer' }}>
                          View raw trace entry
                        </summary>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            fontSize: '12px',
                            marginTop: '8px'
                          }}
                        >
                          {event.details}
                        </pre>
                      </details>
                    </div>
                  </div>
                ))
              ) : (
                <p>No key system calls found in the live trace.</p>
              )}
            </div>
          ) : (
            traces.map(trace => (
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
                        <p>{getEventDescription(event)}</p>
                        <small>Process ID: {event.process_id}</small>
                        <details style={{ marginTop: '8px' }}>
                          <summary style={{ cursor: 'pointer' }}>
                            View raw trace entry
                          </summary>
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                              fontSize: '12px',
                              marginTop: '8px'
                            }}
                          >
                            {event.details}
                          </pre>
                        </details>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No individual events available for this trace.</p>
                )}
              </div>
            ))
          )}

          {traces.length === 0 && !liveTrace?.analysis?.events?.length && (
            <p>Loading timeline data...</p>
          )}
        </section>
        )}

        <footer>
          SysTrace · Operating Systems Project 
          <p>
            {descriptions[activeView]} Live tracing is provided by the FastAPI backend.
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
