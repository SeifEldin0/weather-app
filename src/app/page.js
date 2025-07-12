"use client";
import { useState } from "react";
import axios from "axios";
import { Input, Button, AutoComplete } from "antd";

const WeatherApp = () => {
  const [weather, setWeather] = useState(null);
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const fetchSuggestions = async (value) => {
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${value}`
      );
      if (res.data.results) {
        setSuggestions(res.data.results.map((city) => ({
          value: city.name,
          label: `${city.name}, ${city.country}`
        })));
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const fetchWeather = async (selectedCity) => {
    setError("");
    setWeather(null);
    const cityToFetch = selectedCity || city;
    if (!cityToFetch.trim()) {
      setError("Please enter a city name");
      return;
    }
    try {
      const geoRes = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${cityToFetch}`
      );
      const geoData = geoRes.data;
      
      if (!geoData.results || geoData.results.length === 0) {
        setError("City not found");
        return;
      }
      
      const { latitude, longitude, name } = geoData.results[0];
      
      const weatherRes = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m`
      );

      setWeather({
        cityName: name,
        temperature: weatherRes.data.hourly.temperature_2m[0],
      });
    } catch (error) {
      console.error("Error fetching weather:", error);
      setError("Failed to fetch weather data");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f2f5",
        height: "100vh",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <h1>Weather App</h1>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", width: "100%", maxWidth: "400px" }}>
        <AutoComplete
          style={{ width: "100%" }}
          options={suggestions}
          onSearch={fetchSuggestions}
          onSelect={(value) => {
            setCity(value);
            fetchWeather(value);
          }}
          placeholder="Enter city name"
        />
        <Button type="primary" onClick={() => fetchWeather()}>Search</Button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {weather && (
        <div
          style={{
            padding: "20px",
            background: "#fff",
            borderRadius: "20px",
            textAlign: "center",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
            maxWidth: "600px",
            width: "100%",
          }}
        >
          <h2>Weather in {weather.cityName}</h2>
          <h3>Temperature: {weather.temperature}°C</h3>
        </div>
      )}
    </div>
  );
};

export default WeatherApp;

