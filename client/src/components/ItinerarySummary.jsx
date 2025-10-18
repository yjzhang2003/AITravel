import { useCallback, useEffect, useRef, useState } from 'react';

import { loadAmap } from '../utils/mapLoader.js';

const safeText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? '是' : '否';
  return JSON.stringify(value);
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const cloneItinerary = (plan) => {
  if (!plan) return null;
  try {
    return JSON.parse(JSON.stringify(plan));
  } catch {
    if (typeof structuredClone === 'function') {
      return structuredClone(plan);
    }
    return { ...plan };
  }
};

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const sanitizeItineraryDraft = (draft) => {
  if (!draft) return null;

  const result = cloneItinerary(draft) ?? {};
  if (!result.meta || typeof result.meta !== 'object') {
    result.meta = {};
  }

  const pruneStringField = (obj, field) => {
    if (!obj || typeof obj !== 'object') return;
    const raw = obj[field];
    if (raw === undefined || raw === null) {
      delete obj[field];
      return;
    }
    const text = String(raw).trim();
    if (!text) {
      delete obj[field];
    } else {
      obj[field] = text;
    }
  };

  const pruneNumberField = (obj, field) => {
    if (!obj || typeof obj !== 'object') return;
    const number = toNumberOrNull(obj[field]);
    if (number === null) {
      delete obj[field];
    } else {
      obj[field] = number;
    }
  };

  pruneStringField(result, 'destination');

  pruneStringField(result.meta, 'destination');
  pruneStringField(result.meta, 'startDate');
  pruneStringField(result.meta, 'endDate');
  pruneStringField(result.meta, 'notes');

  pruneNumberField(result.meta, 'travelers');
  pruneNumberField(result.meta, 'companions');
  pruneNumberField(result.meta, 'budget');

  if (result.meta.travelers != null && result.meta.companions == null) {
    result.meta.companions = result.meta.travelers;
  }

  if (!result.destination && result.meta.destination) {
    result.destination = result.meta.destination;
  }

  result.destination = result.destination ?? '行程概要';

  result.summaryExtras = ensureArray(result.summaryExtras)
    .map((extra, index) => {
      const label = String(extra?.label ?? '').trim();
      const value = String(extra?.value ?? '').trim();
      if (!value) return null;
      return { label: label || `信息 ${index + 1}`, value };
    })
    .filter(Boolean);

  result.dailyPlans = ensureArray(result.dailyPlans).map((day, index) => {
    const nextDay = { ...day };
    const dayNumber = toNumberOrNull(nextDay.day);
    nextDay.day = dayNumber ?? index + 1;
    pruneStringField(nextDay, 'theme');
    pruneStringField(nextDay, 'description');
    if (!nextDay.theme) {
      nextDay.theme = '行程安排';
    }

    nextDay.highlights = ensureArray(nextDay.highlights).map((highlight, highlightIndex) => {
      const nextHighlight = { ...highlight };
      pruneStringField(nextHighlight, 'name');
      pruneStringField(nextHighlight, 'description');
      pruneStringField(nextHighlight, 'category');
      if (!nextHighlight.name) {
        nextHighlight.name = `活动 ${highlightIndex + 1}`;
      }

      if (nextHighlight.coordinates && typeof nextHighlight.coordinates === 'object') {
        const lat = toNumberOrNull(nextHighlight.coordinates.lat);
        const lng = toNumberOrNull(nextHighlight.coordinates.lng);
        if (lat === null && lng === null) {
          nextHighlight.coordinates = null;
        } else {
          nextHighlight.coordinates = {
            lat,
            lng
          };
        }
      } else {
        nextHighlight.coordinates = null;
      }

      Object.keys(nextHighlight)
        .filter((key) => key.startsWith('__'))
        .forEach((key) => {
          delete nextHighlight[key];
        });

      return nextHighlight;
    });

    return nextDay;
  });

  result.dailyPlans.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));

  result.recommendedHotels = ensureArray(result.recommendedHotels).map((hotel, index) => {
    const nextHotel = { ...hotel };
    pruneStringField(nextHotel, 'name');
    pruneStringField(nextHotel, 'location');

    const price = toNumberOrNull(nextHotel.pricePerNight);
    nextHotel.pricePerNight = price;

    nextHotel.highlights = ensureArray(nextHotel.highlights)
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);

    if (!nextHotel.name) {
      nextHotel.name = `住宿推荐 ${index + 1}`;
    }

    if (!nextHotel.location) {
      delete nextHotel.location;
    }

    if (nextHotel.pricePerNight === null) {
      delete nextHotel.pricePerNight;
    }

    if (!nextHotel.highlights.length) {
      delete nextHotel.highlights;
    }

    return nextHotel;
  });

  result.transportationTips = ensureArray(result.transportationTips)
    .map((tip) => String(tip ?? '').trim())
    .filter(Boolean);

  return result;
};

