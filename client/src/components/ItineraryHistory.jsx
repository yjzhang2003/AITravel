export const ItineraryHistory = ({ itineraries, onSelect }) => {
  if (!itineraries?.length) {
    return (
      <section className="panel muted">
        <p>登录后可保存多份行程。当前仅展示示例数据。</p>
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
          <li key={item.id}>
            <button type="button" className="ghost" onClick={() => onSelect(item)}>
              <div>
                <strong>{item.itinerary?.destination ?? item.destination}</strong>
                <small className="muted">{new Date(item.created_at ?? item.createdAt).toLocaleString()}</small>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
