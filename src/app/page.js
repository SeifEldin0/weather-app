"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { gsap } from "gsap";
import styles from "./page.module.css";

const WEATHER_DESCRIPTIONS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Storm with hail",
  99: "Severe storm",
};

const EMOJI_BY_CODE = {
  0: "\u2600", // sun
  1: "\u26c5", // sun behind cloud
  2: "\u26c5",
  3: "\u2601", // cloud
  45: "\u2601",
  48: "\u2601",
  51: "\u2614", // rain
  53: "\u2614",
  55: "\u2614",
  56: "\u2602",
  57: "\u2602",
  61: "\u2614",
  63: "\u2614",
  65: "\u2614",
  66: "\u2602",
  67: "\u2602",
  71: "\u2744", // snow
  73: "\u2744",
  75: "\u2744",
  77: "\u2744",
  80: "\u2614",
  81: "\u2614",
  82: "\u2614",
  85: "\u2744",
  86: "\u2744",
  95: "\u26a1", // storm
  96: "\u26a1",
  99: "\u26a1",
};

const DEFAULT_CITY = "Amsterdam";

const formatTime = (iso, timeZone) => {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone || "UTC",
  }).format(new Date(iso));
};

const formatDay = (iso, timeZone) => {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timeZone || "UTC",
  }).format(new Date(iso));
};

const round = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;

const comfortMessage = (temp, feels) => {
  const t = typeof feels === "number" ? feels : temp;
  if (t == null) return "Weather comfort: --";
  if (t < 12) return "Weather comfort: Cold \u00b7 تحتاج جاكيت";
  if (t < 20) return "Weather comfort: لطيف \u00b7 ممكن سويتر خفيف";
  if (t < 28) return "Weather comfort: معتدل \u00b7 مناسب للمشي";
  return "Weather comfort: حار \u00b7 اشرب ماء وتجنب الشمس";
};

const heroCopy = {
  title: "World-class weather, instantly clear.",
  subtitle:
    "Search globally, tap your live location, and get a cinematic, ranked forecast: comfort, UV, rain, and a confident 5-day outlook.",
};

const getSkyTheme = (code) => {
  if (code == null) return "skyClear";
  if ([95, 96, 99].includes(code)) return "skyStorm";
  if ([61, 63, 65, 80, 81, 82, 66, 67].includes(code)) return "skyRain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "skySnow";
  if ([2, 3, 45, 48].includes(code)) return "skyClouds";
  return "skyClear";
};

const buildWeatherModel = (location, payload) => {
  const { timezone } = payload || {};
  const hourly = (payload?.hourly?.time || []).slice(0, 8).map((time, index) => ({
    time,
    temperature: round(payload.hourly?.temperature_2m?.[index]),
    precip: payload.hourly?.precipitation_probability?.[index] ?? null,
    uv: payload.hourly?.uv_index?.[index] ?? null,
    wind: payload.hourly?.wind_speed_10m?.[index] ?? null,
  }));

  const daily = (payload?.daily?.time || []).slice(0, 5).map((time, index) => ({
    date: time,
    min: round(payload.daily?.temperature_2m_min?.[index]),
    max: round(payload.daily?.temperature_2m_max?.[index]),
    code: payload.daily?.weathercode?.[index] ?? null,
    uv: payload.daily?.uv_index_max?.[index] ?? null,
    sunrise: payload.daily?.sunrise?.[index] ?? null,
    sunset: payload.daily?.sunset?.[index] ?? null,
    precip: payload.daily?.precipitation_probability_max?.[index] ?? null,
  }));

  const nextRainHour = hourly
    .filter((item, idx) => idx < 12)
    .reduce(
      (best, item) =>
        item.precip && item.precip > (best?.precip || 0) ? item : best,
      null
    );

  return {
    timezone,
    location: {
      name: location.name,
      country: location.country,
      region: location.admin1,
      coordinates: `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`,
    },
    current: {
      temp: round(payload?.current?.temperature_2m),
      feels: round(payload?.current?.apparent_temperature),
      humidity: payload?.current?.relative_humidity_2m ?? null,
      precipitation: payload?.current?.precipitation ?? null,
      wind: payload?.current?.wind_speed_10m ?? null,
      code: payload?.current?.weather_code ?? null,
      uv: payload?.current?.uv_index ?? null,
    },
    hourly,
    daily,
    nextRainHour,
    lastUpdated: payload?.current?.time || new Date().toISOString(),
  };
};

