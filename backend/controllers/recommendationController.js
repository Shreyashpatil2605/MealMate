import axios from "axios";
import orderModel from "../models/orderModel.js";
import foodModel from "../models/foodModel.js";
import userModel from "../models/userModel.js";

const OPENWEATHER_API_KEY =
  process.env.OPENWEATHER_API_KEY || "0d5fb5b93d4af21c66a2948710284366";
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather";

// ==================== HELPER FUNCTIONS ====================

// Get current weather
const getWeather = async (lat = 24.8607, lon = 67.0011) => {
  try {
    const response = await axios.get(WEATHER_API_URL, {
      params: { lat, lon, appid: OPENWEATHER_API_KEY, units: "metric" },
    });
    return response.data;
  } catch (error) {
    console.warn("Weather API not available, using default:", error.message);
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
  if (!weatherData) return "sunny";
  const main = weatherData.weather[0]?.main?.toLowerCase() || "sunny";
  if (main.includes("rain")) return "rainy";
  if (main.includes("cloud")) return "cloudy";
  if (main.includes("clear") || main.includes("sunny")) return "sunny";
  if (main.includes("snow")) return "snowy";
  return "sunny";
};

// Get temperature level
const getTempLevel = (weatherData) => {
  if (!weatherData) return "moderate";
  const temp = weatherData.main?.temp || 20;
  if (temp > 30) return "hot";
  if (temp < 10) return "cold";
  return "moderate";
};

// Food recommendation database (fallback)
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

// Get user's food history with order counts
const getUserFoodHistory = async (userId) => {
  try {
    const orders = await orderModel.find({ userId }).select("items");
    const foodHistory = {};
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        foodHistory[item.name] = (foodHistory[item.name] || 0) + 1;
      });
    });
    // Return array of {name, count} sorted by count
    return Object.entries(foodHistory)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  } catch (error) {
    console.error("Error fetching user history:", error);
    return [];
  }
};

// Get recently viewed food items
const getRecentlyViewedItems = async (recentlyViewedIds) => {
  try {
    if (!recentlyViewedIds || recentlyViewedIds.length === 0) {
      return [];
    }

    // Fetch food details for recently viewed IDs
    const foods = await foodModel
      .find({
        _id: { $in: recentlyViewedIds },
      })
      .lean();

    // Maintain the order of recently viewed (most recent first)
    const foodMap = new Map(foods.map((food) => [food._id.toString(), food]));
    return recentlyViewedIds
      .map((id) => foodMap.get(id.toString()))
      .filter(Boolean)
      .slice(0, 10); // Limit to 10 items
  } catch (error) {
    console.error("Error fetching recently viewed:", error);
    return [];
  }
};

// ==================== SCORING ALGORITHM ====================

