import React, { useContext } from "react";
import "./ProductItems.css";
import { assets } from "../../assets/assets";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";

const ProductItems = ({ id, name, image, price, description, category }) => {
  const { wishItems, addToWish, removeFromWish } = useContext(StoreContext);
  const navigate = useNavigate();

  const isInWishlist = wishItems[id];

  const handleWishlistClick = () => {
    if (isInWishlist) {
      removeFromWish(id);
    } else {
      addToWish(id);
    }
  };

  const handleProductClick = () => {
    navigate("/view", {
      state: {
        product: {
          _id: id,
          name,
          image,
          price,
          description,
          category,
        },
      },
    });
  };

  return (
    <div className="product-item">
      <div className="product-image" onClick={handleProductClick}>
        <img src={image} alt={name} />
      </div>
      <div className="product-item-info" onClick={handleProductClick}>
        <div className="product-item-name-rating">
          <p>{name}</p>
          <img src={assets.rating_starts} alt="rating" />
        </div>
        <p className="product-item-desc">{description}</p>
        <p className="product-item-price">${price}</p>
      </div>
      <div className="wishlist">
        <button
          onClick={handleWishlistClick}
          className={`wishlist-button ${isInWishlist ? "in-wishlist" : ""}`}
        >
          <div>
            <img
              src={isInWishlist ? assets.remove_icon_red : assets.wish}
              alt="wishlist icon"
            />
            <p>{isInWishlist ? "Remove from Wishlist" : "Add to Wishlist"}</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default ProductItems;
