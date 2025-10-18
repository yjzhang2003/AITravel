import { BudgetPanel } from '../components/BudgetPanel.jsx';
import { ChatPlanner } from '../components/ChatPlanner.jsx';
import { ItineraryHistory } from '../components/ItineraryHistory.jsx';
import { ItinerarySummary } from '../components/ItinerarySummary.jsx';
import { MapView } from '../components/MapView.jsx';

export const DashboardPage = ({
  session,
  onLogout,
  chatMessages,
  onChatSend,
  onChatReset,
  chatLoading,
  history,
  onSelectHistory,
  error,
  itinerary,
  budget,
  onRecalculateBudget,
  budgetLoading,
  mapKey,
  configHint,
  onSaveItinerary,
  canSaveItinerary,
  savingItinerary
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
          <ChatPlanner messages={chatMessages} onSend={onChatSend} onReset={onChatReset} loading={chatLoading} />
          <ItineraryHistory itineraries={history} onSelect={onSelectHistory} />
        </div>
        <div className="right-column">
          {error && <div className="panel error">{error}</div>}
          {itinerary && canSaveItinerary && (
            <button
              className="secondary"
              type="button"
              onClick={onSaveItinerary}
              disabled={savingItinerary || chatLoading}
            >
              {savingItinerary ? '保存中...' : '保存当前行程'}
            </button>
          )}
          <ItinerarySummary itinerary={itinerary} />
          <BudgetPanel budget={budget} onRecalculate={onRecalculateBudget} recalculating={budgetLoading} />
          <MapView itinerary={itinerary} apiKey={mapKey} />
        </div>
      </div>
    </div>
  );
};