const calculateRecommendationScore = (food, context, userData) => {
  let score = 0;
  const reasons = [];
  const scoreDetails = {}; // Track individual components

  // Detect cold-start: no order history AND no dietary preferences
  const isNewUser =
    !userData ||
    ((!userData.orderHistory || userData.orderHistory.length === 0) &&
      (!userData.dietaryPreferences ||
        userData.dietaryPreferences.length === 0));

  // Weights configuration
  const weights = {
    timeOfDay: 0.2,
    weather: 0.2,
    dietary: 0.2,
    history: 0.2,
    recent: 0.1,
    popularity: 0.2,
  };

  // For cold-start users, rely only on context and popularity
  const effectiveWeights = isNewUser
    ? {
        timeOfDay: 0.25,
        weather: 0.25,
        popularity: 0.5,
        dietary: 0,
        history: 0,
        recent: 0,
      }
    : weights;

  // ==================== 5. TIME OF DAY SCORING ====================
  // Increase score if the item matches breakfast, lunch, dinner, or snack time
  scoreDetails.timeOfDay = 0;
  if (food.mealType && food.mealType.length > 0) {
    if (food.mealType.includes(context.timeOfDay)) {
      // Perfect match for current time
      scoreDetails.timeOfDay = effectiveWeights.timeOfDay;
      score += effectiveWeights.timeOfDay;
      reasons.push(`Perfect for ${context.timeOfDay}`);
    } else {
      // Partial credit for being a meal-type food (even if not perfect timing)
      const partialTimeScore = effectiveWeights.timeOfDay * 0.3;
      scoreDetails.timeOfDay = partialTimeScore;
      score += partialTimeScore;
    }
  }

  // ==================== 6. WEATHER SCORING ====================
  // Increase score if the item suits the current weather
  scoreDetails.weather = 0;
  if (food.weatherSuitability && food.weatherSuitability.length > 0) {
    if (food.weatherSuitability.includes(context.weatherCondition)) {
      // Perfect match for current weather
      scoreDetails.weather = effectiveWeights.weather;
      score += effectiveWeights.weather;
      reasons.push(`Great for ${context.weatherCondition} weather`);
    } else {
      // Partial credit for having weather data
      const partialWeatherScore = effectiveWeights.weather * 0.2;
      scoreDetails.weather = partialWeatherScore;
      score += partialWeatherScore;
    }
  }

  // ==================== 7. DIETARY & CUISINE PREFERENCES SCORING ====================
  // Increase score based on user dietary and cuisine preferences
  scoreDetails.dietary = 0;
  let dietaryMatchCount = 0;
  if (
    userData?.dietaryPreferences?.length > 0 &&
    food.dietaryTags?.length > 0
  ) {
    const matchingPrefs = userData.dietaryPreferences.filter((pref) =>
      food.dietaryTags.includes(pref),
    );
    if (matchingPrefs.length > 0) {
      // Score based on number of matching dietary preferences
      const dietaryBoost =
        (matchingPrefs.length / userData.dietaryPreferences.length) *
        effectiveWeights.dietary;
      scoreDetails.dietary = dietaryBoost;
      score += dietaryBoost;
      dietaryMatchCount = matchingPrefs.length;
      reasons.push(`Matches your ${matchingPrefs.join(", ")} preferences`);
    }
  }

  // Add cuisine preference boost if available
  if (userData?.cuisinePreferences?.length > 0 && food.cuisine) {
    if (userData.cuisinePreferences.includes(food.cuisine)) {
      const cuisineBoost = effectiveWeights.dietary * 0.4;
      scoreDetails.dietary += cuisineBoost;
      score += cuisineBoost;
      reasons.push(`Your favorite ${food.cuisine} cuisine`);
    }
  }

  // ==================== 8. ORDER HISTORY SCORING ====================
  // Increase score based on the user's past order history
  scoreDetails.history = 0;
  if (userData?.orderHistory?.length > 0) {
    const historyItem = userData.orderHistory.find(
      (item) => item.name === food.name,
    );
    if (historyItem) {
      // Score increases with order frequency (normalized to 0-1)
      const normalizedCount = Math.min(historyItem.count / 5, 1);
      const historyBoost = effectiveWeights.history * normalizedCount;
      scoreDetails.history = historyBoost;
      score += historyBoost;

      const orderWord = historyItem.count > 1 ? "times" : "time";
      reasons.push(
        `You've ordered this ${historyItem.count} ${orderWord} before`,
      );
    } else {
      // Partial match: category or cuisine matches past orders
      let categoryMatches = 0;
      if (food.category) {
        const categoriesOrdered = userData.orderHistory
          .map((item) => item.category)
          .filter((cat) => cat);

        categoryMatches = categoriesOrdered.filter(
          (cat) => cat === food.category,
        ).length;

        if (categoryMatches > 0) {
          const categoryBoost =
            effectiveWeights.history *
            0.2 *
            Math.min(categoryMatches / userData.orderHistory.length, 0.5);
          scoreDetails.history = categoryBoost;
          score += categoryBoost;
          reasons.push(`Similar to your past ${food.category} orders`);
        }
      }
    }
  }

  // ==================== 9. RECENTLY VIEWED SCORING ====================
  // Boost score if the item was recently viewed in the current session
  scoreDetails.recent = 0;
  if (userData?.recentlyViewed?.includes(food._id?.toString())) {
    scoreDetails.recent = effectiveWeights.recent;
    score += effectiveWeights.recent;
    reasons.push("Recently viewed by you");
  }

  // ==================== 10. GLOBAL POPULARITY SCORING ====================
  // Add score based on global popularity metrics (ratings, order volume, trending status)
  scoreDetails.popularity = 0;
  const popularityScore = (food.rating || 0) * 10 + (food.orderCount || 0);
  const normalizedPopularity = Math.min(popularityScore / 100, 1);
  scoreDetails.popularity = effectiveWeights.popularity * normalizedPopularity;
  score += scoreDetails.popularity;

  if (popularityScore > 50) {
    reasons.push("Trending now");
  } else if (food.orderCount > 20) {
    reasons.push("Popular choice");
  }

  // ==================== 11. NEW USER PRIORITIZATION ====================
  // If the user is new, prioritize popularity and context signals instead of history
  if (isNewUser && reasons.length === 0) {
    reasons.push("Popular in your area");
  }

  // ==================== 12. FINAL SCORE CALCULATION ====================
  // Calculate the final score for each item by combining all factors
  // Ensure score is within reasonable bounds
  const maxPossibleScore = Object.values(effectiveWeights).reduce(
    (a, b) => a + b,
    0,
  );
  const normalizedScore = Math.min(score, maxPossibleScore);

  return {
    score: normalizedScore,
    reasons,
    scoreDetails, // For debugging
  };
};

