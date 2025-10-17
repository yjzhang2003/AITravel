export const BudgetPanel = ({ budget, onRecalculate, recalculating }) => {
  if (!budget) {
    return (
      <section className="panel muted">
        <p>生成行程后，系统会自动估算预算。</p>
      </section>
    );
  }

  const breakdownEntries = Object.entries(budget.breakdown ?? {});

  return (
    <section className="panel">
      <div className="panel-header">
        <span>费用预算</span>
        <button className="text-button" type="button" onClick={onRecalculate} disabled={recalculating}>
          {recalculating ? '重新估算中...' : '重新估算'}
        </button>
      </div>
      <p>
        预计总费用：<strong>¥{Math.round(budget.total)}</strong>
      </p>
      <ul className="budget-list">
        {breakdownEntries.map(([key, value]) => (
          <li key={key}>
            <span>{labelMap[key] ?? key}</span>
            <strong>¥{Math.round(value)}</strong>
          </li>
        ))}
      </ul>
      {budget.notes?.length && (
        <ul className="muted">
          {budget.notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
};

const labelMap = {
  transport: '交通',
  accommodation: '住宿',
  food: '餐饮',
  entertainment: '娱乐',
  buffer: '机动'
};
