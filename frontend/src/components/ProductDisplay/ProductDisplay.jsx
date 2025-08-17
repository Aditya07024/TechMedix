const API_URL = import.meta.env.VITE_API_URL;
import React, { useContext } from 'react'
import ProductItems from '../ProductItems/ProductItems';
import { StoreContext } from '../../context/StoreContext';
import './ProductDisplay.css'

const ProductDisplay = () => {
        const{product_list}=useContext(StoreContext);
  return (
    <div className='product-display' id='product-display'>
        <h2>New Products</h2>
        <div className="product-display-list">
            {product_list.map((item, index) => {
                    return <ProductItems key={index} id={item._id} name={item.name} description={item.description} price={item.price} image={item.image}/>
            })}
        </div>
    </div>
  )
}

export default ProductDisplay