import { useEffect, useState } from 'react'
import { ClipboardList, FileDown, RefreshCw, Trash2 } from 'lucide-react'
import PageHeader from '../../../shared/components/PageHeader.jsx'
import {
  deleteTechnicalAdminAuditLogs,
  getTechnicalAdminAuditLogs,
} from '../../technical-administration/services/technicalAdminService.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'
import '../../technical-administration/styles/technical-admin.css'

export default function AuditLogPage() {
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingClear, setPendingClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [exporting, setExporting] = useState(false)

  useAutoDismiss(error, setError)
  useAutoDismiss(notice, setNotice)

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      setAuditLogs(await getTechnicalAdminAuditLogs())
    } catch (requestError) {
      setError(requestError.message || 'Unable to load administrator audit records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    getTechnicalAdminAuditLogs()
      .then(records => {
        if (active) setAuditLogs(records)
      })
      .catch(requestError => {
        if (active) {
          setError(requestError.message || 'Unable to load administrator audit records.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function exportPdf() {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 42
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const textWidth = pageWidth - margin * 2
      let y = margin

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('GCMS Administrator Audit Records', margin, y)
      y += 24
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(`Exported ${new Date().toLocaleString('en-KE')}`, margin, y)
      y += 22

      if (auditLogs.length === 0) {
        pdf.text('No administrator audit records are available.', margin, y)
      } else {
        auditLogs.forEach((record, index) => {
          const details = [
            `${index + 1}. ${record.action.replaceAll('_', ' ')}`,
            `Administrator: ${record.actorName || 'Former administrator'}${record.actorRole ? ` (${record.actorRole.replaceAll('_', ' ')})` : ''}`,
            `Target: ${record.targetName || record.targetType.replaceAll('_', ' ')}`,
            `Date: ${new Date(record.createdAt).toLocaleString('en-KE')}`,
          ]
          const lines = details.flatMap(line => pdf.splitTextToSize(line, textWidth))
          const entryHeight = lines.length * 13 + 12
          if (y + entryHeight > pageHeight - margin) {
            pdf.addPage()
            y = margin
          }
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(10)
          pdf.text(lines[0], margin, y)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.text(lines.slice(1), margin, y + 14, { lineHeightFactor: 1.35 })
          y += entryHeight
        })
      }

      pdf.save(`gcms-audit-records-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (requestError) {
      setError(requestError.message || 'Unable to export the audit records as PDF.')
    } finally {
      setExporting(false)
    }
  }

  async function clearHistory() {
    setClearing(true)
    setError('')
    try {
      const result = await deleteTechnicalAdminAuditLogs()
      setPendingClear(false)
      setNotice(
        `${result.message} ${result.deletedCount} previous record${result.deletedCount === 1 ? '' : 's'} removed. ${result.notifiedCount} member${result.notifiedCount === 1 ? '' : 's'} notified.`,
      )
      await refresh()
    } catch (requestError) {
      setError(requestError.message || 'Unable to clear the audit history.')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="technical-admin-page">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Audit log report"
        description="Review, export, and manage administrator actions recorded by the system."
      />
      {error && <p className="technical-admin-error" role="alert">{error}</p>}
      {notice && <p className="technical-admin-notice" role="status">{notice}</p>}
      <section className="technical-admin-audit-section" aria-labelledby="audit-log-title">
        <div className="technical-admin-audit-heading">
          <div>
            <h2 id="audit-log-title">Administrator audit records</h2>
            <p>PDF export includes the records currently shown here.</p>
          </div>
          <button type="button" className="button button-secondary technical-admin-audit-refresh" onClick={refresh} disabled={loading}>
            <RefreshCw size={15} />{loading ? 'Refreshing…' : 'Refresh records'}
          </button>
          <button type="button" className="button button-secondary technical-admin-audit-export" onClick={exportPdf} disabled={loading || exporting}>
            <FileDown size={15} />{exporting ? 'Creating PDF…' : 'Export PDF'}
          </button>
          <button type="button" className="button button-secondary technical-admin-audit-delete" onClick={() => setPendingClear(true)} disabled={loading || clearing}>
            <Trash2 size={15} />Clear history
          </button>
        </div>
        {loading ? (
          <div className="technical-admin-audit-state" role="status">Loading administrator audit records…</div>
        ) : auditLogs.length === 0 ? (
          <div className="technical-admin-audit-state technical-admin-audit-empty">
            <ClipboardList size={24} aria-hidden="true" />
            <strong>No administrator audit records yet</strong>
            <span>Role changes and other administrative actions will appear here.</span>
          </div>
        ) : (
          <div className="technical-admin-audit-list">
            {auditLogs.map(record => (
              <article className="technical-admin-audit-record" key={record.id}>
                <div>
                  <strong>{record.action.replaceAll('_', ' ')}</strong>
                  <span>{record.actorName || 'Former administrator'}{record.actorRole ? ` · ${record.actorRole.replaceAll('_', ' ')}` : ''}</span>
                </div>
                <div className="technical-admin-audit-target">
                  <span>{record.targetName || record.targetType.replaceAll('_', ' ')}</span>
                </div>
                <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString('en-KE')}</time>
              </article>
            ))}
          </div>
        )}
      </section>
      {pendingClear && (
        <div className="technical-admin-confirmation-backdrop">
          <section className="technical-admin-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="audit-clear-title">
            <h2 id="audit-clear-title">Clear audit history?</h2>
            <p>This permanently deletes existing audit records. A new deletion record will be retained.</p>
            <div className="technical-admin-confirmation-actions">
              <button type="button" className="button button-secondary" onClick={() => setPendingClear(false)} disabled={clearing}>Cancel</button>
              <button type="button" className="button button-primary technical-admin-audit-delete-confirm" onClick={clearHistory} disabled={clearing}>
                {clearing ? 'Clearing…' : 'Clear audit history'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
