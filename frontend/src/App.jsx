import React, { useState } from "react";
import Navbar from "./components/navbar/Navbar";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home/Home";
import LoginPop from "./components/LoginPop/LoginPop";
import WishList from "./pages/WishList/WishList";
import ProductView from "./pages/ProductView/ProductView";
import Search from "./pages/Search/Search";
import Test from "./pages/Test/test";
import Show from "./components/Testing/Show"; // Import the Show component
import { BrowserRouter, Navigate } from 'react-router-dom';
import {GoogleOAuthProvider} from '@react-oauth/google'
import AddMedicine from "./components/AddMedicine/AddMedicine";
import EditMedicine from "./components/EditMedicine/EditMedicine";
const App = () => {
  const [showLogin, setShowLogin] = useState(false);
  const GoogleAuthWrapper=()=>{
    return(
      <GoogleOAuthProvider clientId="191971308377-7j7inqnrmn7pk4m7oaag8o5bru6qv9li.apps.googleusercontent.com">
        <LoginPop></LoginPop>
      </GoogleOAuthProvider>
    )
  }
  return (
    <>
      {showLogin && <GoogleAuthWrapper setShowLogin={setShowLogin} />}
      <div className="app">
        <Navbar setShowLogin={setShowLogin} />
        <Routes>
          {/* <Route path="/medicines" element={<Test />} /> */}
          {/* <Route path="/medicine/:id" element={<Show />} /> */}
          {/* <Route path="/Amoxicillin" element={<Test />} /> */}

          <Route path="/" element={<Home />} />
          <Route path="/wishlist" element={<WishList />} />
          <Route path="/view" element={<ProductView />} />
          <Route path="/search" element={<Search />} />
          <Route path="/new" element={<AddMedicine/>}/>
          <Route path="/medicines/:id" element={<EditMedicine />} />
        </Routes>
      </div>
    </>
  );
};

export default App;
