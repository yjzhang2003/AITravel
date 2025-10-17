const AMAP_SCRIPT_ID = 'amap-sdk';

let loadPromise = null;

export const loadAmap = (apiKey) => {
  if (!apiKey) {
    return Promise.reject(new Error('缺少高德地图 Key'));
  }

  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(AMAP_SCRIPT_ID);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = AMAP_SCRIPT_ID;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}&plugin=AMap.MarkerClusterer`;
    script.async = true;

    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        reject(new Error('高德地图加载失败'));
      }
    };

    script.onerror = () => reject(new Error('无法加载高德地图脚本'));

    document.head.appendChild(script);
  });

  return loadPromise;
};
