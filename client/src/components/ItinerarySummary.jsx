const renderSummary = (summary) => {
  if (!summary) return null;

  if (typeof summary === 'string') {
    return <p>{summary}</p>;
  }

  if (Array.isArray(summary)) {
    return (
      <ul>
        {summary.map((item, index) => (
          <li key={index}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof summary === 'object') {
    const text = Object.values(summary)
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join('；');
    return <p>{text}</p>;
  }

  return <p>{String(summary)}</p>;
};

const safeText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? '是' : '否';
  return JSON.stringify(value);
};

export const ItinerarySummary = ({ itinerary }) => {
  if (!itinerary) {
    return (
      <section className="panel muted">
        <p>生成行程后会展示每日安排与推荐。</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span>AI 行程规划</span>
      </div>
      <h2>{safeText(itinerary.destination ?? itinerary?.meta?.destination ?? '行程概要')}</h2>
      {itinerary.meta && (
        <p className="muted">
          {itinerary.meta.startDate && `出发：${safeText(itinerary.meta.startDate)} · `}
          {itinerary.meta.endDate && `返程：${safeText(itinerary.meta.endDate)} · `}
          {itinerary.meta.travelers && `人数：${safeText(itinerary.meta.travelers)} · `}
          {itinerary.meta.budget && `预算：${safeText(itinerary.meta.budget)}`}
        </p>
      )}
      {renderSummary(itinerary.summary)}
      <div className="daily-plan-list">
        {(itinerary.dailyPlans ?? []).map((day, dayIndex) => (
          <article key={day?.day ?? dayIndex} className="daily-plan-card">
            <header>
              <strong>
                第 {day?.day ?? dayIndex + 1} 天 · {safeText(day?.theme ?? '行程安排')}
              </strong>
            </header>
            <ul>
              {(day?.highlights ?? []).map((highlight, index) => {
                if (!highlight) return null;
                const name = safeText(highlight.name ?? `活动 ${index + 1}`);
                const description = highlight.description ? safeText(highlight.description) : '';
                return (
                  <li key={index}>
                    <strong>{name}</strong>
                    {description && <span> — {description}</span>}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
      {itinerary.recommendedHotels?.length > 0 && (
        <div className="section">
          <h3>住宿推荐</h3>
          <ul>
            {itinerary.recommendedHotels.map((hotel, index) => (
              <li key={index}>
                <strong>{safeText(hotel?.name ?? `选项 ${index + 1}`)}</strong>
                {hotel?.location && <> · {safeText(hotel.location)}</>}
                {hotel?.pricePerNight && <> · ¥{safeText(hotel.pricePerNight)}/晚</>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {itinerary.transportationTips?.length > 0 && (
        <div className="section">
          <h3>交通建议</h3>
          <ul>
            {itinerary.transportationTips.map((tip, index) => (
              <li key={index}>{safeText(tip)}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
