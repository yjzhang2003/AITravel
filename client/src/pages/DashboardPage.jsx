import { BudgetPanel } from '../components/BudgetPanel.jsx';
import { ItineraryForm } from '../components/ItineraryForm.jsx';
import { ItineraryHistory } from '../components/ItineraryHistory.jsx';
import { ItinerarySummary } from '../components/ItinerarySummary.jsx';
import { MapView } from '../components/MapView.jsx';

export const DashboardPage = ({
  session,
  onLogout,
  formData,
  onChangeForm,
  onGenerate,
  loading,
  history,
  onSelectHistory,
  error,
  itinerary,
  budget,
  onRecalculateBudget,
  budgetLoading,
  mapKey,
  configHint
}) => {
  const userEmail = session?.user?.email ?? '体验模式';

  return (
    <div className="dashboard-shell">
      <header className="app-top-bar">
        <div>
          <h1>AI 旅行规划师</h1>
          <p>个性化的行程助手，随时调整和同步您的旅行计划。</p>
        </div>
        <div className="user-actions">
          <span className="user-chip">{userEmail}</span>
          <button className="secondary" type="button" onClick={onLogout}>
            退出
          </button>
        </div>
      </header>
      {configHint && <div className="banner muted">{configHint}</div>}
      <div className="grid">
        <div className="left-column">
          <ItineraryForm formData={formData} onChange={onChangeForm} onSubmit={onGenerate} loading={loading} />
          <ItineraryHistory itineraries={history} onSelect={onSelectHistory} />
        </div>
        <div className="right-column">
          {error && <div className="panel error">{error}</div>}
          <ItinerarySummary itinerary={itinerary} />
          <BudgetPanel budget={budget} onRecalculate={onRecalculateBudget} recalculating={budgetLoading} />
          <MapView itinerary={itinerary} apiKey={mapKey} />
        </div>
      </div>
    </div>
  );
};
