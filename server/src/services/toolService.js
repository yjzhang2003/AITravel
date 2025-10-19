import { normalizeItineraryShape } from '../utils/itineraryShape.js';

const AMAP_API_KEY = process.env.AMAP_API_KEY;

const haversineDistance = (pointA, pointB) => {
  if (!pointA || !pointB) return null;
  const { lat: lat1, lng: lng1 } = pointA;
  const { lat: lat2, lng: lng2 } = pointB;

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return null;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

const handlers = {
  update_itinerary: ({ args, context }) => {
    if (!args || typeof args !== 'object') {
      throw new Error('缺少更新内容。');
    }
    if (!args.updates || typeof args.updates !== 'object') {
      throw new Error('updates 字段必须是对象。');
    }

    const overwrite = Boolean(args.overwrite);
    const updates = args.updates;
    const note = args.note ?? null;

    const current = context.itinerary ? clone(context.itinerary) : {};
    const merged = overwrite ? { ...current, ...updates } : applyItineraryUpdates(current, updates);

    const normalized = normalizeItineraryShape(merged, context.itineraryRequest);
    context.itinerary = normalized;
    context.lastBudget = null;
    context.itineraryVersion = (context.itineraryVersion ?? 0) + 1;
    // eslint-disable-next-line no-console
    console.log('[Tool:update_itinerary] Applied updates', {
      overwrite,
      note,
      version: context.itineraryVersion
    });

    return {
      ok: true,
      note,
      itinerary: normalized
    };
  },

  plan_route: async ({ args, context }) => {
    if (!args || typeof args !== 'object') {
      throw new Error('缺少路线规划参数。');
    }

    const { origin, destination, originCoordinates, destinationCoordinates, waypoints, preference } = args;
    if (!origin || !destination) {
      throw new Error('origin 与 destination 为必填字段。');
    }
    if (!AMAP_API_KEY) {
      throw new Error('服务器未配置高德地图 API Key。');
    }

    const itinerary = context.itinerary ?? null;

    const originPoint = await resolvePoint(origin, originCoordinates, itinerary);
    const destinationPoint = await resolvePoint(destination, destinationCoordinates, itinerary);
    const waypointPointsRaw = Array.isArray(waypoints)
      ? await Promise.all(
          waypoints.map(async (item) => resolvePoint(item?.name ?? null, item, itinerary))
        )
      : [];
    const waypointPoints = waypointPointsRaw.filter(Boolean);

    if (!originPoint || !destinationPoint) {
      throw new Error('无法识别起点或终点，请提供更精确的地点名称或经纬度。');
    }

    if (!originPoint.coordinates || !destinationPoint.coordinates) {
      throw new Error('起点或终点缺少经纬度，请提供更精确的地址。');
    }

    const segments = [originPoint, ...waypointPoints, destinationPoint];

    let routeResponse = null;
    try {
      routeResponse = await fetchRouteFromAmap({
        origin: originPoint,
        destination: destinationPoint,
        waypoints: waypointPoints,
        mode: preference
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('AMap route api failed:', error);
    }

    const legs = [];
    let totalDistanceKm = 0;
    segments.forEach((point, index) => {
      if (index === 0) return;
      const previous = segments[index - 1];
      const distanceKm = haversineDistance(previous.coordinates, point.coordinates);
      if (distanceKm != null) {
        totalDistanceKm += distanceKm;
      }
      legs.push({
        from: previous.name,
        to: point.name,
        distanceKm: distanceKm != null ? Number(distanceKm.toFixed(2)) : null
      });
    });

    const averageSpeedKmH = preference === 'walking' ? 5 : preference === 'cycling' ? 15 : 35;
    const durationHours = totalDistanceKm / averageSpeedKmH;
    const durationMinutes = Number.isFinite(durationHours) ? Math.round(durationHours * 60) : null;

    if (routeResponse?.distanceKm != null) {
      totalDistanceKm = routeResponse.distanceKm;
    }
    const finalDurationMinutes =
      routeResponse?.durationMinutes != null ? routeResponse.durationMinutes : durationMinutes;

    const route = {
      origin: originPoint,
      destination: destinationPoint,
      waypoints: waypointPoints,
      preference: preference ?? 'driving',
      distanceKm: Number.isFinite(totalDistanceKm) ? Number(totalDistanceKm.toFixed(2)) : null,
      durationMinutes: finalDurationMinutes,
      legs: routeResponse?.legs ?? legs,
      generatedAt: new Date().toISOString(),
      provider: 'amap',
      raw: routeResponse?.raw ?? null
    };

    context.routes.push(route);
    context.routesVersion = (context.routesVersion ?? 0) + 1;
    // eslint-disable-next-line no-console
    console.log('[Tool:plan_route] Planned route', {
      preference: route.preference,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      version: context.routesVersion
    });

    return {
      ok: true,
      route
    };
  }
};

const resolvePoint = async (name, fallback, itinerary) => {
  if (fallback && typeof fallback === 'object' && Number.isFinite(fallback.lat) && Number.isFinite(fallback.lng)) {
    return {
      name: fallback.name ?? name ?? '地点',
      coordinates: {
        lat: fallback.lat,
        lng: fallback.lng
      }
    };
  }

  if (!itinerary) {
    return name
      ? {
          name,
          coordinates: null
        }
      : null;
  }

  const normalizedName = name ? String(name).trim().toLowerCase() : null;
  if (!normalizedName) {
    return null;
  }

  const highlights = (itinerary.dailyPlans ?? []).flatMap((day) => day?.highlights ?? []);
  const hotels = itinerary.recommendedHotels ?? [];

  const matchHighlight = highlights.find((highlight) => {
    const candidateName = String(highlight?.name ?? '').trim().toLowerCase();
    return candidateName && candidateName === normalizedName;
  });

  if (matchHighlight) {
    return {
      name: matchHighlight.name ?? name,
      coordinates: matchHighlight.coordinates ?? null
    };
  }

  const matchHotel = hotels.find((hotel) => {
    const candidateName = String(hotel?.name ?? '').trim().toLowerCase();
    return candidateName && candidateName === normalizedName;
  });

  if (matchHotel) {
    return {
      name: matchHotel.name ?? name,
      coordinates: matchHotel.coordinates ?? null
    };
  }

  const geocoded = await geocodePlace(name);
  if (geocoded) {
    return geocoded;
  }

  return {
    name,
    coordinates: null
  };
};

const applyItineraryUpdates = (current, updates) => {
  const result = clone(current ?? {});
  const handledKeys = new Set();

  if (Object.prototype.hasOwnProperty.call(updates, 'destination')) {
    result.destination = updates.destination;
    handledKeys.add('destination');
  }

  if (updates.meta && typeof updates.meta === 'object') {
    result.meta = { ...(result.meta ?? {}), ...updates.meta };
    handledKeys.add('meta');
  }

  if (Array.isArray(updates.summaryExtras)) {
    result.summaryExtras = clone(updates.summaryExtras);
    handledKeys.add('summaryExtras');
  }

  if (Array.isArray(updates.dailyPlans)) {
    result.dailyPlans = mergeDailyPlans(result.dailyPlans, updates.dailyPlans);
    handledKeys.add('dailyPlans');
  }

  if (Array.isArray(updates.recommendedHotels)) {
    result.recommendedHotels = mergeHotels(result.recommendedHotels, updates.recommendedHotels);
    handledKeys.add('recommendedHotels');
  }

  if (Array.isArray(updates.transportationTips)) {
    result.transportationTips = mergeTransportationTips(updates.transportationTips);
    handledKeys.add('transportationTips');
  }

  Object.entries(updates).forEach(([key, value]) => {
    if (handledKeys.has(key)) return;
    result[key] = clone(value);
  });

  return result;
};

const mergeDailyPlans = (basePlans, updatePlans) => {
  const baseList = Array.isArray(basePlans) ? clone(basePlans) : [];
  const planMap = new Map();

  baseList.forEach((plan, index) => {
    const key = plan?.day ?? index + 1;
    planMap.set(String(key), { ...plan });
  });

  updatePlans.forEach((plan) => {
    if (!plan || typeof plan !== 'object') return;
    const key = plan.day ?? getNextDay(planMap);
    const strKey = String(key);
    const existing = planMap.get(strKey) ?? { day: key };
    const merged = { ...existing, ...plan };
    if (Array.isArray(plan.highlights)) {
      merged.highlights = clone(plan.highlights);
    }
    planMap.set(strKey, merged);
  });

  return Array.from(planMap.values()).sort((a, b) => {
    const dayA = a.day ?? 0;
    const dayB = b.day ?? 0;
    return dayA - dayB;
  });
};

const mergeHotels = (baseHotels, updateHotels) => {
  const baseList = Array.isArray(baseHotels) ? clone(baseHotels) : [];
  const hotelMap = new Map();

  baseList.forEach((hotel, index) => {
    const key = (hotel?.name ?? `hotel-${index}`).trim().toLowerCase();
    hotelMap.set(key, { ...hotel });
  });

  updateHotels.forEach((hotel, index) => {
    if (!hotel || typeof hotel !== 'object') return;
    const normalizedName = (hotel.name ?? `update-${index}`).trim().toLowerCase();
    const existing = hotelMap.get(normalizedName) ?? {};
    const merged = { ...existing, ...hotel };
    if (Array.isArray(hotel.highlights)) {
      merged.highlights = clone(hotel.highlights);
    }
    hotelMap.set(normalizedName, merged);
  });

  return Array.from(hotelMap.values());
};

const mergeTransportationTips = (tips) => tips.filter((tip) => Boolean(tip)).map((tip) => String(tip));

const getNextDay = (planMap) => {
  let maxDay = 0;
  planMap.forEach((plan) => {
    const day = Number(plan?.day);
    if (Number.isFinite(day) && day > maxDay) {
      maxDay = day;
    }
  });
  return maxDay + 1;
};

const geocodePlace = async (name) => {
  if (!AMAP_API_KEY || !name) return null;

  const url = new URL('https://restapi.amap.com/v3/geocode/geo');
  url.searchParams.set('address', name);
  url.searchParams.set('key', AMAP_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`高德地理编码失败：${response.status}`);
  }

  const data = await response.json();
  if (data.status !== '1' || !Array.isArray(data.geocodes) || data.geocodes.length === 0) {
    return null;
  }

  const location = data.geocodes[0]?.location;
  if (!location) return null;
  const [lng, lat] = location.split(',').map((value) => Number(value));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    name,
    coordinates: { lat, lng }
  };
};

const fetchRouteFromAmap = async ({ origin, destination, waypoints, mode }) => {
  if (!AMAP_API_KEY) {
    throw new Error('服务器未配置高德地图 API Key。');
  }

  const preferredMode = String(mode ?? '').toLowerCase();
  const modeMap = {
    walking: 'walking',
    cycling: 'bicycling',
    bicycle: 'bicycling',
    biking: 'bicycling',
    public_transit: 'transit/integrated',
    transit: 'transit/integrated'
  };
  const endpointMode = modeMap[preferredMode] ?? 'driving';

  const baseUrl =
    endpointMode === 'transit/integrated'
      ? 'https://restapi.amap.com/v5/direction/transit/integrated'
      : `https://restapi.amap.com/v5/direction/${endpointMode}`;

  const url = new URL(baseUrl);
  url.searchParams.set('key', AMAP_API_KEY);
  url.searchParams.set('origin', `${origin.coordinates.lng},${origin.coordinates.lat}`);
  url.searchParams.set('destination', `${destination.coordinates.lng},${destination.coordinates.lat}`);

  if (Array.isArray(waypoints) && waypoints.length > 0) {
    const viaList = waypoints
      .filter((point) => point?.coordinates)
      .map((point) => `${point.coordinates.lng},${point.coordinates.lat}`);
    if (viaList.length) {
      url.searchParams.set('via', viaList.join(';'));
    }
  }

  if (endpointMode === 'transit/integrated') {
    url.searchParams.set('strategy', '0');
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`高德路线规划失败：${response.status}`);
  }

  const data = await response.json();
  if (data.status !== '1') {
    throw new Error(data.info ?? '路线规划失败');
  }

  if (endpointMode === 'transit/integrated') {
    return parseTransitRoute(data);
  }

  return parseGeneralRoute(data);
};

