
import { useEffect, useState } from 'react'
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

  const getTimelineEvents = trace => {
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

  const descriptions = {
    Dashboard: 'Overview of system calls, processes and IPC activity.',
    'System Calls': 'View system-call counts from captured trace files.',
    'Process Monitor': 'View parent and child process information.',
    'IPC Analysis': 'Compare pipe and shared-memory communication.',
    'Event Timeline': 'Explore events recorded in the trace data.'
  }

  const showOverview = activeView === 'Dashboard'
  const showCalls = showOverview || activeView === 'System Calls'
  const showIPC = showOverview || activeView === 'IPC Analysis'
  const showTimeline = showOverview || activeView === 'Event Timeline'

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
          {traces.length > 0 ? 'Trace data loaded' : 'Loading trace data'}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              SYSTEM MONITORING / {activeView.toUpperCase()}
            </p>
            <h1>{activeView === 'Dashboard' ? 'System Dashboard' : activeView}</h1>
            <p className="description">{descriptions[activeView]}</p>
          </div>
          <span className="badge">TRACE DATA</span>
        </header>

        {showOverview && (
          <section className="stats">
            <article className="stat-card">
              <p>Total System Calls</p>
              <h2>{totalCalls.toLocaleString()}</h2>
              <span>Loaded from trace data</span>
            </article>

            <article className="stat-card">
              <p>Active Processes</p>
              <h2>2</h2>
              <span>Parent and child demo processes</span>
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
        )}

        {showCalls && (
          <section className="panel">
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

                  {traces.length > 0 && visibleCalls.length === 0 && (
                    <tr>
                      <td colSpan="4">No system-call entries available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeView === 'Process Monitor' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Process Monitor</h3>
                <p>Parent-child process relationship in the IPC demos</p>
              </div>
              <span className="small-tag">PROCESS VIEW</span>
            </div>

            <div className="process-flow">
              <div className="process-box">Parent Process</div>
              <div className="flow-arrow">↓ Creates child using fork() ↓</div>
              <div className="process-box child">Child Process</div>
              <div className="flow-arrow">↑ Parent waits using waitpid() ↑</div>
              <div className="process-box">Process synchronization</div>
            </div>

            <p>
              The parent and child process demonstrations show how Linux
              creates processes and coordinates their execution.
            </p>
            <p>
              Trace files loaded: {traces.length}
            </p>
          </section>
        )}

        {showIPC && (
          <section className="panel">
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

            {showOverview && (
              <div className="process-flow">
                <div className="process-box">Parent Process</div>
                <div className="flow-arrow">↓ IPC message ↓</div>
                <div className="process-box child">Child Process</div>
              </div>
            )}
          </section>
        )}

        {showTimeline && (
          <section className="panel event-timeline">
            <div className="panel-heading">
              <div>
                <h3>Event Timeline</h3>
                <p>Events recorded in captured trace entries</p>
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
        )}

        <footer>
          SysTrace · Operating Systems Project · Member 2
          <p>{descriptions[activeView]}</p>
        </footer>
      </main>
    </div>
  )
}

export default App