// ==================== MAIN RECOMMENDATION FUNCTION ====================

const getRecommendations = async (req, res) => {
  try {
    const { lat, lon, userId, limit = 10 } = req.body;

    console.log("\n========== RECOMMENDATION ALGORITHM START ==========");
    console.log("📍 Location:", { lat, lon });
    console.log("👤 User ID:", userId);
    console.log("📊 Limit:", limit);

    // Get weather data
    const weatherData = await getWeather(lat, lon);
    const timeOfDay = getTimeOfDay();
    const weatherCondition = getWeatherCondition(weatherData);
    const tempLevel = getTempLevel(weatherData);

    const context = { timeOfDay, weatherCondition, tempLevel };

    console.log("🌤️  Context:", {
      timeOfDay,
      weatherCondition,
      tempLevel,
      temp: weatherData?.main?.temp,
    });

    // Get user data if logged in
    let userData = null;
    let orderHistory = [];
    let recentlyViewed = [];

    if (userId && userId !== "user_id") {
      try {
        const user = await userModel.findById(userId);
        if (user) {
          console.log("✅ User found:", user.name);
          orderHistory = await getUserFoodHistory(userId);
          console.log("📋 Order history items:", orderHistory.length);

          // Fetch recently viewed food items
          const recentlyViewedIds = user.recentlyViewed || [];
          recentlyViewed = await getRecentlyViewedItems(recentlyViewedIds);
          console.log("👀 Recently viewed items:", recentlyViewed.length);

          userData = {
            dietaryPreferences: user.dietaryPreferences || [],
            recentlyViewed: recentlyViewedIds.map((id) => id.toString()),
            orderHistory,
          };
          console.log("🍽️  Dietary preferences:", userData.dietaryPreferences);
        } else {
          console.log("⚠️  User not found in database");
        }
      } catch (err) {
        console.warn("⚠️  Error fetching user data:", err.message);
      }
    } else {
      console.log("👤 Anonymous or guest user");
    }

    // Check if new user (cold-start): no order history AND no dietary preferences
    const isNewUser =
      !userData ||
      (orderHistory.length === 0 &&
        (!userData.dietaryPreferences ||
          userData.dietaryPreferences.length === 0));

    console.log(
      isNewUser
        ? "❄️  COLD-START MODE (New user)"
        : "✨ PERSONALIZED MODE (Known user)",
    );
    console.log("=== SCORING WEIGHTS ===");
    const testWeights = isNewUser
      ? {
          timeOfDay: 0.25,
          weather: 0.25,
          popularity: 0.5,
          dietary: 0,
          history: 0,
          recent: 0,
        }
      : {
          timeOfDay: 0.2,
          weather: 0.2,
          dietary: 0.2,
          history: 0.2,
          recent: 0.1,
          popularity: 0.2,
        };
    console.log(JSON.stringify(testWeights, null, 2));

    // Get all foods from database
    let allFoods = await foodModel.find({}).lean();

    // If no foods in database, use fallback recommendations
    if (!allFoods || allFoods.length === 0) {
      const fallbackRecs = recommendationRules[timeOfDay]?.[weatherCondition] ||
        recommendationRules[timeOfDay]?.sunny || [
          "Pizza",
          "Burger",
          "Pasta",
          "Salad",
        ];

      // Format recently viewed items for response (even if empty)
      const formattedRecentlyViewed = recentlyViewed.map((food) => ({
        _id: food._id,
        name: food.name,
        description: food.description,
        price: food.price,
        image: food.image,
        category: food.category,
        rating: food.rating || 0,
      }));

      return res.json({
        success: true,
        data: {
          recommendations: fallbackRecs.slice(0, limit),
          recentlyViewed: formattedRecentlyViewed,
          timeOfDay,
          weatherCondition,
          temperature: weatherData?.main?.temp || null,
          weatherData: weatherData?.weather[0] || null,
          userHistory: [],
          contextMessage: isNewUser
            ? `Discover popular foods for ${timeOfDay}`
            : `Recommended for you based on your preferences`,
          isNewUser,
          reasons: fallbackRecs.map((r) =>
            isNewUser ? "Popular in your area" : "Based on your preferences",
          ),
        },
      });
    }

    // Initialize all foods with score 0, then calculate scores
    console.log(`\n📦 Processing ${allFoods.length} food items...`);
    const scoredFoods = allFoods
      .map((food) => ({
        ...food,
        score: 0, // Initialize recommendation score to zero
        reasons: [],
      }))
      .map((food) => {
        const { score, reasons, scoreDetails } = calculateRecommendationScore(
          food,
          context,
          userData,
        );
        return {
          ...food,
          score,
          reasons,
          scoreDetails,
        };
      });

    // ==================== 13. RANK ALL FOOD ITEMS IN DESCENDING ORDER ====================
    // Sort by score descending
    console.log("\n🔄 Ranking all items by score (descending order)...");
    scoredFoods.sort((a, b) => b.score - a.score);

    // ==================== 14. SELECT TOP N HIGHEST-SCORING ITEMS ====================
    // Get top N recommendations
    console.log(
      `\n🏆 Selecting top ${limit} items from ${scoredFoods.length} total...`,
    );
    const topRecommendations = scoredFoods.slice(0, limit);

    // Format response
    const formattedRecommendations = topRecommendations.map((food) => ({
      _id: food._id,
      name: food.name,
      description: food.description,
      price: food.price,
      image: food.image,
      category: food.category,
      rating: food.rating || 0,
      reasons: food.reasons,
    }));

    // Create context message
    let contextMessage = isNewUser
      ? `Discover what's popular for ${timeOfDay}`
      : `Personalized recommendations for you`;

    if (weatherData) {
      const weatherIcon =
        weatherCondition === "rainy"
          ? "☔"
          : weatherCondition === "sunny"
            ? "☀️"
            : weatherCondition === "snowy"
              ? "❄️"
              : "";
      contextMessage += ` • ${weatherCondition.charAt(0).toUpperCase() + weatherCondition.slice(1)} ${weatherIcon} ${Math.round(weatherData.main.temp)}°C`;
    }

    console.log(
      `Returning ${formattedRecommendations.length} recommendations (isNewUser: ${isNewUser})`,
    );

    // ==================== 15. GENERATE CLEAR EXPLANATIONS ====================
    // Log score details for top recommendations with full details
    console.log("\n📊 === TOP RECOMMENDATIONS WITH EXPLANATIONS ===");
    topRecommendations.slice(0, 5).forEach((food, idx) => {
      console.log(`\n${idx + 1}. ${food.name}`);
      console.log(`   Score: ${food.score.toFixed(4)}`);
      console.log(
        `   Reasons: ${food.reasons.join(" | ") || "No specific reason"}`,
      );
      if (food.scoreDetails) {
        console.log(
          `   Score Breakdown:`,
          JSON.stringify(food.scoreDetails, null, 3),
        );
      }
    });
    console.log("\n=============================================");

    // Format recently viewed items for response
    const formattedRecentlyViewed = recentlyViewed.map((food) => ({
      _id: food._id,
      name: food.name,
      description: food.description,
      price: food.price,
      image: food.image,
      category: food.category,
      rating: food.rating || 0,
    }));

    console.log(
      `Recently viewed items count: ${formattedRecentlyViewed.length}`,
      formattedRecentlyViewed,
    );

    // ==================== 16. RETURN RANKED LIST WITH EXPLANATIONS ====================
    // Return the ranked list of recommended food items along with their explanations
    const response = {
      success: true,
      data: {
        // ✅ Recommendations with explanations
        recommendations: formattedRecommendations,
        // ✅ Recently viewed items
        recentlyViewed: formattedRecentlyViewed,
        // ✅ Context information
        timeOfDay,
        weatherCondition,
        temperature: weatherData?.main?.temp || null,
        weatherData: weatherData?.weather[0] || null,
        // ✅ User information
        userHistory: orderHistory.slice(0, 5).map((h) => h.name),
        contextMessage,
        isNewUser,
        dietaryPreferences: userData?.dietaryPreferences || [],
        // ✅ Algorithm status
        scoringMode: isNewUser
          ? "cold-start (context + popularity)"
          : "personalized (all factors)",
        totalItemsProcessed: allFoods.length,
        recommendationsReturned: formattedRecommendations.length,
      },
    };

    console.log("✅ RECOMMENDATION ALGORITHM COMPLETE");
    console.log(`   Mode: ${response.data.scoringMode}`);
    console.log(`   Items processed: ${response.data.totalItemsProcessed}`);
    console.log(`   Items returned: ${response.data.recommendationsReturned}`);
    console.log("========== RECOMMENDATION ALGORITHM END ==========\n");

    return res.json(response);
  } catch (error) {
    console.error("Recommendation error:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating recommendations: " + error.message,
    });
  }
};

