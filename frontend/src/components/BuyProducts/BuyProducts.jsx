import React from 'react'
import './BuyProducts.css'
import { assets } from '../../assets/assets'

const BuyProducts = () => {
  return (
    <div className="products-container">
      <div className="product-card">
        <h3>Vitamins</h3>
        <div className="product-info">
          <div className="product-description">
          <ul>
            <li>Analgesics</li>
            <li>Antimalarial Drugs</li>
            <li>Antipyretics</li>
            <li>Antibiotics</li>
          </ul>
          </div>
          <div className="image-space">
            <img src={assets.image1} alt="Vitamins" />
          </div>
        </div>
        <button className="view-all">View all &gt;</button>
      </div>

      <div className="product-card">
        <h3>Baby Accessories</h3>
        <div className="product-info">
          <div className="product-description">
          <ul>
            <li>Meal Replacements</li>
            <li>Protein powder</li>
            <li>Muscle building</li>
          </ul>
          </div>
          <div className="image-space">
            <img src={assets.image2} alt="Vitamins" />
          </div>
        </div>
        <button className="view-all">View all &gt;</button>
      </div>


      <div className="product-card">
        <h3>Herbs</h3>
        <div className="product-info">
          <div className="product-description">
          <ul>
            <li>Gluten Free</li>
            <li>Sun Care</li>
            <li>Sugar Free</li>
            <li>Super foods</li>
          </ul>
          </div>
          <div className="image-space">
            <img src={assets.image3} alt="Vitamins" />
          </div>
        </div>
        <button className="view-all">View all &gt;</button>
      </div>

      
    </div>
  )
}

export default BuyProducts