export const ItinerarySummary = ({ itinerary, onChange, mapApiKey }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(null);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!itinerary) {
      setIsEditing(false);
      setDraft(null);
    } else if (isEditing) {
      setDraft((prev) => prev ?? cloneItinerary(itinerary));
    }
  }, [itinerary, isEditing]);

  const handleStartEditing = () => {
    if (!itinerary || !onChange) return;
    setDraft(cloneItinerary(itinerary));
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!draft || !onChange) {
      setIsEditing(false);
      return;
    }
    const sanitized = sanitizeItineraryDraft(draft);
    onChange(sanitized);
    setIsEditing(false);
  };

  if (!itinerary) {
    return (
      <section className="panel muted">
        <p>生成行程后会展示每日安排与推荐。</p>
      </section>
    );
  }

  return (
    <section className={`panel${isEditing ? ' itinerary-editing' : ''}`}>
      <div className="panel-header">
        <span>AI 行程规划</span>
        {onChange && (
          isEditing ? (
            <div className="editor-actions">
              <button className="text-button" type="button" onClick={handleCancel}>
                取消
              </button>
              <button className="primary" type="button" onClick={handleSave}>
                保存
              </button>
            </div>
          ) : (
            <button className="text-button" type="button" onClick={handleStartEditing}>
              编辑
            </button>
          )
        )}
      </div>
      {isEditing ? (
        <ItineraryEditor draft={draft} setDraft={setDraft} mapApiKey={mapApiKey} />
      ) : (
        <ItineraryView itinerary={itinerary} />
      )}
    </section>
  );
};

