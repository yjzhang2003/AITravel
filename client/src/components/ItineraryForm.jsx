import { VoiceInput } from './VoiceInput.jsx';

const preferenceOptions = [
  { value: '美食', label: '美食' },
  { value: '自然风光', label: '自然风光' },
  { value: '历史文化', label: '历史文化' },
  { value: '亲子', label: '亲子' },
  { value: '二次元/动漫', label: '二次元/动漫' }
];

export const ItineraryForm = ({ formData, onChange, onSubmit, loading }) => {
  const handleInputChange = (field) => (event) => {
    onChange({ ...formData, [field]: event.target.value });
  };

  const handlePreferenceToggle = (value) => {
    const preferences = new Set(formData.preferences ?? []);
    if (preferences.has(value)) {
      preferences.delete(value);
    } else {
      preferences.add(value);
    }
    onChange({ ...formData, preferences: Array.from(preferences) });
  };

  const handleVoiceTranscript = (text) => {
    onChange({ ...formData, notes: `${formData.notes ? `${formData.notes}\n` : ''}${text}` });
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <span>行程需求</span>
        <small className="muted">语音或文字描述都可以，生成后可再细调。</small>
      </div>
      <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <label>
          <span>目的地</span>
          <input value={formData.destination} onChange={handleInputChange('destination')} required />
        </label>
        <label>
          <span>开始日期</span>
          <input type="date" value={formData.startDate} onChange={handleInputChange('startDate')} />
        </label>
        <label>
          <span>结束日期</span>
          <input type="date" value={formData.endDate} onChange={handleInputChange('endDate')} />
        </label>
        <label>
          <span>预算 (¥)</span>
          <input type="number" value={formData.budget} onChange={handleInputChange('budget')} />
        </label>
        <label>
          <span>同行人数</span>
          <input
            type="number"
            min="1"
            value={formData.companions}
            onChange={handleInputChange('companions')}
          />
        </label>
        <label className="full-width">
          <span>偏好标签</span>
          <div className="chip-list">
            {preferenceOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={formData.preferences?.includes(option.value) ? 'chip active' : 'chip'}
                onClick={() => handlePreferenceToggle(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </label>
        <label className="full-width">
          <span>补充说明 / 语音识别结果</span>
          <textarea
            rows="4"
            value={formData.notes}
            placeholder="例如：想带孩子体验二次元主题，预算控制在1万元内。"
            onChange={handleInputChange('notes')}
          />
        </label>
        <VoiceInput onTranscript={handleVoiceTranscript} />
        <button className="primary" type="submit" disabled={loading}>
          {loading ? '生成中...' : '生成行程'}
        </button>
      </form>
    </section>
  );
};
