import React, { useContext } from 'react'
import './ProductView.css'
import { useLocation } from 'react-router-dom'
import { StoreContext } from '../../context/StoreContext'
import { assets } from '../../assets/assets'

const ProductView = () => {
  const location = useLocation()
  const { addToWish, removeFromWish, wishItems } = useContext(StoreContext)
  const product = location.state.product

  const isInWishlist = wishItems[product._id]

  const handleWishlistClick = () => {
    if (isInWishlist) {
      removeFromWish(product._id)
    } else {
      addToWish(product._id)
    }
  }

  return (
    <div className="product-view">
      <div className="product-view-container">
        <div className="product-view-left">
          <div className="product-view-img">
            <img src={product.image} alt={product.name} />
          </div>
        </div>
        
        <div className="product-view-right">
          <h1>{product.name}</h1>
          <div className="product-view-rating">
            <img src={assets.rating_starts} alt="rating" />
            <p>(122)</p>
          </div>
          <div className="product-view-price">
            <h2>${product.price}</h2>
            <p>{product.description}</p>
          </div>
          <div className="product-view-category">
            <span>Category:</span> {product.category}
          </div>
          <div className="product-view-info">
            <h3>Product Information</h3>
            <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Maxime mollitia,
            molestiae quas vel sint commodi repudiandae consequuntur voluptatum laborum
            numquam blanditiis harum quisquam.</p>
          </div>
          <div className="product-view-actions">
            <button className="add-to-cart">Add to Cart</button>
            <button 
              className={`wishlist-btn ${isInWishlist ? 'in-wishlist' : ''}`}
              onClick={handleWishlistClick}
            >
              <img 
                src={isInWishlist ? assets.remove_icon_red : assets.wish} 
                alt="wishlist" 
              />
              {isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductView