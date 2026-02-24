import axios from "axios";
import orderModel from "../models/orderModel.js";

const OPENWEATHER_API_KEY =
  process.env.OPENWEATHER_API_KEY || "0d5fb5b93d4af21c66a2948710284366"; // Free tier key
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather";

// Get current weather
const getWeather = async (lat = 24.8607, lon = 67.0011) => {
  try {
    const response = await axios.get(WEATHER_API_URL, {
      params: {
        lat,
        lon,
        appid: OPENWEATHER_API_KEY,
        units: "metric",
      },
    });
    return response.data;
  } catch (error) {
    console.warn(
      "Weather API not available, using default weather conditions:",
      error.message,
    );
    // Return a default sunny weather object for fallback
    return {
      main: { temp: 25 },
      weather: [{ main: "Clear", description: "clear sky" }],
    };
  }
};

// Get time of day
const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "snack";
  if (hour >= 18 && hour < 23) return "dinner";
  return "late-night";
};

// Get weather condition
const getWeatherCondition = (weatherData) => {
  if (!weatherData) return "sunny"; // Default to sunny if no weather data
  const main = weatherData.weather[0]?.main?.toLowerCase() || "sunny";
  if (main.includes("rain")) return "rainy";
  if (main.includes("cloud")) return "cloudy";
  if (main.includes("clear") || main.includes("sunny")) return "sunny";
  if (main.includes("snow")) return "snowy";
  return "sunny"; // Default fallback
};

// Get temperature level
const getTempLevel = (weatherData) => {
  if (!weatherData) return "moderate";
  const temp = weatherData.main?.temp || 20;
  if (temp > 30) return "hot";
  if (temp < 10) return "cold";
  return "moderate";
};

// Food recommendation database
const recommendationRules = {
  breakfast: {
    sunny: ["Omelette", "Pancakes", "Fruit Salad", "Yogurt", "Toast"],
    rainy: ["Porridge", "Hot Tea", "Bread", "Eggs"],
    cloudy: ["Cereal", "Milk", "Fruits", "Bread"],
    snowy: ["Hot Soup", "Warm Bread", "Tea"],
  },
  lunch: {
    sunny: ["Salad", "Grilled Chicken", "Rice Bowl", "Sandwich"],
    rainy: ["Hot Soup", "Curry", "Rice", "Naan"],
    cloudy: ["Pizza", "Burger", "Pasta", "Fries"],
    snowy: ["Hot Pot", "Soup", "Stew", "Bread"],
  },
  snack: {
    sunny: ["Ice Cream", "Fresh Juice", "Fruits", "Popcorn"],
    rainy: ["Samosa", "Pakora", "Tea", "Biscuits"],
    cloudy: ["Sandwich", "Cookies", "Chips", "Juice"],
    snowy: ["Hot Chocolate", "Cookie", "Tea", "Cake"],
  },
  dinner: {
    sunny: ["Grilled Fish", "Salad", "Light Pasta", "BBQ"],
    rainy: ["Biryani", "Butter Chicken", "Naan", "Rice"],
    cloudy: ["Pizza", "Pasta", "Grilled Cheese", "Burger"],
    snowy: ["Stew", "Hot Curry", "Soup", "Bread"],
  },
  "late-night": {
    sunny: ["Snacks", "Light Pizza", "Sandwich"],
    rainy: ["Hot Noodles", "Soup", "Tea"],
    cloudy: ["Burger", "Fries", "Pizza"],
    snowy: ["Hot Chocolate", "Cookies", "Tea"],
  },
};

// Modify recommendations based on temperature
const applyTemperatureModifier = (recommendations, tempLevel) => {
  if (tempLevel === "hot") {
    const coolFoods = [
      "Ice Cream",
      "Fresh Juice",
      "Smoothie",
      "Salad",
      "Frozen Yogurt",
    ];
    return [...coolFoods, ...recommendations].slice(0, 5);
  }
  if (tempLevel === "cold") {
    const hotFoods = [
      "Hot Tea",
      "Hot Chocolate",
      "Soup",
      "Hot Coffee",
      "Curry",
    ];
    return [...hotFoods, ...recommendations].slice(0, 5);
  }
  return recommendations;
};

// Get user's food history
const getUserFoodHistory = async (userId) => {
  try {
    const orders = await orderModel.find({ userId }).select("items");
    const foodHistory = {};
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        foodHistory[item.name] = (foodHistory[item.name] || 0) + 1;
      });
    });
    return Object.keys(foodHistory)
      .sort((a, b) => foodHistory[b] - foodHistory[a])
      .slice(0, 3);
  } catch (error) {
    console.error("Error fetching user history:", error);
    return [];
  }
};

// Main recommendation function
const getRecommendations = async (req, res) => {
  try {
    const { lat, lon, userId } = req.body;

    console.log("Getting recommendations for lat:", lat, "lon:", lon);

    // Get weather data
    const weatherData = await getWeather(lat, lon);
    console.log("Weather data:", weatherData ? "received" : "failed");

    // Get time and weather conditions
    const timeOfDay = getTimeOfDay();
    const weatherCondition = getWeatherCondition(weatherData);
    const tempLevel = getTempLevel(weatherData);

    console.log(
      "Time:",
      timeOfDay,
      "Weather:",
      weatherCondition,
      "Temp level:",
      tempLevel,
    );

    // Get base recommendations
    let recommendations =
      recommendationRules[timeOfDay][weatherCondition] || [];

    if (!recommendations || recommendations.length === 0) {
      console.warn("No recommendations found, using default");
      recommendations = recommendations || [
        "Pizza",
        "Burger",
        "Pasta",
        "Salad",
      ];
    }

    // Apply temperature modifier
    recommendations = applyTemperatureModifier(recommendations, tempLevel);

    // Get user history
    const userHistory = userId ? await getUserFoodHistory(userId) : [];

    // Create context message
    let contextMessage = `${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)} time`;
    if (weatherData) {
      contextMessage += ` • ${weatherCondition.charAt(0).toUpperCase() + weatherCondition.slice(1)}`;
      if (weatherCondition === "rainy") contextMessage += " ☔";
      if (weatherCondition === "sunny") contextMessage += " ☀️";
      if (weatherCondition === "snowy") contextMessage += " ❄️";
      contextMessage += ` • ${Math.round(weatherData.main.temp)}°C`;
    }

    console.log("Sending recommendations:", recommendations);

    return res.json({
      success: true,
      data: {
        recommendations,
        timeOfDay,
        weatherCondition,
        temperature: weatherData?.main?.temp || null,
        weatherData: weatherData?.weather[0] || null,
        userHistory,
        contextMessage,
      },
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating recommendations: " + error.message,
    });
  }
};

export { getRecommendations };
