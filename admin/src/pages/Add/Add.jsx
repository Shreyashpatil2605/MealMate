import React, { useState, useEffect } from "react";
import "./Add.css";
import { assets } from "../../assets/assets";
import axios from "axios";
import { toast } from "react-toastify";
import { useContext } from "react";
import { StoreContext } from "../../context/StoreContext";

const Add = ({ url }) => {
  const { token } = useContext(StoreContext);
  const [image, setImage] = useState(false);
  const [categories, setCategories] = useState([
    "Salad",
    "Rolls",
    "Deserts",
    "Sandwich",
    "Cake",
    "Pure Veg",
    "Pasta",
    "Noodles",
  ]);
  const [data, setData] = useState({
    name: "",
    description: "",
    price: "",
    category: "Salad",
  });

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${url}/api/menu/list`);
        if (response.data.success && Array.isArray(response.data.data)) {
          const menuCategories = response.data.data.map(
            (item) => item.menu_name,
          );
          // Merge API categories with default ones, avoiding duplicates
          const defaultCategories = [
            "Salad",
            "Rolls",
            "Deserts",
            "Sandwich",
            "Cake",
            "Pure Veg",
            "Pasta",
            "Noodles",
          ];
          const allCategories = [
            ...menuCategories,
            ...defaultCategories.filter((cat) => !menuCategories.includes(cat)),
          ];
          setCategories(allCategories);
          // Update default category if not in the list
          if (!allCategories.includes(data.category)) {
            setData((prev) => ({
              ...prev,
              category: allCategories[0] || "Salad",
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
        // Keep default categories if API fails
      }
    };
    fetchCategories();
  }, [url]);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("description", data.description);
    formData.append("price", Number(data.price));
    formData.append("category", data.category);
    formData.append("image", image);

    const response = await axios.post(`${url}/api/food/add`, formData, {
      headers: { token },
    });
    if (response.data.success) {
      setData({
        name: "",
        description: "",
        price: "",
        category: "Salad",
      });
      setImage(false);
      toast.success(response.data.message);
    } else {
      toast.error(response.data.message);
    }
  };

  return (
    <div className="add">
      <form onSubmit={onSubmitHandler} className="flex-col">
        <div className="add-img-upload flex-col">
          <p>Upload image</p>
          <label htmlFor="image">
            <img
              src={image ? URL.createObjectURL(image) : assets.upload_area}
              alt=""
            />
          </label>
          <input
            onChange={(e) => setImage(e.target.files[0])}
            type="file"
            id="image"
            hidden
            required
          />
        </div>
        <div className="add-product-name flex-col">
          <p>Product name</p>
          <input
            onChange={onChangeHandler}
            value={data.name}
            type="text"
            name="name"
            placeholder="Type here"
            required
          />
        </div>
        <div className="add-product-description flex-col">
          <p>Product description</p>
          <textarea
            onChange={onChangeHandler}
            value={data.description}
            name="description"
            rows="6"
            placeholder="Write content here"
            required
          ></textarea>
        </div>
        <div className="add-category-price">
          <div className="add-category flex-col">
            <p>Product category</p>
            <select
              name="category"
              required
              onChange={onChangeHandler}
              value={data.category}
            >
              {categories.map((cat, index) => (
                <option key={index} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="add-price flex-col">
            <p>Product price</p>
            <input
              onChange={onChangeHandler}
              value={data.price}
              type="Number"
              name="price"
              placeholder="₹20"
              required
            />
          </div>
        </div>
        <button type="submit" className="add-btn">
          ADD
        </button>
      </form>
    </div>
  );
};

export default Add;
