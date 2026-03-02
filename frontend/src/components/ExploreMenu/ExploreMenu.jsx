import React, { useEffect, useState } from "react";
import "./ExploreMenu.css";
import { menu_list as defaultMenuList } from "../../assets/frontend_assets/assets";

const ExploreMenu = ({ category, setCategory }) => {
  const [menu_list, setMenuList] = useState(defaultMenuList);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenuList = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/menu/list");
        const data = await response.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          // Merge API data with default list, avoiding duplicates
          const apiMenuNames = new Set(data.data.map((item) => item.menu_name));
          const mergedList = [
            ...data.data, // Add API items first
            ...defaultMenuList.filter(
              (item) => !apiMenuNames.has(item.menu_name),
            ), // Add default items that aren't in API
          ];
          // Sort by displayOrder
          mergedList.sort(
            (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
          );
          setMenuList(mergedList);
        } else {
          // Fallback to default menu list if API returns empty or fails
          setMenuList(defaultMenuList);
        }
      } catch (error) {
        console.error("Error fetching menu list:", error);
        // Fallback to default menu list on error
        setMenuList(defaultMenuList);
      } finally {
        setLoading(false);
      }
    };

    fetchMenuList();
  }, []);

  return (
    <div className="explore-menu" id="explore-menu">
      <h1>Explore our menu</h1>
      <p className="explore-menu-text">
        Choose from a diverse menu featuring a detectable array of dishes. Our
        mission is to satisfy your cravings and elevate your dining experience,
        one delicious meal at a time.
      </p>
      <div className="explore-menu-list">
        {loading ? (
          <p>Loading menu...</p>
        ) : menu_list.length > 0 ? (
          menu_list.map((item, index) => {
            // Determine image source
            let imageUrl = item.menu_image;

            // If menu_image is a string that's just a filename (no slashes), it's from the API
            // Otherwise it's a local imported image or full URL
            if (
              typeof imageUrl === "string" &&
              !imageUrl.includes("/") &&
              !imageUrl.includes("http")
            ) {
              // It's a filename from the API database, prepend the API URL
              imageUrl = `http://localhost:4000/images/${imageUrl}`;
            }

            return (
              <div
                onClick={() =>
                  setCategory((prev) =>
                    prev === item.menu_name ? "All" : item.menu_name,
                  )
                }
                key={index}
                className="explore-menu-list-item"
              >
                <img
                  className={category === item.menu_name ? "active" : ""}
                  src={imageUrl}
                  alt={item.menu_name}
                />
                <p>{item.menu_name}</p>
              </div>
            );
          })
        ) : (
          <p>No menu categories available</p>
        )}
      </div>
      <hr />
    </div>
  );
};

export default ExploreMenu;
