import React, { useContext } from "react";
import "./FoodDisplay.css";
import { StoreContext } from "../../context/StoreContext";
import FoodItem from "../FoodItem/FoodItem";

const FoodDisplay = ({ category, searchResults }) => {
  const { food_list } = useContext(StoreContext);
  
  // Use searchResults if provided, otherwise filter from food_list
  const displayItems = searchResults || food_list;
  const title = searchResults ? "Search Results" : "Top dishes near you";
  
  return (
    <div className="food-display" id="food-display">
      <h2>{title}</h2>
      <div className="food-display-list">
        {displayItems.map((item, index) => {
          if (!searchResults && category !== "All" && category !== item.category)
            return null;
          return (
            <FoodItem
              key={index}
              id={item._id}
              name={item.name}
              description={item.description}
              price={item.price}
              image={item.image}
            />
          );
        })}
      </div>
    </div>
  );
};

export default FoodDisplay;
