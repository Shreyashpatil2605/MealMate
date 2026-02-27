import React, { useContext, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "./Search.css";
import { StoreContext } from "../../context/StoreContext";
import FoodDisplay from "../../components/FoodDisplay/FoodDisplay";

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(query);
  const { food_list } = useContext(StoreContext);

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  // Filter food items based on search query
  const filteredFood = searchQuery
    ? food_list?.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="search-page">
      <div className="search-header">
        <h1>Search Results</h1>
        <p>
          {filteredFood?.length || 0} results found for "{searchQuery}"
        </p>
      </div>
      {filteredFood && filteredFood.length > 0 ? (
        <FoodDisplay category="All" searchResults={filteredFood} />
      ) : (
        <div className="no-results">
          <h2>No results found</h2>
          <p>Try searching for something else</p>
        </div>
      )}
    </div>
  );
};

export default Search;
