import { createContext, useEffect, useState } from "react";
import { getMedicines } from "../api/medicineApi";

export const StoreContext = createContext(null);

const StoreProvider = (props) => {
  const [productList, setProductList] = useState([]);
  const [medicinesLoading, setMedicinesLoading] = useState(true);
  const [medicinesError, setMedicinesError] = useState("");
  const [wishItems, setWishItems] = useState({});

  const addToWish = (itemId) => {
    setWishItems((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  };

  const removeFromWish = (itemId) => {
    setWishItems((prev) => {
      if (!prev[itemId]) return prev;
      const updated = { ...prev };
      if (updated[itemId] === 1) {
        delete updated[itemId];
      } else {
        updated[itemId] -= 1;
      }
      return updated;
    });
  };

  useEffect(() => {
    let isMounted = true;

    async function loadMedicines() {
      try {
        setMedicinesLoading(true);
        setMedicinesError("");
        const response = await getMedicines({ page: 1, limit: 8 });

        if (!isMounted) {
          return;
        }

        setProductList(response?.data ?? []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error("Failed to load medicines for storefront:", error);
        setMedicinesError("Unable to load medicines right now.");
        setProductList([]);
      } finally {
        if (isMounted) {
          setMedicinesLoading(false);
        }
      }
    }

    loadMedicines();

    return () => {
      isMounted = false;
    };
  }, []);

  const contextValue = {
    product_list: productList,
    medicinesLoading,
    medicinesError,
    wishItems,
    addToWish,
    removeFromWish,
    setWishItems,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {props.children}
    </StoreContext.Provider>
  );
};

export default StoreProvider;
