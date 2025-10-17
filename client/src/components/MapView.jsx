import { useEffect, useRef, useState } from 'react';

import { loadAmap } from '../utils/mapLoader.js';

const defaultCenter = [116.397389, 39.908722];

export const MapView = ({ itinerary, apiKey }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [error, setError] = useState(null);

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

  if (!apiKey) {
    return (
      <div className="panel muted">
        <strong>提示：</strong>请在服务器环境变量中配置高德地图 Key 以启用地图展示。
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel error">
        地图加载失败：{error}
      </div>
    );
  }

  return (
    <div className="map-container" ref={containerRef}>
      {!itinerary && <span className="muted">生成行程后将在此展示地点分布</span>}
    </div>
  );
};
