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
      <h2>{itinerary.destination}</h2>
      <p>{itinerary.summary}</p>
      <div className="daily-plan-list">
        {itinerary.dailyPlans?.map((day) => (
          <article key={day.day} className="daily-plan-card">
            <header>
              <strong>第 {day.day} 天 · {day.theme}</strong>
            </header>
            <ul>
              {day.highlights?.map((highlight, index) => (
                <li key={index}>
                  <strong>{highlight.name}</strong>
                  {highlight.description && <span> — {highlight.description}</span>}
                </li>
              ))}
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
                <strong>{hotel.name}</strong> · {hotel.location} · ¥{hotel.pricePerNight}/晚
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
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
