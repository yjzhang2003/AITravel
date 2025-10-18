export const ItineraryHistory = ({ itineraries, onSelect, onDelete }) => {
  if (!itineraries?.length) {
    return (
      <section className="panel muted">
        <p>暂无历史行程。登录后可保存多份计划，或直接生成新的行程体验。</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span>历史行程</span>
      </div>
      <ul className="history-list">
        {itineraries.map((item) => (
          <li key={item.id ?? `${item.destination}-${item.created_at}`} className="history-item">
            <button type="button" className="history-entry" onClick={() => onSelect(item)}>
              <div className="history-entry-text">
                <strong>
                  {item.itinerary?.destination ??
                    item.itinerary?.meta?.destination ??
                    item.request?.destination ??
                    item.destination ??
                    '行程'}
                </strong>
                <small className="muted">{new Date(item.created_at ?? item.createdAt).toLocaleString()}</small>
              </div>
            </button>
            {onDelete && item.id && (
              <button
                type="button"
                aria-label="删除行程"
                className="history-delete"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item);
                }}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