const parseGeneralRoute = (data) => {
  const route = data.route;
  const paths = route?.paths ?? [];
  if (!paths.length) {
    return null;
  }

  const bestPath = paths[0];
  const distanceKm = Number(bestPath.distance) / 1000;
  const durationMinutes = Math.round(Number(bestPath.duration) / 60);

  const legs = (bestPath.steps ?? []).map((step) => ({
    instruction: step.instruction,
    distanceKm:
      step.distance != null ? Number((Number(step.distance) / 1000).toFixed(2)) : null,
    durationMinutes: step.duration != null ? Math.round(Number(step.duration) / 60) : null
  }));

  return {
    distanceKm: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null,
    durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : null,
    legs,
    raw: data
  };
};

const parseTransitRoute = (data) => {
  const route = data.route;
  const transits = route?.transits ?? [];
  if (!transits.length) {
    return null;
  }

  const bestTransit = transits[0];
  const distanceKm = Number(bestTransit.distance) / 1000;
  const durationMinutes = Math.round(Number(bestTransit.duration) / 60);

  const legs = (bestTransit.segments ?? []).map((segment) => {
    const transport = segment?.bus?.buslines?.[0] ?? segment.walking;
    return {
      instruction: transport?.instruction ?? '前往下一段路程',
      distanceKm:
        transport?.distance != null ? Number((Number(transport.distance) / 1000).toFixed(2)) : null,
      durationMinutes: transport?.duration != null ? Math.round(Number(transport.duration) / 60) : null
    };
  });

  return {
    distanceKm: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null,
    durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : null,
    legs,
    raw: data
  };
};

export const toolService = {
  async execute({ name, args, context }) {
    if (!name || typeof handlers[name] !== 'function') {
      throw new Error(`未知工具：${name ?? '未提供名称'}`);
    }

    const handler = handlers[name];
    return handler({ args, context });
  }
};
