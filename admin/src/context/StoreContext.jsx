import axios from "axios";
import { createContext, useEffect, useState } from "react";

export const StoreContext = createContext(null);

const StoreContextProvider = (props) => {
  const [token, setToken] = useState("");
  const [admin, setAdmin] = useState(false);
  const apiUrl = "http://localhost:4000";

  useEffect(() => {
    async function loadData() {
      if (localStorage.getItem("token")) {
        setToken(localStorage.getItem("token"));
      }
      if (localStorage.getItem("admin")) {
        setAdmin(localStorage.getItem("admin"));
      } else {
        // Auto-login with default admin credentials
        await autoLogin();
      }
    }
    loadData();
  }, []);

  const autoLogin = async () => {
    try {
      const response = await axios.post(`${apiUrl}/api/user/login`, {
        email: "admin@food.com",
        password: "admin123",
      });

      if (response.data.success) {
        setToken(response.data.token);
        setAdmin(true);
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("admin", true);
      }
    } catch (error) {
      console.log("Auto-login failed:", error);
    }
  };

  const contextValue = {
    token,
    setToken,
    admin,
    setAdmin,
  };
  return (
    <StoreContext.Provider value={contextValue}>
      {props.children}
    </StoreContext.Provider>
  );
};
export default StoreContextProvider;
