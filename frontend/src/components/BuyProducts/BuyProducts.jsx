import React from 'react'
import './BuyProducts.css'
import { assets } from '../../assets/assets'

const BuyProducts = () => {
  return (
    <div className="products-container">
      <div className="product-card">
        <div className="product-info">
          <h3>Vitamins</h3>
          <ul>
            <li>Analgesics</li>
            <li>Antimalarial Drugs</li>
            <li>Antipyretics</li>
            <li>Antibiotics</li>
          </ul>
          <button className="view-all">View all &gt;</button>
        </div>
        <div className="image-space">
          <img src={assets.image1} alt="Vitamins" />
        </div>
      </div>

      <div className="product-card">
        <div className="product-info">
          <h3>Baby Accessories</h3>
          <ul>
            <li>Meal Replacements</li>
            <li>Protein powder</li>
            <li>Muscle building</li>
          </ul>
          <button className="view-all">View all &gt;</button>
        </div>
        <div className="image-space">
          <img src={assets.image2} alt="Baby Accessories" />
        </div>
      </div>

      <div className="product-card">
        <div className="product-info">
          <h3>Herbs</h3>
          <ul>
            <li>Gluten Free</li>
            <li>Sun Care</li>
            <li>Sugar Free</li>
            <li>Super foods</li>
          </ul>
          <button className="view-all">View all &gt;</button>
        </div>
        <div className="image-space">
          <img src={assets.image3} alt="Herbs" />
        </div>
      </div>
    </div>
  )
}

export default BuyProducts