export default function WeatherApp() {
  const [cityQuery, setCityQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [skyTheme, setSkyTheme] = useState("skyClear");
  const heroRef = useRef(null);
  const cardsRef = useRef([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (heroRef.current) {
      gsap.fromTo(
        heroRef.current,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }
      );
    }
  }, []);

  useEffect(() => {
    fetchWeather(DEFAULT_CITY);
  }, []);

  useEffect(() => {
    if (!weather || !cardsRef.current.length) return;
    gsap.fromTo(
      cardsRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }
    );
  }, [weather]);

  const fetchSuggestions = async (value) => {
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const { data } = await axios.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        {
          params: { name: value.trim(), count: 6, language: "en" },
        }
      );
      const results = data?.results || [];
      setSuggestions(
        results.map((item) => ({
          id: `${item.id}-${item.latitude}-${item.longitude}`,
          label: `${item.name}, ${item.country}`,
          ...item,
        }))
      );
    } catch (err) {
      console.error("Suggestion error", err);
    }
  };

  const fetchWeather = async (cityName) => {
    const query = (cityName || cityQuery).trim();
    if (!query) {
      setError("Please enter a city to explore.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: geoData } = await axios.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        { params: { name: query, count: 1, language: "en" } }
      );

      const location = geoData?.results?.[0];
      if (!location) {
        setError("City not found. Try another search.");
        setLoading(false);
        return;
      }

      const weatherParams = {
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone || "auto",
        current:
          "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,uv_index",
        hourly:
          "temperature_2m,precipitation_probability,uv_index,wind_speed_10m",
        daily:
          "temperature_2m_max,temperature_2m_min,weathercode,uv_index_max,sunrise,sunset,precipitation_probability_max",
        forecast_days: 7,
      };

      const { data: weatherData } = await axios.get(
        "https://api.open-meteo.com/v1/forecast",
        { params: weatherParams }
      );

      const newModel = buildWeatherModel(location, weatherData);
      setWeather(newModel);
      setSkyTheme(getSkyTheme(newModel.current.code));
    } catch (err) {
      console.error("Weather error", err);
      setError("Could not fetch weather. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherByCoords = async ({ latitude, longitude }) => {
    setLoading(true);
    setError("");
    try {
      const { data: geoData } = await axios.get(
          "https://geocoding-api.open-meteo.com/v1/reverse",
          { params: { latitude, longitude, language: "en" } }
        );

        const location = geoData?.results?.[0];
        if (!location) {
          setError("Location lookup failed. Try typing a city.");
          setLoading(false);
          return;
        }

        const weatherParams = {
          latitude,
          longitude,
          timezone: location.timezone || "auto",
          current:
            "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,uv_index",
          hourly:
            "temperature_2m,precipitation_probability,uv_index,wind_speed_10m",
          daily:
            "temperature_2m_max,temperature_2m_min,weathercode,uv_index_max,sunrise,sunset,precipitation_probability_max",
          forecast_days: 7,
        };

        const { data: weatherData } = await axios.get(
          "https://api.open-meteo.com/v1/forecast",
          { params: weatherParams }
        );

        const newModel = buildWeatherModel(location, weatherData);
        setCityQuery(location.name);
        setWeather(newModel);
        setSkyTheme(getSkyTheme(newModel.current.code));
      } catch (err) {
        console.error("Geo error", err);
        setError("Location access failed. Please allow permission or type a city.");
      } finally {
        setLoading(false);
        setLocating(false);
      }
    };

  const handleChange = (value) => {
    setCityQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  };

  const handleSuggestionClick = (item) => {
    setCityQuery(item.label);
    setSuggestions([]);
    fetchWeather(item.label);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported. Type your city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeatherByCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        console.error("Geolocation denied", err);
        setLocating(false);
        setError("Location permission denied. اكتب المدينة يدويًا.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const heroBadges = useMemo(
    () => [
      "Live UV and sun window",
      "Hourly rain chances",
      "5-day confidence outlook",
      "Comfort-ranked insights",
    ],
    []
  );

  const quickCities = useMemo(
    () => ["Paris", "Tokyo", "New York", "Dubai", "Sydney"],
    []
  );

  return (
    <main className={styles.page}>
      <div className={`${styles.sky} ${styles[skyTheme] || styles.skyClear}`} />
      <header className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>WX</span>
          <span>Aurora Weather Studio</span>
        </div>
        <div className={styles.navActions}>
          <span className={styles.pill}>GSAP micro-animations</span>
          <button className={styles.cta} onClick={() => fetchWeather(cityQuery)}>
            Refresh City
          </button>
        </div>
      </header>

      <section className={styles.hero} ref={heroRef}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Modern weather intelligence</span>
          <h1 className={styles.title}>{heroCopy.title}</h1>
          <p className={styles.subtitle}>{heroCopy.subtitle}</p>
          <div className={styles.badgeRow}>
            {heroBadges.map((item) => (
              <span key={item} className={styles.badge}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.searchCard}>
          <div className={styles.actionsRow}>
            <div className={styles.searchBar}>
              <input
                className={styles.input}
                value={cityQuery}
                placeholder="Search city | اكتب اسم المدينة"
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => cityQuery && fetchSuggestions(cityQuery)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    fetchWeather();
                  }
                }}
              />
              <button className={styles.primary} onClick={() => fetchWeather()}>
                Show Weather
              </button>
            </div>
            <button
              className={styles.secondary}
              onClick={handleUseMyLocation}
              disabled={locating}
            >
              {locating ? "Locating..." : "Use my location | حدد موقعي"}
            </button>
          </div>
          {/* <div className={styles.hint}>Step 1: اكتب مدينة \u00b7 Step 2: اضغط Enter أو الزر \u00b7 أو استخدم موقعك مباشرة</div> */}
          {suggestions.length > 0 && (
            <div className={styles.suggestions}>
              {suggestions.map((item) => (
                <div
                  key={item.id}
                  className={styles.suggestionItem}
                  onClick={() => handleSuggestionClick(item)}
                >
                  <span>{item.label}</span>
                  <span className={styles.muted}>
                    {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.helperCard}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>How to use</span>
          <span className={styles.chip}>1-2-3 guide</span>
        </div>
        <div className={styles.helperList}>
          <div className={styles.helperItem}>
            <span className={styles.bullet} />
            Type a city and press Enter or pick a suggestion. We start you in {DEFAULT_CITY}.
          </div>
          <div className={styles.helperItem}>
            <span className={styles.bullet} />
            Read the cards: now, next hours, sun/UV, and 5-day outlook. Rain chances show percentages.
          </div>
          <div className={styles.helperItem}>
            <span className={styles.bullet} />
            Use quick cities below if you just want to explore without typing.
          </div>
        </div>
        <div className={styles.quickActions}>
          {quickCities.map((city) => (
            <button
              key={city}
              className={styles.quickChip}
              onClick={() => {
                setCityQuery(city);
                fetchWeather(city);
              }}
            >
              {city}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className={styles.card}>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardTitle}>Heads up</span>
            <span className={styles.chip}>Check spelling</span>
          </div>
          <p className={styles.muted}>{error}</p>
        </div>
      )}

      {loading && <div className={styles.loading} />}

      {!loading && weather && (
        <div className={styles.cardsGrid}>
          <div className={styles.card} ref={(el) => (cardsRef.current[0] = el)}>
            <div className={styles.cardTitleRow}>
              <span className={styles.cardTitle}>
                {weather.location.name}, {weather.location.country}
              </span>
              <span className={styles.chip}>Now</span>
            </div>
            <div className={styles.currentTemp}>
              <div>
                <div className={styles.tempValue}>
                  {weather.current.temp ?? "--"}°C
                </div>
                <div className={styles.tempMeta}>
                  <span>
                    {WEATHER_DESCRIPTIONS[weather.current.code] || "Live update"}
                  </span>
                  <span>
                    Feels like {weather.current.feels ?? "--"}°C
                  </span>
                  <span className={styles.muted}>
                    {weather.location.region || ""} \u00b7 {weather.location.coordinates}
                  </span>
                  <span className={styles.comfort}>
                    {comfortMessage(weather.current.temp, weather.current.feels)}
                  </span>
                </div>
              </div>
              <div className={styles.statsGrid}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Humidity</div>
                  <div className={styles.statValue}>
                    {weather.current.humidity ?? "--"}%
                  </div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Wind</div>
                  <div className={styles.statValue}>
                    {weather.current.wind ?? "--"} km/h
                  </div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Precip</div>
                  <div className={styles.statValue}>
                    {weather.current.precipitation ?? "--"} mm
                  </div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>UV index</div>
                  <div className={styles.statValue}>
                    {weather.current.uv ?? "--"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card} ref={(el) => (cardsRef.current[1] = el)}>
            <div className={styles.cardTitleRow}>
              <span className={styles.cardTitle}>Next hours</span>
              <span className={styles.chip}>Rain + UV</span>
            </div>
            <div className={styles.timeline}>
              {weather.hourly.map((hour) => (
                <div key={hour.time} className={styles.pillCard}>
                  <div className={styles.pillLabel}>
                    {formatTime(hour.time, weather.timezone)}
                  </div>
                  <div className={styles.pillValue}>{hour.temperature ?? "--"}°C</div>
                  <div className={styles.muted}>Rain {hour.precip ?? 0}%</div>
                  <div className={styles.muted}>UV {hour.uv ?? "-"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card} ref={(el) => (cardsRef.current[2] = el)}>
            <div className={styles.cardTitleRow}>
              <span className={styles.cardTitle}>Sun + UV window</span>
              <span className={styles.chip}>New feature</span>
            </div>
            {weather.daily.length > 0 && (
              <div>
                <div className={styles.sunRow}>
                  <span>Sunrise</span>
                  <span>{formatTime(weather.daily[0].sunrise, weather.timezone)}</span>
                </div>
                <div className={styles.sunRow}>
                  <span>Sunset</span>
                  <span>{formatTime(weather.daily[0].sunset, weather.timezone)}</span>
                </div>
                <div className={styles.divider} />
                <div className={styles.statsGrid}>
                  <div className={styles.stat}>
                    <div className={styles.statLabel}>Peak UV</div>
                    <div className={styles.statValue}>
                      {weather.daily[0].uv ?? "--"}
                    </div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statLabel}>Max temp</div>
                    <div className={styles.statValue}>
                      {weather.daily[0].max ?? "--"}°C
                    </div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statLabel}>Rain chance</div>
                    <div className={styles.statValue}>
                      {weather.daily[0].precip ?? 0}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.card} ref={(el) => (cardsRef.current[3] = el)}>
            <div className={styles.cardTitleRow}>
              <span className={styles.cardTitle}>5-day outlook</span>
              <span className={styles.chip}>Confidence</span>
            </div>
            <div className={styles.dailyList}>
              {weather.daily.map((day) => (
                <div key={day.date} className={styles.dayCard}>
                  <div className={styles.dayHeader}>
                    <span>{formatDay(day.date, weather.timezone)}</span>
                    <span className={styles.muted}>{EMOJI_BY_CODE[day.code] || "\u26c5"}</span>
                  </div>
                  <div className={styles.range}>
                    <span>{day.max ?? "--"}°</span>
                    <span className={styles.muted}> / {day.min ?? "--"}°</span>
                  </div>
                  <div className={styles.muted}>Rain {day.precip ?? 0}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && weather && weather.nextRainHour && (
        <footer className={styles.footer}>
          Next notable rain chance: {formatTime(weather.nextRainHour.time, weather.timezone)} with {weather.nextRainHour.precip}% probability. Last updated {formatTime(weather.lastUpdated, weather.timezone)}.
        </footer>
      )}
    </main>
  );
}

