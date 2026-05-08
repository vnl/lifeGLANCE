import React, { useState, useEffect } from 'react'
import Onboarding      from './components/onboarding/Onboarding'
import RestoreOrFresh  from './components/onboarding/RestoreOrFresh'
import TimelineView    from './components/timeline/TimelineView'
import { initDB, dbGetAll } from './data/db'
import { registerDevtools } from './data/devtools'

export default function App() {
  const [screen,       setScreen]       = useState('loading')  // loading | restore-or-fresh | onboarding | timeline | error
  const [milestones,   setMilestones]   = useState([])
  const [portraitWarn, setPortraitWarn] = useState(
    () => window.matchMedia('(orientation: portrait) and (max-width: 1024px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 1024px)')
    const handler = (e) => setPortraitWarn(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    initDB()
      .then(() => { registerDevtools(); navigator.storage?.persist?.(); return dbGetAll() })
      .then((all) => {
        setMilestones(all)
        setScreen(all.length === 0 ? 'restore-or-fresh' : 'timeline')
      })
      .catch((err) => {
        console.error('DB init failed:', err)
        setScreen('error')
      })
  }, [])

  function handleRestoreComplete({ milestones: imported }) {
    setMilestones(imported)
    setScreen('timeline')
  }

  function handleOnboardingComplete(initial) {
    setMilestones(initial)
    setScreen('timeline')
  }

  const content = screen === 'loading' ? (
    <div className="app-loading">
      <span className="cursor" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
    </div>
  ) : screen === 'restore-or-fresh' ? (
    <RestoreOrFresh
      onRestoreComplete={handleRestoreComplete}
      onStartFresh={() => setScreen('onboarding')}
    />
  ) : screen === 'onboarding' ? (
    <Onboarding onComplete={handleOnboardingComplete} />
  ) : screen === 'error' ? (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: '1rem',
      fontFamily: 'Courier Prime, monospace', color: '#e8e8e8',
      background: '#0F1117', textAlign: 'center', padding: '2rem',
    }}>
      <div style={{ fontSize: '2rem' }}>⚠</div>
      <div style={{ fontSize: '1.2rem' }}>Cannot connect to database</div>
      <div style={{ fontSize: '0.9rem', color: '#888', maxWidth: '400px' }}>
        PocketBase is not reachable. Make sure the server is running and try refreshing.
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '1rem', padding: '0.5rem 1.5rem',
          background: 'transparent', border: '1px solid #555',
          color: '#e8e8e8', fontFamily: 'inherit', cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Retry
      </button>
    </div>
  ) : (
    <TimelineView milestones={milestones} setMilestones={setMilestones} />
  )

  return (
    <>
      {content}
      {portraitWarn && (
        <div className="portrait-overlay">
          <div className="logo">
            <span className="logo-life">life</span>
            <span className="logo-glance">GLANCE</span>
          </div>
          <div className="portrait-rotate-icon">↺</div>
          <div className="portrait-message">
            please rotate your device<br />
            for the best experience
          </div>
        </div>
      )}
    </>
  )
}
