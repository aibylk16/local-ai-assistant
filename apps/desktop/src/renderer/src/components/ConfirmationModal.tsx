interface Props {
  title: string
  description: string
  dataPreview?: string
  risk: 'low' | 'medium' | 'high'
  approveLabel?: string
  cancelLabel?: string
  onApprove: () => void
  onCancel: () => void
}

/**
 * Confirmation modal. Every high-risk action MUST be funneled through this
 * before the renderer calls a side-effecting IPC channel. The modal shows
 * exactly what will happen and what data may leave the user's machine.
 */
export function ConfirmationModal({
  title,
  description,
  dataPreview,
  risk,
  approveLabel,
  cancelLabel,
  onApprove,
  onCancel,
}: Props): JSX.Element {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h3>{title}</h3>
        <p><span className={`tag ${risk}`}>{risk.toUpperCase()} RISK</span></p>
        <p>{description}</p>
        {dataPreview && (
          <>
            <p className="muted">Data that will be sent or changed:</p>
            <pre style={{
              background: 'var(--bg)',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
              maxHeight: 200,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}>{dataPreview}</pre>
          </>
        )}
        <div className="actions">
          <button className="secondary" onClick={onCancel}>{cancelLabel ?? 'Cancel'}</button>
          <button
            className={risk === 'high' ? 'danger' : 'primary'}
            onClick={onApprove}
          >
            {approveLabel ?? 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