const ItineraryView = ({ itinerary }) => (
  <>
    <h2>{safeText(itinerary.destination ?? itinerary?.meta?.destination ?? '行程概要')}</h2>
    {itinerary.meta && (
      <p className="muted">
        {itinerary.meta.startDate && `出发：${safeText(itinerary.meta.startDate)} · `}
        {itinerary.meta.endDate && `返程：${safeText(itinerary.meta.endDate)} · `}
        {itinerary.meta.travelers && `人数：${safeText(itinerary.meta.travelers)} · `}
        {itinerary.meta.budget && `预算：${safeText(itinerary.meta.budget)}`}
      </p>
    )}
    {Array.isArray(itinerary.summaryExtras) && itinerary.summaryExtras.length > 0 && (
      <div className="summary-extras">
        {itinerary.summaryExtras.map((item, index) => (
          <p key={index}>
            <strong>{safeText(item.label)}：</strong>
            <span>{safeText(item.value)}</span>
          </p>
        ))}
      </div>
    )}
    <div className="daily-plan-list">
      {(itinerary.dailyPlans ?? []).map((day, dayIndex) => (
        <article key={day?.day ?? dayIndex} className="daily-plan-card">
          <header>
            <strong>
              第 {day?.day ?? dayIndex + 1} 天 · {safeText(day?.theme ?? '行程安排')}
            </strong>
            {day?.description && <span className="day-description">{safeText(day.description)}</span>}
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
              {Array.isArray(hotel?.highlights) && hotel.highlights.length > 0 && (
                <ul className="hotel-highlights">
                  {hotel.highlights.map((point, subIndex) => (
                    <li key={subIndex}>{safeText(point)}</li>
                  ))}
                </ul>
              )}
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
  </>
);

const ItineraryEditor = ({ draft, setDraft, mapApiKey }) => {
  const geocoderRef = useRef(null);
  const geocoderPromiseRef = useRef(null);
  const mapSupported = Boolean(mapApiKey);

  const getGeocoder = useCallback(async () => {
    if (!mapSupported) {
      throw new Error('未配置地图 Key');
    }
    if (geocoderRef.current) {
      return geocoderRef.current;
    }
    if (!geocoderPromiseRef.current) {
      geocoderPromiseRef.current = loadAmap(mapApiKey)
        .then(
          (AMap) =>
            new Promise((resolve, reject) => {
              AMap.plugin('AMap.Geocoder', () => {
                try {
                  const instance = new AMap.Geocoder();
                  geocoderRef.current = instance;
                  resolve(instance);
                } catch (error) {
                  geocoderRef.current = null;
                  geocoderPromiseRef.current = null;
                  reject(error);
                }
              });
            })
        )
        .catch((error) => {
          geocoderPromiseRef.current = null;
          throw error;
        });
    }
    return geocoderPromiseRef.current;
  }, [mapApiKey, mapSupported]);

  const setHighlight = useCallback(
    (dayIndex, highlightIndex, updater) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const plans = ensureArray(prev.dailyPlans);
        const nextPlans = plans.map((day, idx) => {
          if (idx !== dayIndex) return day;
          const highlights = ensureArray(day.highlights);
          const nextHighlights = highlights.map((highlight, hIdx) => {
            if (hIdx !== highlightIndex) return highlight;
            return updater({ ...highlight });
          });
          return { ...day, highlights: nextHighlights };
        });
        return { ...prev, dailyPlans: nextPlans };
      });
    },
    [setDraft]
  );

  const geocodeHighlight = useCallback(
    async (dayIndex, highlightIndex, keyword) => {
      if (!mapSupported) return;
      const query = (keyword ?? '').trim();
      if (!query) return;

      setHighlight(dayIndex, highlightIndex, (highlight) => ({
        ...highlight,
        coordinates: null,
        __geocodeStatus: 'loading',
        __geocodeMessage: null,
        __geocodeQuery: query
      }));

      try {
        const geocoder = await getGeocoder();
        const geocode = await new Promise((resolve, reject) => {
          geocoder.getLocation(query, (status, result) => {
            if (status === 'complete' && result?.geocodes?.length) {
              resolve(result.geocodes[0]);
            } else {
              reject(new Error(result?.info ?? '未找到匹配地点'));
            }
          });
        });

        const { location } = geocode ?? {};
        const lng = Number(location?.lng);
        const lat = Number(location?.lat);
        const coordinates =
          Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;

        setHighlight(dayIndex, highlightIndex, (highlight) => {
          if (highlight.__geocodeQuery && highlight.__geocodeQuery !== query) {
            return highlight;
          }
          return {
            ...highlight,
            coordinates,
            __geocodeStatus: coordinates ? 'success' : 'error',
            __geocodeMessage: coordinates ? null : '未找到匹配地点，请尝试更精确的名称。',
            __geocodeQuery: coordinates ? query : undefined
          };
        });
      } catch (error) {
        const message = error?.message ?? '未找到匹配地点，请尝试更精确的名称。';
        setHighlight(dayIndex, highlightIndex, (highlight) => {
          if (highlight.__geocodeQuery && highlight.__geocodeQuery !== query) {
            return highlight;
          }
          return {
            ...highlight,
            coordinates: null,
            __geocodeStatus: 'error',
            __geocodeMessage: message,
            __geocodeQuery: query
          };
        });
      }
    },
    [getGeocoder, mapSupported, setHighlight]
  );

  const getGeocodeMessage = useCallback(
    (status, coordinates, fallbackMessage) => {
      const lng = Number(coordinates?.lng);
      const lat = Number(coordinates?.lat);

      if (!mapSupported) {
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          return `当前坐标：${lng.toFixed(4)}, ${lat.toFixed(4)}（需配置地图 Key 以重新定位）`;
        }
        return '配置地图 Key 后可自动获取地点坐标。';
      }

      if (status === 'loading') {
        return '自动定位中...';
      }
      if (status === 'success') {
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          return `已定位：${lng.toFixed(4)}, ${lat.toFixed(4)}`;
        }
        return '已定位成功。';
      }
      if (status === 'error') {
        return fallbackMessage ?? '未找到匹配地点，请尝试更精确的名称。';
      }
      if (status === 'pending') {
        return '名称已更新，请点击“定位”获取最新位置。';
      }
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return `已定位：${lng.toFixed(4)}, ${lat.toFixed(4)}`;
      }
      return '输入景点名称后，系统会自动尝试定位。';
    },
    [mapSupported]
  );

  if (!draft) return null;

  const meta = draft.meta ?? {};
  const summaryExtras = ensureArray(draft.summaryExtras);
  const dailyPlans = ensureArray(draft.dailyPlans);
  const hotels = ensureArray(draft.recommendedHotels);
  const tips = ensureArray(draft.transportationTips);

  const updateMetaField = (field, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextMeta = { ...(prev.meta ?? {}) };
      if (field === 'travelers') {
        if (value === '') {
          delete nextMeta.travelers;
          delete nextMeta.companions;
        } else {
          nextMeta.travelers = value;
          nextMeta.companions = value;
        }
        return { ...prev, meta: nextMeta };
      }
      if (value === '') {
        delete nextMeta[field];
      } else {
        nextMeta[field] = value;
      }
      return { ...prev, meta: nextMeta };
    });
  };

  const updateDestination = (value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextMeta = { ...(prev.meta ?? {}) };
      if (value === '') {
        delete nextMeta.destination;
      } else {
        nextMeta.destination = value;
      }
      return { ...prev, destination: value, meta: nextMeta };
    });
  };

  const updateSummaryExtra = (index, field, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const extras = ensureArray(prev.summaryExtras);
      const nextExtras = extras.map((extra, idx) =>
        idx === index ? { ...extra, [field]: value } : extra
      );
      return { ...prev, summaryExtras: nextExtras };
    });
  };

  const addSummaryExtra = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const extras = ensureArray(prev.summaryExtras);
      return { ...prev, summaryExtras: [...extras, { label: '', value: '' }] };
    });
  };

  const removeSummaryExtra = (index) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const extras = ensureArray(prev.summaryExtras);
      const nextExtras = extras.filter((_, idx) => idx !== index);
      return { ...prev, summaryExtras: nextExtras };
    });
  };

  const updateDayField = (dayIndex, field, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const plans = ensureArray(prev.dailyPlans);
      const nextPlans = plans.map((day, idx) =>
        idx === dayIndex ? { ...day, [field]: value } : day
      );
      return { ...prev, dailyPlans: nextPlans };
    });
  };

  const removeDay = (dayIndex) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const plans = ensureArray(prev.dailyPlans);
      const nextPlans = plans.filter((_, idx) => idx !== dayIndex);
      return { ...prev, dailyPlans: nextPlans };
    });
  };

  const addDay = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const plans = ensureArray(prev.dailyPlans);
      const maxDay = plans.reduce((max, item) => {
        const dayNumber = Number(item?.day ?? 0);
        return Number.isFinite(dayNumber) ? Math.max(max, dayNumber) : max;
      }, 0);
      const nextDay = {
        day: maxDay + 1,
        theme: '行程安排',
        description: '',
        highlights: []
      };
      return { ...prev, dailyPlans: [...plans, nextDay] };
    });
  };

  const updateHighlightField = (dayIndex, highlightIndex, field, value) => {
    setHighlight(dayIndex, highlightIndex, (highlight) => {
      const nextHighlight = { ...highlight, [field]: value };
      if (field === 'name') {
        const trimmed = String(value ?? '').trim();
        nextHighlight.coordinates = null;
        nextHighlight.__geocodeMessage = null;
        nextHighlight.__geocodeQuery = undefined;
        if (mapSupported && trimmed) {
          nextHighlight.__geocodeStatus = 'pending';
        } else {
          delete nextHighlight.__geocodeStatus;
        }
      }
      return nextHighlight;
    });
  };

  const removeHighlight = (dayIndex, highlightIndex) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const plans = ensureArray(prev.dailyPlans);
      const nextPlans = plans.map((day, idx) => {
        if (idx !== dayIndex) return day;
        const highlights = ensureArray(day.highlights);
        const nextHighlights = highlights.filter((_, hIdx) => hIdx !== highlightIndex);
        return { ...day, highlights: nextHighlights };
      });
      return { ...prev, dailyPlans: nextPlans };
    });
  };

  const addHighlight = (dayIndex) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const plans = ensureArray(prev.dailyPlans);
      const nextPlans = plans.map((day, idx) => {
        if (idx !== dayIndex) return day;
        const highlights = ensureArray(day.highlights);
        const nextHighlight = {
          name: `活动 ${highlights.length + 1}`,
          description: '',
          category: '',
          coordinates: null
        };
        return { ...day, highlights: [...highlights, nextHighlight] };
      });
      return { ...prev, dailyPlans: nextPlans };
    });
  };

  const updateHotelField = (index, field, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = ensureArray(prev.recommendedHotels);
      const nextItems = items.map((hotel, idx) => {
        if (idx !== index) return hotel;
        if (field === 'highlights') {
          const lines = value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          return { ...hotel, highlights: lines };
        }
        return { ...hotel, [field]: value };
      });
      return { ...prev, recommendedHotels: nextItems };
    });
  };

  const addHotel = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = ensureArray(prev.recommendedHotels);
      return {
        ...prev,
        recommendedHotels: [
          ...items,
          { name: `住宿推荐 ${items.length + 1}`, location: '', pricePerNight: '', highlights: [] }
        ]
      };
    });
  };

  const removeHotel = (index) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = ensureArray(prev.recommendedHotels);
      const nextItems = items.filter((_, idx) => idx !== index);
      return { ...prev, recommendedHotels: nextItems };
    });
  };

  const updateTip = (index, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = ensureArray(prev.transportationTips);
      const nextItems = items.map((tip, idx) => (idx === index ? value : tip));
      return { ...prev, transportationTips: nextItems };
    });
  };

  const addTip = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = ensureArray(prev.transportationTips);
      return { ...prev, transportationTips: [...items, ''] };
    });
  };

  const removeTip = (index) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = ensureArray(prev.transportationTips);
      const nextItems = items.filter((_, idx) => idx !== index);
      return { ...prev, transportationTips: nextItems };
    });
  };

  return (
    <form className="itinerary-editor" onSubmit={(event) => event.preventDefault()}>
      <section className="editor-section">
        <h3>基本信息</h3>
        <div className="editor-grid">
          <label>
            <span>目的地</span>
            <input value={draft.destination ?? ''} onChange={(event) => updateDestination(event.target.value)} />
          </label>
          <label>
            <span>出发日期</span>
            <input value={meta.startDate ?? ''} onChange={(event) => updateMetaField('startDate', event.target.value)} />
          </label>
          <label>
            <span>结束日期</span>
            <input value={meta.endDate ?? ''} onChange={(event) => updateMetaField('endDate', event.target.value)} />
          </label>
          <label>
            <span>同行人数</span>
            <input
              type="number"
              inputMode="numeric"
              value={meta.travelers ?? meta.companions ?? ''}
              onChange={(event) => updateMetaField('travelers', event.target.value)}
            />
          </label>
          <label>
            <span>预算 (¥)</span>
            <input
              type="number"
              inputMode="numeric"
              value={meta.budget ?? ''}
              onChange={(event) => updateMetaField('budget', event.target.value)}
            />
          </label>
        </div>
        <label className="editor-textarea">
          <span>备注</span>
          <textarea
            rows={2}
            value={meta.notes ?? ''}
            onChange={(event) => updateMetaField('notes', event.target.value)}
          />
        </label>
      </section>

      <section className="editor-section">
        <div className="editor-section-header">
          <h3>概要补充</h3>
          <button type="button" className="text-button" onClick={addSummaryExtra}>
            新增条目
          </button>
        </div>
        {summaryExtras.length === 0 && <p className="muted">可添加行程亮点、偏好等补充信息。</p>}
        {summaryExtras.map((extra, index) => (
          <div key={index} className="editor-row">
            <label>
              <span>标题</span>
              <input value={extra.label ?? ''} onChange={(event) => updateSummaryExtra(index, 'label', event.target.value)} />
            </label>
            <label className="editor-textarea">
              <span>内容</span>
              <textarea
                rows={2}
                value={extra.value ?? ''}
                onChange={(event) => updateSummaryExtra(index, 'value', event.target.value)}
              />
            </label>
            <button type="button" className="text-button danger" onClick={() => removeSummaryExtra(index)}>
              删除
            </button>
          </div>
        ))}
      </section>

      <section className="editor-section">
        <div className="editor-section-header">
          <h3>每日行程</h3>
          <button type="button" className="text-button" onClick={addDay}>
            新增天数
          </button>
        </div>
        {dailyPlans.length === 0 && <p className="muted">暂未添加每日安排。</p>}
        {dailyPlans.map((day, dayIndex) => (
          <article key={dayIndex} className="editor-card">
            <header>
              <strong>第 {day.day ?? dayIndex + 1} 天</strong>
              <button type="button" className="text-button danger" onClick={() => removeDay(dayIndex)}>
                删除
              </button>
            </header>
            <div className="editor-grid">
              <label>
                <span>天数</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={day.day ?? ''}
                  onChange={(event) => updateDayField(dayIndex, 'day', event.target.value)}
                />
              </label>
              <label>
                <span>主题</span>
                <input value={day.theme ?? ''} onChange={(event) => updateDayField(dayIndex, 'theme', event.target.value)} />
              </label>
            </div>
            <label className="editor-textarea">
              <span>概述</span>
              <textarea
                rows={2}
                value={day.description ?? ''}
                onChange={(event) => updateDayField(dayIndex, 'description', event.target.value)}
              />
            </label>
            <div className="editor-subsection">
              <div className="editor-subsection-header">
                <h4>活动安排</h4>
                <button type="button" className="text-button" onClick={() => addHighlight(dayIndex)}>
                  新增活动
                </button>
              </div>
              {ensureArray(day.highlights).length === 0 && <p className="muted">为当日添加游览或体验活动。</p>}
              {ensureArray(day.highlights).map((highlight, highlightIndex) => {
                const status =
                  highlight?.__geocodeStatus ??
                  (highlight?.coordinates ? 'success' : undefined);
                const coordinates = highlight?.coordinates ?? null;
                const statusClass = status ?? (coordinates ? 'success' : 'idle');
                const geocodeMessage = getGeocodeMessage(status, coordinates, highlight?.__geocodeMessage);
                const geocodeLabel =
                  status === 'loading'
                    ? '定位中...'
                    : coordinates
                      ? '重新定位'
                      : '定位';

                return (
                  <div key={highlightIndex} className="editor-highlight">
                    <div className="editor-grid">
                      <label>
                        <span>名称</span>
                        <input
                          value={highlight?.name ?? ''}
                          onChange={(event) =>
                            updateHighlightField(dayIndex, highlightIndex, 'name', event.target.value)
                          }
                          onBlur={(event) => geocodeHighlight(dayIndex, highlightIndex, event.target.value)}
                        />
                      </label>
                      <label>
                        <span>类别</span>
                        <input
                          value={highlight?.category ?? ''}
                          onChange={(event) =>
                            updateHighlightField(dayIndex, highlightIndex, 'category', event.target.value)
                          }
                        />
                      </label>
                    </div>
                    <div className="geocode-feedback">
                      <p className={`geocode-status ${statusClass}`}>{geocodeMessage}</p>
                      {mapSupported && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => geocodeHighlight(dayIndex, highlightIndex, highlight?.name)}
                          disabled={status === 'loading'}
                        >
                          {geocodeLabel}
                        </button>
                      )}
                    </div>
                    <label className="editor-textarea">
                      <span>描述</span>
                      <textarea
                        rows={2}
                        value={highlight?.description ?? ''}
                        onChange={(event) =>
                          updateHighlightField(dayIndex, highlightIndex, 'description', event.target.value)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="text-button danger"
                      onClick={() => removeHighlight(dayIndex, highlightIndex)}
                    >
                      删除活动
                    </button>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      <section className="editor-section">
        <div className="editor-section-header">
          <h3>住宿推荐</h3>
          <button type="button" className="text-button" onClick={addHotel}>
            新增住宿
          </button>
        </div>
        {hotels.length === 0 && <p className="muted">暂无住宿推荐，可根据喜好自行添加。</p>}
        {hotels.map((hotel, index) => (
          <article key={index} className="editor-card">
            <header>
              <strong>{hotel.name || `住宿推荐 ${index + 1}`}</strong>
              <button type="button" className="text-button danger" onClick={() => removeHotel(index)}>
                删除
              </button>
            </header>
            <div className="editor-grid">
              <label>
                <span>名称</span>
                <input value={hotel.name ?? ''} onChange={(event) => updateHotelField(index, 'name', event.target.value)} />
              </label>
              <label>
                <span>位置</span>
                <input
                  value={hotel.location ?? ''}
                  onChange={(event) => updateHotelField(index, 'location', event.target.value)}
                />
              </label>
              <label>
                <span>每晚预算 (¥)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={hotel.pricePerNight ?? ''}
                  onChange={(event) => updateHotelField(index, 'pricePerNight', event.target.value)}
                />
              </label>
            </div>
            <label className="editor-textarea">
              <span>亮点（每行一条）</span>
              <textarea
                rows={2}
                value={ensureArray(hotel.highlights).join('\n')}
                onChange={(event) => updateHotelField(index, 'highlights', event.target.value)}
              />
            </label>
          </article>
        ))}
      </section>

      <section className="editor-section">
        <div className="editor-section-header">
          <h3>交通建议</h3>
          <button type="button" className="text-button" onClick={addTip}>
            新增建议
          </button>
        </div>
        {tips.length === 0 && <p className="muted">为行程添加出行提醒或交通注意事项。</p>}
        {tips.map((tip, index) => (
          <div key={index} className="editor-row">
            <label className="editor-textarea">
              <span>建议 {index + 1}</span>
              <textarea
                rows={2}
                value={tip ?? ''}
                onChange={(event) => updateTip(index, event.target.value)}
              />
            </label>
            <button type="button" className="text-button danger" onClick={() => removeTip(index)}>
              删除
            </button>
          </div>
        ))}
      </section>
    </form>
  );
};
