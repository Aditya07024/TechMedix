import React, { useState } from "react";
import Navbar from "./components/navbar/Navbar";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home/Home";
import LoginPop from "./components/LoginPop/LoginPop";
import WishList from "./pages/WishList/WishList";
import ProductView from "./pages/ProductView/ProductView";
import Search from "./pages/Search/Search";

const App = () => {
  const [showLogin, setShowLogin] = useState(false);
  return (
    <>
      {showLogin && <LoginPop setShowLogin={setShowLogin} />}
      <div className="app">
        <Navbar setShowLogin={setShowLogin} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wishlist" element={<WishList />} />
          <Route path="/view" element={<ProductView />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </div>
    </>
  );
};

export default App;
