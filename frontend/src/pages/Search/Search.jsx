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

  // Filter food items - show exact match only if query matches exactly
  const filteredFood = searchQuery
    ? food_list?.filter(
        (item) =>
          item.name.toLowerCase() === searchQuery.toLowerCase() ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Check if there's an exact match - if so, show only that item
  const exactMatch = filteredFood?.find(
    (item) => item.name.toLowerCase() === searchQuery.toLowerCase()
  );

  // Display only exact match if found, otherwise show all filtered results
  const displayItems = exactMatch ? [exactMatch] : filteredFood;

  return (
    <div className="search-page">
      <div className="search-header">
        <h1>Search Results</h1>
        <p>
          {displayItems?.length || 0} results found for "{searchQuery}"
          {exactMatch && <span> (Showing exact match)</span>}
        </p>
      </div>
      {displayItems && displayItems.length > 0 ? (
        <FoodDisplay category="All" searchResults={displayItems} />
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