// ==================== TRACK VIEWED ITEMS ====================

const trackRecentlyViewed = async (req, res) => {
  try {
    const { userId, foodId } = req.body;

    console.log(
      "Tracking recently viewed - userId:",
      userId,
      "foodId:",
      foodId,
    );

    if (!userId || !foodId) {
      return res.status(400).json({
        success: false,
        message: "userId and foodId are required",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Initialize recentlyViewed if not exists
    if (!user.recentlyViewed) {
      user.recentlyViewed = [];
    }

    // Remove if already exists (to move to front)
    const existingIndex = user.recentlyViewed.findIndex(
      (id) => id.toString() === foodId.toString(),
    );
    if (existingIndex > -1) {
      user.recentlyViewed.splice(existingIndex, 1);
    }

    // Add to beginning
    user.recentlyViewed.unshift(foodId);

    // Keep only last 20 items
    user.recentlyViewed = user.recentlyViewed.slice(0, 20);

    await user.save();

    console.log(
      "Recently viewed updated for user:",
      userId,
      "Total items:",
      user.recentlyViewed.length,
    );

    return res.json({
      success: true,
      message: "Recently viewed updated",
      data: { recentlyViewedCount: user.recentlyViewed.length },
    });
  } catch (error) {
    console.error("Error tracking viewed item:", error);
    return res.status(500).json({
      success: false,
      message: "Error tracking viewed item: " + error.message,
    });
  }
};

// ==================== GET POPULAR ITEMS ====================

const getPopularItems = async (req, res) => {
  try {
    const { limit = 10, category } = req.query;

    let query = {};
    if (category) {
      query.category = category;
    }

    const popularFoods = await foodModel
      .find(query)
      .sort({ orderCount: -1, rating: -1 })
      .limit(parseInt(limit) || 10)
      .lean();

    return res.json({
      success: true,
      data: popularFoods.map((food) => ({
        ...food,
        reason: food.orderCount > 50 ? "Trending now" : "Popular choice",
      })),
    });
  } catch (error) {
    console.error("Error fetching popular items:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching popular items: " + error.message,
    });
  }
};

// ==================== UPDATE DIETARY PREFERENCES ====================

const updateDietaryPreferences = async (req, res) => {
  try {
    // userId can come from either req.body (set by authMiddleware) or req.userId
    const userId = req.body.userId || req.userId;
    const { preferences } = req.body;

    console.log("updateDietaryPreferences - Received body:", req.body);
    console.log(
      "updateDietaryPreferences - userId from body:",
      req.body.userId,
    );
    console.log("updateDietaryPreferences - userId from req:", req.userId);
    console.log("updateDietaryPreferences - Final userId:", userId);
    console.log("updateDietaryPreferences - Preferences:", preferences);

    if (!userId) {
      console.error("updateDietaryPreferences - userId is missing!");
      return res.status(400).json({
        success: false,
        message: "userId is required - Authentication failed",
      });
    }

    if (!preferences || !Array.isArray(preferences)) {
      return res.status(400).json({
        success: false,
        message: "Preferences must be an array",
      });
    }

    const validPreferences = [
      "vegetarian",
      "vegan",
      "gluten-free",
      "dairy-free",
      "nut-free",
      "halal",
      "kosher",
    ];
    const filteredPreferences = preferences.filter((p) =>
      validPreferences.includes(p),
    );

    console.log("Updating user with ID:", userId);
    const user = await userModel.findByIdAndUpdate(
      userId,
      { dietaryPreferences: filteredPreferences },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("Preferences updated successfully for user:", userId);
    return res.json({
      success: true,
      message: "Dietary preferences updated",
      data: { dietaryPreferences: user.dietaryPreferences },
    });
  } catch (error) {
    console.error("Error updating dietary preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating preferences: " + error.message,
    });
  }
};

export {
  getRecommendations,
  trackRecentlyViewed,
  getPopularItems,
  updateDietaryPreferences,
};
