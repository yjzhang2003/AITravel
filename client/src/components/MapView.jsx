import { useEffect, useRef, useState } from 'react';

import { loadAmap } from '../utils/mapLoader.js';

const defaultCenter = [116.397389, 39.908722];

export const MapView = ({ itinerary, apiKey, onRouteSearch, searchingRoute = false }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [error, setError] = useState(null);
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');

  useEffect(() => {
    if (!containerRef.current || !itinerary || !apiKey) {
      return;
    }

    let cancelled = false;

    loadAmap(apiKey)
      .then((AMap) => {
        if (cancelled) return;

        if (!mapRef.current) {
          mapRef.current = new AMap.Map(containerRef.current, {
            viewMode: '3D',
            zoom: 11,
            center: defaultCenter
          });
        }

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        const highlights = itinerary?.dailyPlans?.flatMap((day) => day.highlights ?? []) ?? [];

        if (highlights.length === 0) {
          mapRef.current.setZoom(5);
          mapRef.current.setCenter(defaultCenter);
          return;
        }

        const lnglatList = [];

        highlights.forEach((highlight) => {
          const { coordinates, name, description } = highlight;
          if (!coordinates?.lng || !coordinates?.lat) {
            return;
          }
          const position = [coordinates.lng, coordinates.lat];
          const marker = new AMap.Marker({
            position,
            title: name
          });
          marker.setMap(mapRef.current);
          if (AMap.InfoWindow) {
            const infoWindow = new AMap.InfoWindow({
              anchor: 'top-center',
              content: `<strong>${name}</strong><br/>${description ?? ''}`
            });
            marker.on('click', () => infoWindow.open(mapRef.current, position));
          }
          markersRef.current.push(marker);
          lnglatList.push(position);
        });

        if (lnglatList.length) {
          mapRef.current.setFitView(markersRef.current, true, [80, 80, 80, 80]);
        }
      })
      .catch((err) => {
        setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, itinerary]);

  const handleRouteSubmit = (event) => {
    event.preventDefault();
    const origin = originInput.trim();
    const destination = destinationInput.trim();
    if (!origin || !destination) return;
    onRouteSearch?.({ origin, destination });
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <span>行程地图</span>
      </div>

      <form className="route-search" onSubmit={handleRouteSubmit}>
        <div className="route-search-fields">
          <label>
            <span>起点</span>
            <input
              type="text"
              value={originInput}
              onChange={(event) => setOriginInput(event.target.value)}
              placeholder="例如：酒店或景点名称"
            />
          </label>
          <label>
            <span>终点</span>
            <input
              type="text"
              value={destinationInput}
              onChange={(event) => setDestinationInput(event.target.value)}
              placeholder="例如：景点名称"
            />
          </label>
        </div>
        <button className="secondary" type="submit" disabled={searchingRoute || !originInput.trim() || !destinationInput.trim()}>
          {searchingRoute ? '规划中...' : '搜索路线'}
        </button>
      </form>

      {!apiKey && (
        <div className="map-placeholder muted">
          <strong>提示：</strong>请在服务器环境变量中配置高德地图 Key 以启用地图展示。
        </div>
      )}

      {apiKey && error && (
        <div className="map-placeholder error">
          地图加载失败：{error}
        </div>
      )}

      {apiKey && !error && (
        <div className="map-container" ref={containerRef}>
          {!itinerary && <span className="muted">生成行程后将在此展示地点分布</span>}
        </div>
      )}
    </section>
  );
};
