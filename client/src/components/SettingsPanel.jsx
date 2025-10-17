export const SettingsPanel = ({ apiKeys, onChange }) => {
  const handleChange = (field) => (event) => {
    onChange({ ...apiKeys, [field]: event.target.value });
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <span>API Key 配置</span>
        <small className="muted">密钥仅存储在浏览器本地，不会上传。</small>
      </div>
      <div className="form-grid">
        <label>
          <span>大模型 API URL</span>
          <input
            placeholder="https://api.openai.com/v1/responses"
            value={apiKeys.llmUrl ?? ''}
            onChange={handleChange('llmUrl')}
          />
        </label>
        <label>
          <span>大模型 API Key</span>
          <input
            placeholder="sk-..."
            value={apiKeys.llmKey ?? ''}
            onChange={handleChange('llmKey')}
          />
        </label>
        <label>
          <span>大模型模型名</span>
          <input
            placeholder="gpt-4o-mini"
            value={apiKeys.llmModel ?? ''}
            onChange={handleChange('llmModel')}
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          <span>语音识别 API URL</span>
          <input
            placeholder="https://..."
            value={apiKeys.voiceUrl ?? ''}
            onChange={handleChange('voiceUrl')}
          />
        </label>
        <label>
          <span>语音识别 API Key</span>
          <input
            placeholder="voice-key"
            value={apiKeys.voiceKey ?? ''}
            onChange={handleChange('voiceKey')}
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          <span>高德地图 Key</span>
          <input
            placeholder="例如：abcd1234"
            value={apiKeys.mapKey ?? ''}
            onChange={handleChange('mapKey')}
          />
        </label>
      </div>
    </section>
  );
};
