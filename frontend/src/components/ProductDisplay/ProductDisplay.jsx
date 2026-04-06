import React, { useContext } from "react";
import ProductItems from "../ProductItems/ProductItems";
import { StoreContext } from "../../context/StoreContext";
import "./ProductDisplay.css";

const ProductDisplay = () => {
  const { product_list, medicinesLoading, medicinesError } =
    useContext(StoreContext);

  return (
    <div className="product-display" id="product-display">
      <h2>Featured Medicines</h2>

      {medicinesLoading ? (
        <p className="product-display-state">Loading medicines...</p>
      ) : medicinesError ? (
        <p className="product-display-state">{medicinesError}</p>
      ) : product_list.length === 0 ? (
        <p className="product-display-state">No medicines available.</p>
      ) : (
        <div className="product-display-list">
          {product_list.map((item) => (
            <ProductItems
              key={item.id}
              id={item.id}
              name={item.name}
              price={item.price}
              image={item.image}
              category={item.category}
              description={item.salt || item.category || "Medicine"}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductDisplay;
