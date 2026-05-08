import React, { useRef, useState } from 'react'
import { parseBackup, importBackup } from '../../utils/importBackup'

export default function RestoreOrFresh({ onRestoreComplete, onStartFresh }) {
  const [phase,   setPhase]   = useState('idle') // idle | preview | importing
  const [preview, setPreview] = useState(null)   // { milestones, photos, chapters }
  const [error,   setError]   = useState(null)
  const fileRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    try {
      const text   = await file.text()
      const parsed = parseBackup(text)
      setPreview(parsed)
      setPhase('preview')
      setError(null)
    } catch (err) {
      setError(err.message || "That doesn't look like a lifeGLANCE backup.")
    }
  }

  async function handleConfirm() {
    setError(null)
    setPhase('importing')
    try {
      const result = await importBackup(preview)
      onRestoreComplete(result)
    } catch {
      setError('Import failed — please try again.')
      setPhase('idle')
      setPreview(null)
    }
  }

  function handleCancel() {
    setPhase('idle')
    setPreview(null)
    setError(null)
  }

  return (
    <div className="onboarding onboarding-welcome">
      <div style={{ textAlign: 'center', maxWidth: '400px', margin: '0 auto', padding: '2rem' }}>
        <div className="logo" style={{ marginBottom: '2rem' }}>
          <span className="logo-life">life</span>
          <span className="logo-glance">GLANCE</span>
        </div>

        {phase === 'idle' && (
          <>
            <p style={{ color: '#888', marginBottom: '2rem', fontSize: '0.9rem' }}>
              welcome. do you have a backup from a previous lifeGLANCE install?
            </p>
            {error && (
              <p style={{ color: '#e85d75', fontSize: '0.8rem', marginBottom: '1rem' }}>{error}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
              <button className="btn btn-filled" onClick={() => fileRef.current?.click()}>
                ↑ restore from backup
              </button>
              <button className="btn" onClick={onStartFresh}>
                start fresh →
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".json"
              style={{ display: 'none' }} onChange={handleFile} />
          </>
        )}

        {phase === 'preview' && preview && (
          <>
            <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              found in backup:
            </p>
            <div style={{
              background: '#1a1a2e', border: '1px solid #333', borderRadius: '6px',
              padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#e8e8e8',
            }}>
              <div>{preview.milestones.length} milestone{preview.milestones.length !== 1 ? 's' : ''}</div>
              <div>{preview.chapters.length} chapter{preview.chapters.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
              <button className="btn btn-filled" onClick={handleConfirm}>
                import everything →
              </button>
              <button className="btn" onClick={handleCancel}>
                cancel
              </button>
            </div>
          </>
        )}

        {phase === 'importing' && (
          <div style={{ color: '#888', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span className="cursor" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
            importing...
          </div>
        )}
      </div>
    </div>
  )
}
