import React, { useContext } from "react";
import "./WishList.css";
import { StoreContext } from "../../context/StoreContext";
import ProductItems from "../../components/ProductItems/ProductItems";

const WishList = () => {
  const { wishItems, product_list } = useContext(StoreContext);

  // Filter products that are in the wishlist
  const wishlistProducts = product_list.filter((item) => wishItems[item._id]);

  return (
    <div className="wishlist-container">
      <h1>My Wishlist</h1>
      <div className="wishlist-items">
        {wishlistProducts.length > 0 ? (
          wishlistProducts.map((item) => (
            <ProductItems
              key={item._id}
              id={item._id}
              name={item.name}
              image={item.image}
              price={item.price}
              description={item.description}
              category={item.category}
            />
          ))
        ) : (
          <div className="empty-wishlist">
            <p>Your wishlist is empty</p>
            <p>Add items to your wishlist to see them here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WishList;
