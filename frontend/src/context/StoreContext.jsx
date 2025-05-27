import { createContext, useEffect, useState } from "react"
import { product_list } from "../assets/assets"

export const StoreContext = createContext(null)

const StoreProvider = (props) =>{

    const [wishItems, setWishItems] = useState({});
    
    const addToWish = (itemId) => {
    setWishItems((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  };

    const removeFromWish = (itemId)=>{
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
    }

    useEffect(()=>{
        console.log(wishItems)
    },[wishItems])

    const contextValue = {
        product_list,
        wishItems,
        addToWish,
        removeFromWish,
        setWishItems
    }

    return (
        <StoreContext.Provider value={contextValue}>
            {props.children}
        </StoreContext.Provider>
    )
}

export default StoreProvider